import { app } from "./app.js";
import { db, migrate } from "./db.js";
import { config } from "./config.js";
try {
  await migrate();
} catch (error) {
  console.error(
    "Relay API could not start because PostgreSQL is unavailable or its configuration is invalid. Check DATABASE_URL or DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, and DB_NAME in .env, then run npm run db:migrate.",
  );
  console.error(`Database error code: ${error.code || "connection failure"}`);
  await db.destroy();
  process.exit(1);
}
const server = app.listen(config.port, config.host, () =>
  console.log(`Relay API listening on port ${config.port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await db.destroy();
      process.exit(0);
    }),
  );
