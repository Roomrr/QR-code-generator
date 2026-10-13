import express from "express";
import cors from "cors";
import helmet from "helmet";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "./db.js";
import { config } from "./config.js";
import { qrSchema } from "../shared/design.js";
import { exportAccount, importAccount } from "./transfer.js";
import { auth, authenticate, logout } from "./auth.js";
import { safeUser, now } from "./access.js";
import { settings } from "./settings.js";
import { admin } from "./admin.js";
import { publicPages } from "./public.js";
import { isAllowedOrigin } from "./origins.js";
export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        frameSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", config.origin],
        upgradeInsecureRequests: config.production ? [] : null,
      },
    },
  }),
);
app.use(
  cors({
    origin: (value, callback) =>
      callback(null, !value || isAllowedOrigin(value)),
    credentials: true,
  }),
);
app.use("/api", express.json({ limit: "20mb" }));
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    !isAllowedOrigin(req.headers.origin)
  )
    return res.status(403).json({ error: "Request origin is not allowed." });
  next();
});
app.get("/api/health", async (req, res) => {
  await db.raw("select 1");
  res.json({ status: "ok" });
});
app.get("/api/config", async (req, res) => {
  const site = await settings();
  res.json({
    registration: config.registration,
    qrBaseUrl: config.qrBase,
    siteName: site.siteName,
    freeAccess: true,
    contactEmail: site.contactEmail,
  });
});
app.use("/api/auth", auth);
app.use("/api", authenticate);
app.get("/api/auth/me", (req, res) => res.json(safeUser(req.user)));
app.post("/api/auth/logout", logout);
app.use("/api/admin", admin);
const present = (q) => ({
  ...q,
  active: !!q.active,
  design: JSON.parse(q.design),
  total_scans: Number(q.total_scans || 0),
});
const owned = (req) =>
  db("qr_codes").where({ id: req.params.id, user_id: req.user.id });
app.get("/api/qrs", async (req, res) => {
  const rows = await db("qr_codes as q")
    .where("q.user_id", req.user.id)
    .leftJoin("scans as s", "s.qr_id", "q.id")
    .select("q.*")
    .count("s.id as total_scans")
    .groupBy("q.id")
    .orderBy("q.created_at", "desc");
  res.json(rows.map(present));
});
app.post("/api/qrs", async (req, res) => {
  const input = qrSchema.parse(req.body);
  const id = nanoid();
  const row = {
    ...input,
    id,
    user_id: req.user.id,
    redirect_url: `${config.qrBase}/r/${id}`,
    design: JSON.stringify(input.design),
    created_at: now(),
    updated_at: now(),
  };
  await db("qr_codes").insert(row);
  res.status(201).json(present(row));
});
app.get("/api/qrs/:id", async (req, res) => {
  const row = await owned(req).first();
  if (!row) return res.status(404).json({ error: "QR code not found." });
  const scans = await db("scans")
    .where({ qr_id: row.id })
    .count("* as count")
    .first();
  res.json(present({ ...row, total_scans: scans.count }));
});
app.put("/api/qrs/:id", async (req, res) => {
  const input = qrSchema.parse(req.body);
  const count = await owned(req).update({
    ...input,
    design: JSON.stringify(input.design),
    updated_at: now(),
  });
  if (!count) return res.status(404).json({ error: "QR code not found." });
  res.json(present(await owned(req).first()));
});
app.delete("/api/qrs/:id", async (req, res) => {
  const count = await owned(req).delete();
  if (!count) return res.status(404).json({ error: "QR code not found." });
  res.status(204).end();
});
app.get("/api/qrs/:id/scans", async (req, res) => {
  if (!(await owned(req).first()))
    return res.status(404).json({ error: "QR code not found." });
  const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
  const rows = await db("scans")
    .where({ qr_id: req.params.id })
    .orderBy("scanned_at", "desc")
    .limit(50)
    .offset((page - 1) * 50);
  const total = await db("scans")
    .where({ qr_id: req.params.id })
    .count("* as count")
    .first();
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const recent = await db("scans")
    .where({ qr_id: req.params.id })
    .where("scanned_at", ">=", cutoff)
    .select("scanned_at", "device");
  const days = {};
  const devices = {};
  for (const s of recent) {
    const day = s.scanned_at.slice(0, 10);
    days[day] = (days[day] || 0) + 1;
    devices[s.device] = (devices[s.device] || 0) + 1;
  }
  res.json({
    rows,
    total: Number(total.count),
    page,
    pageSize: 50,
    days,
    devices,
  });
});
app.get("/api/export", async (req, res) => {
  res
    .attachment(`relay-export-${now().slice(0, 10)}.json`)
    .json(await exportAccount(req.user.id));
});
app.post("/api/import", async (req, res) => {
  res.json(await importAccount(req.user.id, req.body));
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "API endpoint not found." }),
);
app.get("/r/:id", async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("X-Robots-Tag", "noindex");
  res.set("Referrer-Policy", "no-referrer");
  const q = await db("qr_codes").where({ id: req.params.id }).first();
  if (!q)
    return res
      .status(404)
      .type("html")
      .send(
        "<!doctype html><title>QR code not found</title><h1>This QR code is unavailable</h1><p>The link may have been removed. Please contact its owner.</p>",
      );
  if (!q.active)
    return res
      .status(410)
      .type("html")
      .send(
        "<!doctype html><title>QR code paused</title><h1>This QR code is paused</h1><p>The owner has temporarily disabled this link.</p>",
      );
  if (req.method !== "HEAD") {
    const ua = req.get("user-agent") || "";
    const device = /tablet|ipad/i.test(ua)
      ? "Tablet"
      : /mobile|iphone|android/i.test(ua)
        ? "Mobile"
        : "Desktop";
    const browser = /edg/i.test(ua)
      ? "Edge"
      : /firefox/i.test(ua)
        ? "Firefox"
        : /chrome/i.test(ua)
          ? "Chrome"
          : /safari/i.test(ua)
            ? "Safari"
            : "Other";
    let referrer = "";
    try {
      referrer = new URL(req.get("referer")).origin;
    } catch {}
    try {
      await db("scans").insert({
        id: nanoid(),
        qr_id: q.id,
        scanned_at: now(),
        device,
        browser,
        referrer,
      });
    } catch (error) {
      console.error("Scan recording failed:", error.message);
    }
  }
  res.redirect(302, q.destination);
});
app.use(publicPages);
app.use((req, res, next) => {
  if (
    ["/app", "/login", "/register", "/admin"].some(
      (p) => req.path === p || req.path.startsWith(p + "/"),
    )
  )
    res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});
app.use(express.static("public"));
app.use(express.static("dist"));
app.get(["/app", "/login", "/register", "/admin"], (req, res, next) =>
  res.sendFile("index.html", { root: "dist" }, (error) => error && next(error)),
);
app.use((error, req, res, next) => {
  if (error instanceof z.ZodError)
    return res
      .status(400)
      .json({ error: error.issues.map((i) => i.message).join(" ") });
  if (error.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON request." });
  if (error.status === 413)
    return res.status(413).json({
      error:
        "Request exceeds the permitted size. Use the administrator backup tool for large transfers.",
    });
  if (error.code === "23505")
    return res
      .status(409)
      .json({ error: "This record already exists. Refresh and try again." });
  if (
    Number.isInteger(error.status) &&
    error.status >= 400 &&
    error.status <= 503
  ) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  res
    .status(500)
    .json({ error: "The server could not complete this request." });
});
