import "dotenv/config";
import { db, migrate } from "../server/db.js";
import { nanoid } from "nanoid";
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run admin:promote -- verified-owner@example.com");
  process.exit(1);
}
try {
  await migrate();
  await db.transaction(async (trx) => {
    const user = await trx("users").where({ email }).forUpdate().first();
    if (!user?.verified_at || user.status !== "active")
      throw Error("Register and verify an active account first.");
    await trx("users").where({ id: user.id }).update({ role: "superadmin" });
    await trx("admin_audit").insert({
      id: nanoid(),
      actor_id: user.id,
      target_id: user.id,
      action: "admin.promoted-by-operator",
      details: JSON.stringify({ source: "server CLI" }),
      created_at: new Date().toISOString(),
    });
  });
  console.log("Super administrator enabled. Sign in and open /admin.");
} finally {
  await db.destroy();
}
