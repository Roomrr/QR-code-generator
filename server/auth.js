import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import {
  randomBytes,
  randomInt,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { nanoid } from "nanoid";
import { z } from "zod";
import nodemailer from "nodemailer";
import { db } from "./db.js";
import { config } from "./config.js";
import { settings } from "./settings.js";
import { safeUser, now, DAY } from "./access.js";
export const auth = Router();
const cookieName = config.secure ? "__Host-relay_session" : "relay_session";
const cookieOptions = {
  httpOnly: true,
  secure: config.secure,
  sameSite: "lax",
  path: "/",
};
const hash = (s) => createHash("sha256").update(s).digest("hex");
const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const password = z
  .string()
  .min(8)
  .max(72)
  .refine(
    (v) => Buffer.byteLength(v, "utf8") <= 72,
    "Password must be at most 72 UTF-8 bytes.",
  );
const otpHash = (id, code) =>
  createHmac("sha256", config.appSecret).update(`${id}:${code}`).digest("hex");
const equal = (a, b) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function unavailable(message) {
  return Object.assign(new Error(message), { status: 503 });
}
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_REQUEST_LIMIT || 30),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Try again in 15 minutes.",
  },
});
auth.use((req, res, next) =>
  ["/register", "/login", "/verify", "/resend"].includes(req.path)
    ? limiter(req, res, next)
    : next(),
);
function assertEmailConfigured() {
  const missing = [];
  if (config.appSecret.length < 32)
    missing.push("APP_SECRET (at least 32 characters)");
  if (!config.smtp.host) missing.push("EMAIL_HOST");
  if (!config.smtp.from) missing.push("DEFAULT_FROM_EMAIL");
  if (missing.length)
    throw unavailable(
      `Email verification is not configured. Set ${missing.join(", ")} in .env and restart the API.`,
    );
}
const transport = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465 && config.smtp.tls,
  requireTLS: config.smtp.tls && config.smtp.port !== 465,
  auth: config.smtp.user
    ? { user: config.smtp.user, pass: config.smtp.password }
    : undefined,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});
function escape(s) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
async function issueOtp(user) {
  assertEmailConfigured();
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const result = await db.transaction(async (trx) => {
    await trx("users").where({ id: user.id }).forUpdate().first();
    const old = await trx("email_otps").where({ user_id: user.id }).first();
    const at = Date.now();
    const inWindow = old && at - Date.parse(old.window_started_at) < 3600000;
    if (old && at - Date.parse(old.sent_at) < config.otpCooldown * 1000)
      return {
        error: "Please wait before requesting another code.",
        retry: Math.ceil(
          config.otpCooldown - (at - Date.parse(old.sent_at)) / 1000,
        ),
      };
    if (inWindow && old.send_count >= config.otpHourlyLimit)
      return {
        error: "Hourly email limit reached. Try again later.",
        retry: Math.ceil(
          (3600000 - at + Date.parse(old.window_started_at)) / 1000,
        ),
      };
    const row = {
      user_id: user.id,
      code_hash: otpHash(user.id, code),
      expires_at: new Date(at + config.otpMinutes * 60000).toISOString(),
      sent_at: now(),
      attempts: 0,
      send_count: inWindow ? old.send_count + 1 : 1,
      window_started_at: inWindow ? old.window_started_at : now(),
    };
    await trx("email_otps").insert(row).onConflict("user_id").merge();
    return { row };
  });
  if (result.error)
    throw Object.assign(Error(result.error), {
      status: 429,
      retryAfter: result.retry,
    });
  const site = await settings();
  try {
    await transport.sendMail({
      from: config.smtp.from,
      to: user.email,
      subject: `${site.siteName}: verify your email`,
      text: `Your ${site.siteName} verification code is ${code}. It expires in ${config.otpMinutes} minutes. If you did not request this, ignore this email.`,
      html: `<!doctype html><html><body style="margin:0;background:#f1f4eb;font-family:Arial,sans-serif;color:#263d2c"><table role="presentation" width="100%"><tr><td align="center" style="padding:40px 16px"><table role="presentation" style="max-width:520px;background:white;border-radius:12px" width="100%"><tr><td style="padding:36px"><h1 style="font-size:28px">${escape(site.siteName)}<span style="color:#7b9954">.</span></h1><h2>One step to your next connection.</h2><p>Hello ${escape(user.name)},</p><p>Use this code to verify your email and activate your free account.</p><p style="font-size:34px;letter-spacing:9px;font-weight:bold;background:#eff3e7;padding:20px;text-align:center">${code}</p><p>This code expires in ${config.otpMinutes} minutes. Never share it with anyone.</p><p style="font-size:12px;color:#6d7b63">Didn't request this? You can safely ignore this email.</p></td></tr></table></td></tr></table></body></html>`,
    });
  } catch (error) {
    await db("email_otps")
      .where({ user_id: user.id, code_hash: result.row.code_hash })
      .delete();
    console.error("SMTP delivery failed:", error.code || "unknown");
    throw unavailable(
      "Could not send verification email. Check SMTP configuration and try resending.",
    );
  }
  return {
    verificationRequired: true,
    email: user.email,
    expiresInSeconds: config.otpMinutes * 60,
    resendAfterSeconds: config.otpCooldown,
  };
}
export async function createSession(res, user) {
  const token = randomBytes(32).toString("hex");
  await db("sessions").where("expires_at", "<", now()).delete();
  await db("sessions").insert({
    token_hash: hash(token),
    user_id: user.id,
    expires_at: new Date(Date.now() + config.sessionDays * DAY).toISOString(),
  });
  res.cookie(cookieName, token, {
    ...cookieOptions,
    maxAge: config.sessionDays * DAY,
  });
}
auth.post("/register", async (req, res) => {
  if (!config.registration)
    return res.status(403).json({ error: "Registration is disabled." });
  assertEmailConfigured();
  const input = z
    .object({ name: z.string().trim().min(1).max(100), email, password })
    .parse(req.body);
  if (await db("users").where({ email: input.email }).first())
    return res.status(409).json({
      error:
        "An account with this email exists. Sign in to verify or access it.",
    });
  const user = {
    id: nanoid(),
    name: input.name,
    email: input.email,
    password_hash: await bcrypt.hash(input.password, 12),
    created_at: now(),
  };
  await db("users").insert(user);
  res.status(201).json(await issueOtp(user));
});
auth.post("/login", async (req, res) => {
  const input = z
    .object({ email, password: z.string().max(128) })
    .parse(req.body);
  const user = await db("users").where({ email: input.email }).first();
  const valid = await bcrypt.compare(
    input.password,
    user?.password_hash ||
      "$2b$12$WPaSWgl6YYkMTnv80ZHr7eoEQfyCGMY.tBA.Nzzs5yHrSuTd.yIQK",
  );
  if (!user || !valid)
    return res.status(401).json({ error: "Email or password is incorrect." });
  if (user.status !== "active")
    return res.status(403).json({
      error: "This account is suspended or deactivated. Contact support.",
    });
  if (!user.verified_at) {
    const otp = await db("email_otps").where({ user_id: user.id }).first();
    if (!otp || Date.parse(otp.expires_at) < Date.now())
      return res.json(await issueOtp(user));
    return res.json({
      verificationRequired: true,
      email: user.email,
      resendAfterSeconds: Math.max(
        0,
        Math.ceil(
          config.otpCooldown - (Date.now() - Date.parse(otp.sent_at)) / 1000,
        ),
      ),
    });
  }
  await createSession(res, user);
  res.json(safeUser(user));
});
auth.post("/resend", async (req, res) => {
  const input = z
    .object({ email, password: z.string().max(128) })
    .parse(req.body);
  const user = await db("users").where({ email: input.email }).first();
  if (!user || !(await bcrypt.compare(input.password, user.password_hash)))
    return res.status(401).json({ error: "Email or password is incorrect." });
  if (user.verified_at || user.status !== "active")
    return res
      .status(400)
      .json({ error: "Verification is unavailable for this account." });
  res.json(await issueOtp(user));
});
auth.post("/verify", async (req, res) => {
  const input = z
    .object({ email, code: z.string().regex(/^\d{6}$/) })
    .parse(req.body);
  const result = await db.transaction(async (trx) => {
    const user = await trx("users")
      .where({ email: input.email })
      .forUpdate()
      .first();
    if (!user || user.verified_at || user.status !== "active")
      return { error: "Invalid or already-used verification code." };
    const otp = await trx("email_otps")
      .where({ user_id: user.id })
      .forUpdate()
      .first();
    if (!otp || Date.parse(otp.expires_at) < Date.now())
      return { error: "Verification code expired. Request a new code." };
    if (otp.attempts >= config.otpAttempts)
      return { error: "Too many incorrect codes. Request a new code." };
    if (!equal(otp.code_hash, otpHash(user.id, input.code))) {
      await trx("email_otps")
        .where({ user_id: user.id })
        .increment("attempts", 1);
      return { error: "Verification code is incorrect." };
    }
    const at = now();
    const update = {
      verified_at: at,
    };
    await trx("users").where({ id: user.id }).update(update);
    await trx("email_otps").where({ user_id: user.id }).delete();
    await trx("access_activity").insert({
      id: nanoid(),
      user_id: user.id,
      action: "email.verified",
      details: JSON.stringify({ freeAccess: true }),
      created_at: at,
    });
    return { user: { ...user, ...update } };
  });
  if (result.error) return res.status(400).json({ error: result.error });
  await createSession(res, result.user);
  res.json(safeUser(result.user));
});
export async function authenticate(req, res, next) {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="));
  const token = cookie?.slice(cookieName.length + 1);
  if (!token)
    return res.status(401).json({ error: "Please sign in to continue." });
  const session = await db("sessions")
    .where({ token_hash: hash(token) })
    .where("expires_at", ">", now())
    .first();
  if (!session)
    return res
      .status(401)
      .json({ error: "Your session expired. Sign in again." });
  const user = await db("users").where({ id: session.user_id }).first();
  if (!user || !user.verified_at)
    return res.status(403).json({ error: "Verify your email to continue." });
  if (user.status !== "active")
    return res
      .status(403)
      .json({ error: "This account is suspended or deactivated." });
  req.user = user;
  req.sessionHash = session.token_hash;
  next();
}
export async function logout(req, res) {
  await db("sessions").where({ token_hash: req.sessionHash }).delete();
  res.clearCookie(cookieName, cookieOptions);
  res.status(204).end();
}
