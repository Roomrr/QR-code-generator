export async function up(knex) {
  await knex.schema.alterTable("users", (t) => {
    t.string("verified_at", 32).nullable();
    t.string("trial_started_at", 32).nullable();
    t.string("trial_ends_at", 32).nullable();
    t.string("paid_until", 32).nullable();
    t.boolean("lifetime_free").notNullable().defaultTo(false);
    t.string("role", 20).notNullable().defaultTo("user");
    t.string("status", 20).notNullable().defaultTo("active");
  });
  await knex.schema.createTable("email_otps", (t) => {
    t.string("user_id", 24)
      .primary()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    t.string("code_hash", 64).notNullable();
    t.string("expires_at", 32).notNullable();
    t.string("sent_at", 32).notNullable();
    t.integer("attempts").notNullable().defaultTo(0);
    t.integer("send_count").notNullable().defaultTo(0);
    t.string("window_started_at", 32).notNullable();
  });
  await knex.schema.createTable("app_settings", (t) => {
    t.string("key", 60).primary();
    t.text("value").notNullable();
    t.string("updated_at", 32).notNullable();
  });
  await knex.schema.createTable("payments", (t) => {
    t.string("id", 24).primary();
    t.string("user_id", 24)
      .notNullable()
      .references("id")
      .inTable("users")
      .index();
    t.string("idempotency_key", 100).nullable().unique();
    t.string("gateway_order_id", 100).nullable().unique();
    t.string("gateway_payment_id", 100).nullable().unique();
    t.integer("days").notNullable();
    t.integer("amount").notNullable();
    t.string("currency", 3).notNullable().defaultTo("INR");
    t.string("status", 24).notNullable();
    t.integer("refunded_amount").notNullable().defaultTo(0);
    t.string("credited_at", 32).nullable();
    t.string("access_starts_at", 32).nullable();
    t.string("access_ends_at", 32).nullable();
    t.text("failure_reason").notNullable().defaultTo("");
    t.string("created_at", 32).notNullable();
    t.string("updated_at", 32).notNullable();
  });
  await knex.schema.createTable("payment_refunds", (t) => {
    t.string("id", 100).primary();
    t.string("payment_id", 24)
      .notNullable()
      .references("id")
      .inTable("payments");
    t.integer("amount").notNullable();
    t.string("status", 24).notNullable();
    t.string("created_at", 32).notNullable();
    t.string("updated_at", 32).notNullable();
  });
  await knex.schema.createTable("webhook_events", (t) => {
    t.string("id", 150).primary();
    t.string("event_type", 80).notNullable();
    t.string("received_at", 32).notNullable();
  });
  await knex.schema.createTable("access_activity", (t) => {
    t.string("id", 24).primary();
    t.string("user_id", 24)
      .notNullable()
      .references("id")
      .inTable("users")
      .index();
    t.string("actor_id", 24).nullable().references("id").inTable("users");
    t.string("payment_id", 24)
      .nullable()
      .unique()
      .references("id")
      .inTable("payments");
    t.string("action", 60).notNullable();
    t.text("details").notNullable();
    t.string("created_at", 32).notNullable();
  });
  await knex.schema.createTable("admin_audit", (t) => {
    t.string("id", 24).primary();
    t.string("actor_id", 24).notNullable().references("id").inTable("users");
    t.string("target_id", 24).nullable();
    t.string("action", 60).notNullable();
    t.text("details").notNullable();
    t.string("created_at", 32).notNullable().index();
  });
}
export async function down(knex) {
  for (const table of [
    "admin_audit",
    "access_activity",
    "webhook_events",
    "payment_refunds",
    "payments",
    "app_settings",
    "email_otps",
  ])
    await knex.schema.dropTableIfExists(table);
  await knex.schema.alterTable("users", (t) => {
    for (const c of [
      "verified_at",
      "trial_started_at",
      "trial_ends_at",
      "paid_until",
      "lifetime_free",
      "role",
      "status",
    ])
      t.dropColumn(c);
  });
}
