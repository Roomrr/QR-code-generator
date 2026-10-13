// Builds a private deployable release. No AWS resources are created by this command.
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
const root = process.cwd();
const target = path.join(root, ".deploy");
const stage = path.join(target, "release");
await fs.mkdir(target, { recursive: true, mode: 0o700 });
await fs.chmod(target, 0o700);
const source = dotenv.parse(await fs.readFile(".env", "utf8"));
const persistent = path.join(target, "production.env");
let previous = {};
try {
  previous = dotenv.parse(await fs.readFile(persistent, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const env = {
  NODE_ENV: "production",
  PORT: "3001",
  HOST: "127.0.0.1",
  APP_ORIGIN: "https://qr-code-generator.roomrr.com",
  PUBLIC_BASE_URL: "https://qr-code-generator.roomrr.com",
  QR_BASE_URL: "https://qr-code-generator.roomrr.com",
  COOKIE_SECURE: "true",
  TRUST_PROXY: "1",
  ALLOW_REGISTRATION: source.ALLOW_REGISTRATION || "true",
  APP_SECRET: previous.APP_SECRET || randomBytes(48).toString("hex"),
  DB_HOST: "127.0.0.1",
  DB_PORT: "5432",
  DB_NAME: "relay",
  DB_USER: "relay",
  DB_PASSWORD: previous.DB_PASSWORD || randomBytes(32).toString("hex"),
  DATABASE_SSL: "false",
};
for (const key of [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_HOST_USER",
  "EMAIL_HOST_PASSWORD",
  "EMAIL_USE_TLS",
  "DEFAULT_FROM_EMAIL",
  "OTP_EXPIRY_MINUTES",
  "OTP_MAX_ATTEMPTS",
  "OTP_RESEND_SECONDS",
  "OTP_HOURLY_LIMIT",
  "SESSION_DAYS",
  "CONTACT_EMAIL",
  "BUSINESS_NAME",
  "GOOGLE_SITE_VERIFICATION",
])
  if (source[key] !== undefined) env[key] = source[key];
for (const key of ["EMAIL_HOST", "DEFAULT_FROM_EMAIL"])
  if (!env[key])
    throw Error(`Configure ${key} in .env before preparing production.`);
for (const value of Object.values(env))
  if (/[\r\n]/.test(value))
    throw Error("Multiline environment values are not supported.");
// Single-quoted dotenv values keep #, $ and spaces literal. Reject apostrophes instead of silently corrupting a credential.
for (const value of Object.values(env))
  if (value.includes("'"))
    throw Error(
      "An environment value contains an apostrophe. Configure that production value manually.",
    );
const text =
  Object.entries(env)
    .map(([key, value]) => `${key}='${value}'`)
    .join("\n") + "\n";
await fs.writeFile(persistent, text, { mode: 0o600 });
await fs.rm(stage, { recursive: true, force: true });
await fs.mkdir(stage, { mode: 0o700 });
for (const name of [
  "server",
  "shared",
  "scripts",
  "public",
  "dist",
  "deployment",
  "package.json",
  "package-lock.json",
])
  await fs.cp(path.join(root, name), path.join(stage, name), {
    recursive: true,
  });
await fs.writeFile(path.join(stage, ".env"), text, { mode: 0o600 });
if (process.argv.includes("--with-data")) {
  const result = spawnSync(
    process.execPath,
    ["scripts/backup.js", "export", path.join(stage, "migration-backup.json")],
    { cwd: root, env: process.env, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw Error(
      "Database export failed. Check the local database before preparing a migration.",
    );
  console.log(
    "Current PostgreSQL accounts, QR codes, settings and scan history included.",
  );
}
const archive = path.join(target, "relay-release.tar.gz");
const result = spawnSync(
  "tar",
  [
    "--no-xattrs",
    "--exclude=._*",
    "--exclude=.DS_Store",
    "-czf",
    archive,
    "-C",
    stage,
    ".",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  },
);
if (result.status !== 0) throw Error("Release archive failed.");
await fs.chmod(archive, 0o600);
console.log(
  "Private release prepared at .deploy/relay-release.tar.gz. Do not publish or commit it.",
);
