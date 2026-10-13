import fs from "node:fs/promises";
import { db, migrate } from "../server/db.js";
import { config } from "../server/config.js";
const tablesToSave = [
  "users",
  "qr_codes",
  "scans",
  "app_settings",
  "payments",
  "payment_refunds",
  "webhook_events",
  "access_activity",
  "admin_audit",
];
const [action, file] = process.argv.slice(2);
if (!["export", "import"].includes(action) || !file) {
  console.error(
    "Usage: npm run db:backup -- /secure/path/backup.json OR npm run db:restore -- /secure/path/backup.json",
  );
  process.exit(1);
}
try {
  await migrate();
  if (action === "export") {
    const data = await db.transaction(
      async (trx) => {
        const tables = {};
        for (const name of tablesToSave)
          tables[name] = await trx(name).select("*");
        return {
          format: "relay-database-v2",
          exported_at: new Date().toISOString(),
          tables,
        };
      },
      config.client === "pg" ? { isolationLevel: "repeatable read" } : {},
    );
    await fs.writeFile(file, JSON.stringify(data), { mode: 0o600, flag: "wx" });
    console.log(
      "Backup saved. It contains password hashes and private destinations; keep it secure.",
    );
  } else {
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    if (
      data.format === "relay-database-v1" &&
      data.tables &&
      ["users", "qr_codes", "scans"].every((t) => Array.isArray(data.tables[t]))
    ) {
      for (const table of tablesToSave)
        if (!(table in data.tables)) data.tables[table] = [];
      data.format = "relay-database-v2";
    }
    if (
      data.format !== "relay-database-v2" ||
      !data.tables ||
      !tablesToSave.every((t) => Array.isArray(data.tables[t]))
    )
      throw Error("Invalid backup format.");
    await db.transaction(async (trx) => {
      for (const t of tablesToSave)
        if (Number((await trx(t).count("* as count").first()).count) !== 0)
          throw Error(
            "Restore requires an empty database; use a fresh database and run migrations first.",
          );
      for (const t of tablesToSave)
        for (let i = 0; i < data.tables[t].length; i += 50)
          await trx(t).insert(data.tables[t].slice(i, i + 50));
    });
    console.log(
      "Restore complete; users must sign in again. Original QR IDs and URLs preserved.",
    );
  }
} finally {
  await db.destroy();
}
