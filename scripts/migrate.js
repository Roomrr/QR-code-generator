import { db, migrate } from "../server/db.js";
try {
  await migrate();
  console.log("Database migrations complete.");
} finally {
  await db.destroy();
}
