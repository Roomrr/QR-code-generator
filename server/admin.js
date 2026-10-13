import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "./db.js";
import { settings, settingSchema } from "./settings.js";
import { now, DAY, accessFor, superadmin } from "./access.js";
export const admin = Router();
admin.use(superadmin);
export async function audit(trx, actor, target, action, details) {
  await trx("admin_audit").insert({
    id: nanoid(),
    actor_id: actor,
    target_id: target,
    action,
    details: JSON.stringify(details),
    created_at: now(),
  });
}
admin.get("/summary", async (req, res) => {
  const users = await db("users").select(
    "id",
    "status",
    "verified_at",
    "trial_ends_at",
    "paid_until",
    "lifetime_free",
    "role",
  );
  const types = {};
  for (const u of users) {
    const type = accessFor(u).type;
    types[type] = (types[type] || 0) + 1;
  }
  const qr = await db("qr_codes").count("* as total").first();
  const scans = await db("scans").count("* as total").first();
  res.json({
    totalUsers: users.length,
    types,
    totalQRs: Number(qr.total),
    totalScans: Number(scans.total),
  });
});
admin.get("/users", async (req, res) => {
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(req.query.page) || 1)),
  );
  const search = String(req.query.search || "").slice(0, 100);
  const status = String(req.query.status || "all");
  const access = String(req.query.access || "all");
  let query = db("users as u");
  if (search)
    query = query.where(function () {
      this.whereILike("u.name", `%${search}%`).orWhereILike(
        "u.email",
        `%${search}%`,
      );
    });
  if (["active", "suspended", "deactivated"].includes(status))
    query = query.where("u.status", status);
  if (access === "unverified") query = query.whereNull("u.verified_at");
  else if (access === "free")
    query = query.whereNotNull("u.verified_at").where("u.status", "active");
  const total = await query.clone().count("* as count").first();
  const rows = await query
    .select(
      "u.id",
      "u.name",
      "u.email",
      "u.created_at",
      "u.verified_at",
      "u.status",
      "u.role",
      "u.lifetime_free",
      "u.trial_started_at",
      "u.trial_ends_at",
      "u.paid_until",
      db.raw(
        "(select count(*) from qr_codes q where q.user_id=u.id) as qr_count",
      ),
      db.raw(
        "(select count(*) from scans s join qr_codes q on q.id=s.qr_id where q.user_id=u.id) as scan_count",
      ),
    )
    .orderBy("u.created_at", "desc")
    .limit(50)
    .offset((page - 1) * 50);
  res.json({
    rows: rows.map((u) => ({
      ...u,
      access: accessFor(u),
      qr_count: Number(u.qr_count),
      scan_count: Number(u.scan_count),
    })),
    total: Number(total.count),
    page,
    pageSize: 50,
  });
});
admin.get("/users/:id", async (req, res) => {
  const u = await db("users").where({ id: req.params.id }).first();
  if (!u) return res.status(404).json({ error: "User not found." });
  delete u.password_hash;
  const activity = await db("access_activity")
    .where({ user_id: u.id })
    .orderBy("created_at", "desc")
    .limit(100);
  res.json({ user: { ...u, access: accessFor(u) }, activity });
});
admin.patch("/users/:id", async (req, res) => {
  const input = z
    .object({
      status: z.enum(["active", "suspended", "deactivated"]).optional(),
      reason: z.string().trim().min(3).max(500),
    })
    .parse(req.body);
  const result = await db.transaction(async (trx) => {
    const u = await trx("users")
      .where({ id: req.params.id })
      .forUpdate()
      .first();
    if (!u) return null;
    if (u.role === "superadmin" && input.status && input.status !== "active")
      throw Object.assign(
        Error("Super administrators cannot be suspended through this panel."),
        { status: 400 },
      );
    const changes = {};
    if (input.status) changes.status = input.status;
    if (!Object.keys(changes).length)
      throw Object.assign(
        Error("Choose at least one privilege or account change."),
        { status: 400 },
      );
    await trx("users").where({ id: u.id }).update(changes);
    if (changes.status && changes.status !== "active")
      await trx("sessions").where({ user_id: u.id }).delete();
    await trx("access_activity").insert({
      id: nanoid(),
      user_id: u.id,
      actor_id: req.user.id,
      action: "admin.access-modified",
      details: JSON.stringify({ changes, reason: input.reason }),
      created_at: now(),
    });
    await audit(trx, req.user.id, u.id, "user.updated", {
      before: {
        status: u.status,
        lifetime_free: u.lifetime_free,
        trial_ends_at: u.trial_ends_at,
        paid_until: u.paid_until,
      },
      changes,
      reason: input.reason,
    });
    return { ...u, ...changes };
  });
  if (!result) return res.status(404).json({ error: "User not found." });
  delete result.password_hash;
  res.json({ ...result, access: accessFor(result) });
});
admin.get("/settings", async (req, res) => res.json(await settings()));
admin.put("/settings", async (req, res) => {
  const input = settingSchema.parse(req.body);
  await db.transaction(async (trx) => {
    const previous = await settings(trx);
    await trx("app_settings")
      .insert({
        key: "public",
        value: JSON.stringify(input),
        updated_at: now(),
      })
      .onConflict("key")
      .merge();
    await audit(trx, req.user.id, null, "settings.updated", {
      before: previous,
      after: input,
    });
  });
  res.json(input);
});
admin.get("/audit", async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const total = await db("admin_audit").count("* as count").first();
  const rows = await db("admin_audit as a")
    .join("users as u", "u.id", "a.actor_id")
    .select("a.*", "u.email as actor_email")
    .orderBy("a.created_at", "desc")
    .limit(50)
    .offset((page - 1) * 50);
  res.json({ rows, total: Number(total.count), page, pageSize: 50 });
});
