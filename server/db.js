import "dotenv/config";
import knex from "knex";
import { fileURLToPath } from "node:url";
const connection = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || "relay",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "relay",
    };
connection.ssl =
  process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false;
export const db = knex({
  client: "pg",
  connection,
  pool: { min: 0, max: 10 },
  migrations: {
    directory: fileURLToPath(new URL("./migrations", import.meta.url)),
    loadExtensions: [".js"],
  },
});
export async function migrate() {
  await db.migrate.latest();
}
