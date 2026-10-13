# Relay QR

Relay is free for every active user with a verified email. There are no payments, checkout integrations, subscriptions, or trial limits. Existing QR redirect URLs and designs are preserved. Legacy billing tables remain in the database for migration compatibility; they do not control access.

## Accounts

Register at `/register` with your own email and password, then enter the six-digit code delivered by SMTP. There are no default login credentials. Configure `APP_SECRET` (at least 32 random characters) and the `EMAIL_*` / `DEFAULT_FROM_EMAIL` settings in `.env` before registration. Promote an already verified account with `npm run admin:promote -- your-email@example.com`.

## Development

Install Node.js 22 and PostgreSQL, run `npm install`, and copy `.env.example` to `.env`. Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` to your database, or supply `DATABASE_URL`. Run `npm run db:migrate`, then `npm run dev`. The frontend runs at http://localhost:5173 and API at http://localhost:3001. SQLite is not used by the runtime.

Set `APP_ORIGIN` to the frontend origin, `PUBLIC_BASE_URL` to the public website origin, and `QR_BASE_URL` to your permanent redirect origin. Production requires HTTPS and `COOKIE_SECURE=true`. Keep `.env` private.

## Verification

`npm run build` builds the frontend. `npm test` runs integration tests with an isolated PostgreSQL cluster and local SMTP server. PostgreSQL utilities must be installed; set `PG_BIN` if they are outside the default location.

## Backups and migration

For a complete PostgreSQL backup, use `pg_dump --format=custom --file=relay.dump` with the standard PostgreSQL connection environment variables. Restore into a fresh database with `pg_restore --dbname=relay relay.dump`. Back up `.env` separately and protect both files: they contain private data and credentials. PostgreSQL backups include accounts, settings, designs, and scan history.

Deploy the API and frontend with the included Docker configuration and a PostgreSQL database. Supply PostgreSQL connection and SMTP settings to the API. Point public homepage and policy routes to the API for server-rendered SEO content, and workspace routes to the frontend. The admin panel manages account status, public site settings, and audit records.

When moving providers, transfer the database and configuration, migrate the schema, and keep the original QR redirect domain active with DNS pointing to the new deployment. Redirect URLs stored in existing codes must remain reachable at the same domain and path. Changing only the hosting server does not require printing new codes. Configure HTTPS through your reverse proxy or hosting provider.

The operator is responsible for hosting, database, domain, and email delivery costs; the application does not charge its users.

## Docker production setup

Copy `.env.production.example` to `.env`, supply two distinct domains, the database password, a random `APP_SECRET`, and SMTP credentials, then run `docker compose up -d --build`. This configuration includes PostgreSQL with a persistent volume, the API, Nginx frontend, and Caddy for HTTPS. Point both domain DNS records to your server and allow ports 80 and 443. For an independently hosted database, remove the Compose database service and its `depends_on` entry, then supply `DB_*` settings or `DATABASE_URL` to the API.

Run `docker compose exec api npm run admin:promote -- your-email@example.com` after registering and verifying your account. Create portable JSON backups with `docker compose exec api npm run db:backup -- /app/backups/relay.json`; restore into a fresh deployment with `npm run db:restore -- /app/backups/relay.json`. The backup directory is mounted on the host. JSON backups preserve public settings and audit history as well as QR data; sessions and pending OTPs are excluded. Legacy version 1 JSON backups can also be restored. Use a new backup filename each time.

For a full database backup in Docker, run `docker compose exec -T db pg_dump -U relay -d relay -Fc > relay.dump`. Restore using `docker compose exec -T db pg_restore -U relay -d relay < relay.dump` into a fresh, empty database before starting the API. Test restoration before changing DNS, retain both domain names, and keep the previous deployment available until traffic has moved. Do not delete Docker volumes during migration.

## AWS Lightsail with Nginx

For the single-server deployment at `qr-code-generator.roomrr.com`, see [the Lightsail setup guide](deployment/lightsail/README.md). It includes a private release packager, Ubuntu setup script, a Node.js systemd service, Nginx configuration, HTTPS commands, and daily PostgreSQL backups. Authenticate AWS CLI locally before provisioning. Gunicorn is not used because the API is Node.js.
