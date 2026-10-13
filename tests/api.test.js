import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import request from "supertest";
import { createHmac } from "node:crypto";
import { defaultDesign } from "../shared/design.js";
import { nanoid } from "nanoid";
if (!process.env.TEST_MAILBOX_PATH)
  throw Error("Run npm test to start isolated PostgreSQL and SMTP.");
const { app } = await import("../server/app.js");
const { db, migrate } = await import("../server/db.js");
const { config } = await import("../server/config.js");
const { accessFor, DAY } = await import("../server/access.js");
before(migrate);
after(() => db.destroy());
const owner = request.agent(app),
  stranger = request.agent(app),
  admin = request.agent(app);
let qr, ownerId, strangerId, adminId, exported;
const password = "eight123";
async function code(email) {
  const mailbox = JSON.parse(
    await fs.readFile(process.env.TEST_MAILBOX_PATH, "utf8"),
  );
  const match = mailbox[email]?.match(/code is (\d{6})/);
  assert.ok(match, "OTP was delivered over real SMTP");
  return match[1];
}
async function register(agent, email, name = "Test User") {
  const result = await agent
    .post("/api/auth/register")
    .send({ name, email, password })
    .expect(201);
  assert.equal(result.body.verificationRequired, true);
  assert.equal(result.headers["set-cookie"], undefined);
  return result;
}
async function verify(agent, email) {
  return agent
    .post("/api/auth/verify")
    .send({ email, code: await code(email) })
    .expect(200);
}
const input = {
  name: "Summer menu",
  destination: "https://website-a.example/menu",
  folder: "Menus",
  active: true,
  design: defaultDesign,
};
test("SSR homepage, metadata, sitemap, robots and private indexing", async () => {
  const response = await request(app).get("/").expect(200);
  assert.match(response.text, /<h1>A little code/);
  assert.match(response.text, /₹0/);
  assert.match(response.text, /Always free/);
  assert.match(response.text, /application\/ld\+json/);
  assert.match(response.text, /rel="canonical"/);
  assert.match(response.text, /og:title/);
  assert.match(response.text, /twitter:card/);
  assert.match(
    (await request(app).get("/robots.txt")).text,
    /Disallow: \/admin/,
  );
  const sitemap = await request(app).get("/sitemap.xml").expect(200);
  assert.match(sitemap.text, /refund-policy/);
  assert.doesNotMatch(sitemap.text, /<loc>[^<]*\/admin/);
  await request(app).get("/api/qrs").expect(401);
  await request(app).get("/api/admin/users").expect(401);
});
test("registration delivers branded SMTP OTP but cannot access management before verification", async () => {
  await owner
    .post("/api/auth/register")
    .send({ name: "Owner", email: "owner@example.test", password: "seven12" })
    .expect(400);
  await register(owner, "owner@example.test", "Owner");
  await owner.get("/api/auth/me").expect(401);
  await owner.get("/api/qrs").expect(401);
  const u = await db("users").where({ email: "owner@example.test" }).first();
  const otp = await db("email_otps").where({ user_id: u.id }).first();
  assert.equal(otp.code_hash.length, 64);
  assert.notEqual(otp.code_hash, await code(u.email));
  assert.equal(u.trial_started_at, null);
  ownerId = u.id;
  await owner
    .post("/api/auth/resend")
    .send({ email: u.email, password })
    .expect(429);
});
test("wrong, expired and reused OTPs are rejected; attempts persist", async () => {
  const correct = await code("owner@example.test");
  const wrong = correct === "000000" ? "111111" : "000000";
  await owner
    .post("/api/auth/verify")
    .send({ email: "owner@example.test", code: wrong })
    .expect(400);
  assert.equal(
    (await db("email_otps").where({ user_id: ownerId }).first()).attempts,
    1,
  );
  await db("email_otps")
    .where({ user_id: ownerId })
    .update({ expires_at: "2000-01-01T00:00:00.000Z" });
  await owner
    .post("/api/auth/verify")
    .send({ email: "owner@example.test", code: correct })
    .expect(400);
  await db("email_otps")
    .where({ user_id: ownerId })
    .update({ sent_at: "2000-01-01T00:00:00.000Z" });
  await owner
    .post("/api/auth/resend")
    .send({ email: "owner@example.test", password })
    .expect(200);
  const verified = await verify(owner, "owner@example.test");
  assert.match(verified.headers["set-cookie"][0], /HttpOnly/);
  assert.equal(verified.body.access.type, "free");
  assert.equal(
    (await db("users").where({ id: ownerId }).first()).verified_at !== null,
    true,
  );
  await owner
    .post("/api/auth/verify")
    .send({
      email: "owner@example.test",
      code: await code("owner@example.test"),
    })
    .expect(400);
  await register(stranger, "stranger@example.test");
  strangerId = (await verify(stranger, "stranger@example.test")).body.id;
  await register(admin, "admin@example.test");
  adminId = (await verify(admin, "admin@example.test")).body.id;
  await db("users").where({ id: adminId }).update({ role: "superadmin" });
});
test("guess limit blocks correct OTP until secure resend; resend requires password", async () => {
  await register(request.agent(app), "locked@example.test");
  const u = await db("users").where({ email: "locked@example.test" }).first();
  const otp = await code(u.email);
  const wrong = otp === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++)
    await request(app)
      .post("/api/auth/verify")
      .send({ email: u.email, code: wrong })
      .expect(400);
  await request(app)
    .post("/api/auth/verify")
    .send({ email: u.email, code: otp })
    .expect(400);
  await request(app)
    .post("/api/auth/resend")
    .send({ email: u.email, password: "wrong-password" })
    .expect(401);
});
test("unsafe destinations and low-contrast designs are rejected", async () => {
  for (const destination of [
    "javascript:alert(1)",
    "ftp://example.com",
    "https://user:password@example.com",
  ])
    await owner
      .post("/api/qrs")
      .send({ ...input, destination })
      .expect(400);
  await owner
    .post("/api/qrs")
    .send({ ...input, design: { ...defaultDesign, foreground: "#eeeeee" } })
    .expect(400);
});
test("QR ownership, update and permanent redirect URL work on PostgreSQL", async () => {
  qr = (await owner.post("/api/qrs").send(input).expect(201)).body;
  assert.equal(qr.redirect_url, `https://go.example.test/r/${qr.id}`);
  await stranger.get(`/api/qrs/${qr.id}`).expect(404);
  await stranger.put(`/api/qrs/${qr.id}`).send(input).expect(404);
  await stranger.delete(`/api/qrs/${qr.id}`).expect(404);
  await owner
    .put(`/api/qrs/${qr.id}`)
    .send({
      ...input,
      destination: "https://website-b.example",
      redirect_url: "https://evil.example",
    })
    .expect(200);
  const response = await request(app)
    .get(`/r/${qr.id}`)
    .set("User-Agent", "Android Mobile Chrome")
    .expect(302);
  assert.equal(response.headers.location, "https://website-b.example");
  assert.match(response.headers["cache-control"], /no-store/);
  assert.equal((await owner.get(`/api/qrs/${qr.id}/scans`)).body.total, 1);
});
test("all verified users retain free access after legacy trial expiry and payment endpoints are removed", async () => {
  await db("users").where({ id: ownerId }).update({
    trial_ends_at: "2000-01-01T00:00:00.000Z",
    paid_until: null,
    lifetime_free: false,
  });
  await owner.get("/api/qrs").expect(200);
  await owner.put(`/api/qrs/${qr.id}`).send(input).expect(200);
  await owner.get("/api/billing").expect(404);
  await owner.post("/api/billing/orders").send({ days: 1 }).expect(404);
  await request(app).post("/api/payments/webhook").send({}).expect(401);
  await owner.get("/api/export").expect(200);
  await request(app).get(`/r/${qr.id}`).expect(302);
});
test("admin endpoints remain protected and free access persists across logout", async () => {
  await stranger.get("/api/admin/users").expect(403);
  await owner.post("/api/auth/logout").expect(204);
  await owner
    .post("/api/auth/login")
    .send({ email: "owner@example.test", password })
    .expect(200);
  assert.equal((await owner.get("/api/auth/me")).body.access.type, "free");
});
test("suspended sessions are revoked while published QR redirects stay available", async () => {
  await admin
    .patch(`/api/admin/users/${strangerId}`)
    .send({ status: "suspended", reason: "Test suspension" })
    .expect(200);
  await stranger.get("/api/auth/me").expect(401);
  await stranger
    .post("/api/auth/login")
    .send({ email: "stranger@example.test", password })
    .expect(403);
  await admin
    .patch(`/api/admin/users/${strangerId}`)
    .send({ status: "active", reason: "Reactivate account" })
    .expect(200);
  await stranger
    .post("/api/auth/login")
    .send({ email: "stranger@example.test", password })
    .expect(200);
});
test("site settings persist and new verified users receive free access", async () => {
  const site = (await admin.get("/api/admin/settings")).body;
  await admin
    .put("/api/admin/settings")
    .send({ ...site, siteName: "Relay", contactEmail: "support@example.test" })
    .expect(200);
  assert.equal((await request(app).get("/api/config")).body.freeAccess, true);
  assert.match((await request(app).get("/")).text, /Always free/);
  const agent = request.agent(app);
  await register(agent, "newtrial@example.test");
  assert.equal(
    (await verify(agent, "newtrial@example.test")).body.access.type,
    "free",
  );
});
test("workspace import preserves permanent IDs and scan history across accounts", async () => {
  exported = (await owner.get("/api/export")).body;
  assert.equal(exported.codes[0].redirect_url, qr.redirect_url);
  await stranger.post("/api/import").send(exported).expect(400);
  await owner.delete(`/api/qrs/${qr.id}`).expect(204);
  const r = await stranger.post("/api/import").send(exported).expect(200);
  assert.equal(r.body.importedCodes, 1);
  assert.equal((await stranger.get(`/api/qrs/${qr.id}`)).body.total_scans, 2);
  await request(app).get(`/r/${qr.id}`).expect(302);
  await owner.get(`/api/qrs/${qr.id}`).expect(404);
});
test("cross-origin state changes blocked and login cannot choose privileges", async () => {
  await owner
    .post("/api/qrs")
    .set("Origin", "https://evil.example")
    .send(input)
    .expect(403);
  await owner
    .post("/api/auth/login")
    .send({
      email: "owner@example.test",
      password,
      role: "superadmin",
      lifetime_free: true,
    })
    .expect(200);
  assert.equal((await owner.get("/api/auth/me")).body.role, "user");
});

test("development origins allow loopback aliases while rejecting other ports and websites", async () => {
  for (const origin of [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::1]:5173",
  ]) {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({})
      .expect(400);
    assert.equal(response.headers["access-control-allow-origin"], origin);
  }
  for (const origin of [
    "http://localhost:5174",
    "https://evil.example",
    "http://localhost.evil.example:5173",
  ])
    await request(app)
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({})
      .expect(403);
});
