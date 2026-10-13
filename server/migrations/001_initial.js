export async function up(knex) {
  await knex.schema.createTable("users", (t) => {
    t.string("id", 24).primary();
    t.string("name", 100).notNullable();
    t.string("email", 254).notNullable().unique();
    t.text("password_hash").notNullable();
    t.string("created_at", 32).notNullable();
  });
  await knex.schema.createTable("sessions", (t) => {
    t.string("token_hash", 64).primary();
    t.string("user_id", 24)
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.string("expires_at", 32).notNullable().index();
  });
  await knex.schema.createTable("qr_codes", (t) => {
    t.string("id", 24).primary();
    t.string("user_id", 24)
      .notNullable()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE")
      .index();
    t.string("name", 100).notNullable();
    t.text("destination").notNullable();
    t.text("redirect_url").notNullable().unique();
    t.string("folder", 60).notNullable().defaultTo("");
    t.boolean("active").notNullable().defaultTo(true);
    t.text("design").notNullable();
    t.string("created_at", 32).notNullable();
    t.string("updated_at", 32).notNullable();
  });
  await knex.schema.createTable("scans", (t) => {
    t.string("id", 24).primary();
    t.string("qr_id", 24)
      .notNullable()
      .references("id")
      .inTable("qr_codes")
      .onDelete("CASCADE")
      .index();
    t.string("scanned_at", 32).notNullable().index();
    t.string("device", 20).notNullable();
    t.string("browser", 30).notNullable();
    t.text("referrer").notNullable();
  });
}
export async function down(knex) {
  for (const table of ["scans", "qr_codes", "sessions", "users"])
    await knex.schema.dropTableIfExists(table);
}
