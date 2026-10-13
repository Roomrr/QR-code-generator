import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import knex from "knex";
test("full PostgreSQL backup preserves accounts, settings and QR data; refuses nonempty restore", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "relay-backup-"));
  const file = path.join(dir, "backup.json");
  const connection = { connectionString: process.env.DATABASE_URL, ssl: false };
  const db = knex({ client: "pg", connection });
  const name = "relay_restore_test";
  const run = (args, env = {}) =>
    spawnSync(process.execPath, ["scripts/backup.js", ...args], {
      env: { ...process.env, ...env },
      encoding: "utf8",
    });
  try {
    const result = run(["export", file]);
    assert.equal(result.status, 0, result.stderr);
    const backup = JSON.parse(await fs.readFile(file, "utf8"));
    assert.equal(backup.format, "relay-database-v2");
    assert.ok(backup.tables.users.length);
    assert.ok(backup.tables.app_settings.length);
    assert.equal(backup.tables.sessions, undefined);
    assert.equal(backup.tables.email_otps, undefined);
    assert.notEqual(run(["export", file]).status, 0);
    await db.raw(`CREATE DATABASE ${name}`);
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + name;
    const restored = knex({
      client: "pg",
      connection: { connectionString: url.href, ssl: false },
    });
    try {
      const restore = run(["import", file], { DATABASE_URL: url.href });
      assert.equal(restore.status, 0, restore.stderr);
      assert.equal(
        Number((await restored("users").count("* as n").first()).n),
        backup.tables.users.length,
      );
      assert.deepEqual(
        await restored("qr_codes").orderBy("id"),
        backup.tables.qr_codes.sort((a, b) => a.id.localeCompare(b.id)),
      );
      assert.equal(
        Number((await restored("sessions").count("* as n").first()).n),
        0,
      );
      assert.notEqual(
        run(["import", file], { DATABASE_URL: url.href }).status,
        0,
      );
    } finally {
      await restored.destroy();
      await db.raw(`DROP DATABASE ${name}`);
    }
  } finally {
    await db.destroy();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
