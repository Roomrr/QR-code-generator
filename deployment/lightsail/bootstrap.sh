#!/usr/bin/env bash
# Run as root after securely uploading the prepared release to /opt/relay.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if [[ $EUID -ne 0 ]]; then echo 'Run this script with sudo.' >&2; exit 1; fi
if [[ ! -f /opt/relay/.env ]]; then echo 'Missing production .env.' >&2; exit 1; fi
if ! swapon --show | awk '{print $1}' | grep -qx /swapfile; then
    if [[ ! -f /swapfile ]]; then fallocate -l 2G /swapfile; chmod 600 /swapfile; mkswap /swapfile >/dev/null; fi
    swapon /swapfile
    if ! grep -q '^/swapfile ' /etc/fstab; then echo '/swapfile none swap sw 0 0' >> /etc/fstab; fi
fi
apt-get update -qq
apt-get install -y -qq nginx postgresql postgresql-contrib certbot python3-certbot-nginx curl ca-certificates xz-utils build-essential python3
if ! command -v node >/dev/null || [[ $(node -p 'process.versions.node.split(".")[0]') != 22 ]]; then
    node_arch=x64
    if [[ $(dpkg --print-architecture) == arm64 ]]; then node_arch=arm64; fi
    node_archive="node-v22.23.3-linux-${node_arch}.tar.xz"
    node_tmp=$(mktemp -d)
    curl -fsSL "https://nodejs.org/dist/v22.23.3/${node_archive}" -o "${node_tmp}/${node_archive}"
    curl -fsSL https://nodejs.org/dist/v22.23.3/SHASUMS256.txt -o "${node_tmp}/SHASUMS256.txt"
    (cd "$node_tmp" && grep " ${node_archive}$" SHASUMS256.txt | sha256sum -c -)
    tar -xJf "${node_tmp}/${node_archive}" -C /usr/local --strip-components=1
    rm -rf "$node_tmp"
fi
id relay >/dev/null 2>&1 || useradd --system --home /opt/relay --shell /usr/sbin/nologin relay
mkdir -p /opt/relay/backups /var/backups/relay
chmod 700 /var/backups/relay
chown -R relay:relay /opt/relay
chmod 755 /opt/relay
chmod 600 /opt/relay/.env
cd /opt/relay
sudo -u relay env NODE_OPTIONS=--max-old-space-size=256 npm ci --omit=dev --no-audit --no-fund
systemctl enable --now postgresql
# Pass the database secret through stdin, never through command-line arguments or logs.
node --input-type=module <<'JS' | sudo -u postgres psql -X -v ON_ERROR_STOP=1 >/dev/null
import 'dotenv/config';
const password=process.env.DB_PASSWORD;
if (!/^[a-f0-9]{64}$/.test(password||'')) throw Error('Use the generated production DB_PASSWORD.');
console.log(`SELECT 'CREATE ROLE relay LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='relay')\\gexec`);
console.log(`ALTER ROLE relay PASSWORD '${password}';`);
console.log("SELECT 'CREATE DATABASE relay OWNER relay' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='relay')\\gexec");
JS
sudo -u relay npm run db:migrate
if [[ -f /opt/relay/migration-backup.json ]]; then
    sudo -u relay npm run db:restore -- /opt/relay/migration-backup.json
    rm /opt/relay/migration-backup.json
fi
install -m 644 deployment/lightsail/relay.service /etc/systemd/system/relay.service
install -m 644 deployment/lightsail/nginx.conf /etc/nginx/sites-available/relay
ln -sfn /etc/nginx/sites-available/relay /etc/nginx/sites-enabled/relay
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl daemon-reload
systemctl enable --now relay nginx
systemctl restart relay
systemctl reload nginx
install -m 755 deployment/lightsail/backup.sh /usr/local/sbin/relay-backup
install -m 644 deployment/lightsail/relay-backup.service /etc/systemd/system/relay-backup.service
install -m 644 deployment/lightsail/relay-backup.timer /etc/systemd/system/relay-backup.timer
systemctl daemon-reload
systemctl enable --now relay-backup.timer
for attempt in {1..30}; do
    if curl -fsS http://127.0.0.1:3001/api/health >/dev/null; then echo 'Relay API healthy. Configure DNS, then issue the HTTPS certificate.'; exit 0; fi
    sleep 2
done
echo 'API failed health check. Inspect sudo journalctl -u relay.' >&2
exit 1
