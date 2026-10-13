import "dotenv/config";
const production = process.env.NODE_ENV === "production";
function integer(name, fallback, min = 0, max = 1000000) {
  const n = Number(process.env[name] || fallback);
  if (!Number.isInteger(n) || n < min || n > max)
    throw Error(`${name} must be an integer between ${min} and ${max}`);
  return n;
}
function origin(name, fallback) {
  const value = (process.env[name] || fallback).replace(/\/$/, "");
  const u = new URL(value);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.pathname !== "/" ||
    u.search ||
    u.hash ||
    u.username ||
    u.password
  )
    throw Error(`${name} must be an HTTP(S) origin`);
  if (production && u.protocol !== "https:")
    throw Error(`${name} requires HTTPS in production`);
  return value;
}
const appSecret = process.env.APP_SECRET || "";
export const config = {
  production,
  origin: origin("APP_ORIGIN", "http://localhost:5173"),
  publicOrigin: origin(
    "PUBLIC_BASE_URL",
    process.env.APP_ORIGIN || "http://localhost:5173",
  ),
  qrBase: origin("QR_BASE_URL", "http://localhost:3001"),
  port: integer("PORT", 3001, 1, 65535),
  host: process.env.HOST || "0.0.0.0",
  secure: process.env.COOKIE_SECURE === "true",
  registration: process.env.ALLOW_REGISTRATION !== "false",
  trustProxy: integer("TRUST_PROXY", 0, 0, 10),
  client: "pg",
  appSecret,
  sessionDays: integer("SESSION_DAYS", 7, 1, 30),
  otpMinutes: integer("OTP_EXPIRY_MINUTES", 10, 1, 60),
  otpAttempts: integer("OTP_MAX_ATTEMPTS", 5, 1, 10),
  otpCooldown: integer("OTP_RESEND_SECONDS", 60, 30, 600),
  otpHourlyLimit: integer("OTP_HOURLY_LIMIT", 5, 1, 20),
  smtp: {
    host: process.env.EMAIL_HOST,
    port: integer("EMAIL_PORT", 587, 1, 65535),
    user: process.env.EMAIL_HOST_USER,
    password: process.env.EMAIL_HOST_PASSWORD,
    tls: process.env.EMAIL_USE_TLS !== "false",
    from: process.env.DEFAULT_FROM_EMAIL,
  },
};
if (
  production &&
  (!process.env.APP_ORIGIN ||
    !process.env.QR_BASE_URL ||
    !process.env.PUBLIC_BASE_URL ||
    !config.secure)
)
  throw Error(
    "Production requires APP_ORIGIN, PUBLIC_BASE_URL, QR_BASE_URL and COOKIE_SECURE=true",
  );
if (config.appSecret.length < 32)
  console.warn(
    "APP_SECRET is not configured: email verification is unavailable until a random secret of at least 32 characters is supplied.",
  );
