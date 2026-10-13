#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_file="/var/backups/relay/relay-$(date -u +%Y%m%dT%H%M%SZ).dump"
sudo -u postgres pg_dump -Fc relay > "$backup_file"
find /var/backups/relay -name 'relay-*.dump' -type f -mtime +7 -delete
