# Lightsail deployment

Target: `https://qr-code-generator.roomrr.com`. Backend: Node.js 22 managed by systemd; Nginx serves assets and proxies the API/public pages. Gunicorn is a Python server and is not used by this Node application.

Use the smallest active Linux bundle that includes public IPv4 (currently `nano_3_1`, $5/month), Ubuntu 24.04, and an attached Lightsail static IP. PostgreSQL shares the instance to avoid a separately billed managed database. 512 MB is suitable for initial light usage; 2 GB swap is configured. Monitor memory and disk as usage grows. Pricing excludes taxes, excess transfer and optional snapshots.

## Prepare

Authenticate the AWS CLI with `aws login` (or your organization's configured profile). Check `aws sts get-caller-identity`. Never put AWS credentials in the app `.env`.

Run `npm run build`, `npm test`, and `node deployment/lightsail/prepare.mjs --with-data`. The last command creates a private archive in `.deploy/` with newly generated production database credentials and a production app secret, the configured SMTP settings, and a portable database export. Repeated preparations reuse the production secrets saved in `.deploy/production.env`. It does not change your development `.env`. The archive contains confidential data. Never publish it.

Inspect Lightsail bundles and blueprints in `ap-south-1` before provisioning. Select `nano_3_1` only if it is active, Linux and includes public IPv4. Use a dedicated SSH key pair. Keep the private key in `.deploy/` with mode 600. Create an instance, allocate and attach a static IP, then open ports 80/443 publicly and port 22 only to your current public IP. Leave 3001 and 5432 closed publicly. Avoid creating duplicate instances when retrying.

Upload `relay-release.tar.gz` over SSH/SCP. On the Ubuntu instance:

```bash
sudo mkdir -p /opt/relay
sudo tar -xzf ~/relay-release.tar.gz -C /opt/relay
sudo bash /opt/relay/deployment/lightsail/bootstrap.sh
rm ~/relay-release.tar.gz
```

The bootstrap installs dependencies, configures swap and PostgreSQL, migrates and restores the provided data, creates the restricted `relay` service user, and enables Nginx and daily backups. Use a fresh database for the initial restore. For later updates omit `--with-data`, preserve `.deploy/production.env`, and take a database backup before uploading. The bootstrap is for this dedicated instance; it changes its Nginx default site and PostgreSQL role.

## DNS and HTTPS

In Cloudflare create a DNS-only A record named `qr-code-generator` pointing to the attached static IP. Remove conflicting records for that exact subdomain only. Wait until public DNS resolves to the instance, then run:

```bash
sudo certbot --nginx -d qr-code-generator.roomrr.com --redirect --agree-tos --register-unsafely-without-email --non-interactive
sudo certbot renew --dry-run
curl -fsS https://qr-code-generator.roomrr.com/api/health
```

Prefer supplying an operator email with `--email YOUR_EMAIL` instead of `--register-unsafely-without-email` for certificate notifications. Use Cloudflare Full (strict) if subsequently enabling its proxy. Do not use Flexible TLS. Session cookies are Secure, so sign-in requires HTTPS.

Verify the public homepage, OTP registration, sign-in, QR creation and downloads, and a redirect from an actual decoded QR. Existing production redirect URLs remain unchanged. Codes created locally with a localhost redirect URL cannot become public merely by moving the database; recreate those test codes using the production domain. Keep old real redirect domains routed to the deployment if importing codes distributed on those domains.

## Operations and recovery

```bash
sudo systemctl status relay nginx postgresql
sudo journalctl -u relay -n 100 --no-pager
sudo systemctl restart relay
sudo nginx -t
sudo /usr/local/sbin/relay-backup
sudo systemctl list-timers relay-backup.timer
```

Backups run daily around 03:00 UTC and retain seven days in `/var/backups/relay`. Copy backups off the server: local backups alone do not survive loss of the instance. The cheapest setup does not automatically create paid snapshots or a managed database. Copy production `.env` privately as well.

Restore a dump into a fresh PostgreSQL database with `pg_restore` and preserve the permanent redirect domain when moving servers. Updates should retain a prior release archive and a pre-migration database backup. To roll back schema changes, restore the matching database backup along with the prior release.
