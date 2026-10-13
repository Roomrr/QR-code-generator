import { z } from "zod";
import { db } from "./db.js";
import { qrSchema } from "../shared/design.js";
const id = z.string().regex(/^[A-Za-z0-9_-]{21}$/);
const timestamp = z.iso.datetime();
const record = qrSchema.extend({
  id,
  redirect_url: z.url(),
  created_at: timestamp,
  updated_at: timestamp,
});
const scan = z.object({
  id,
  qr_id: id,
  scanned_at: timestamp,
  device: z.enum(["Mobile", "Desktop", "Tablet"]),
  browser: z.enum(["Edge", "Firefox", "Chrome", "Safari", "Other"]),
  referrer: z.string().max(2048),
});
const transferSchema = z.object({
  format: z.literal("relay-account-v1"),
  codes: z.array(record).max(10000),
  scans: z.array(scan).max(200000),
});
export async function exportAccount(userId) {
  const codes = await db("qr_codes").where({ user_id: userId });
  const scans = await db("scans").whereIn(
    "qr_id",
    codes.map((q) => q.id),
  );
  return {
    format: "relay-account-v1",
    exported_at: new Date().toISOString(),
    codes: codes.map(({ user_id, design, active, ...q }) => ({
      ...q,
      active: !!active,
      design: JSON.parse(design),
    })),
    scans,
  };
}
export async function importAccount(userId, input) {
  const data = transferSchema.parse(input);
  const ids = new Set(data.codes.map((q) => q.id));
  if (
    ids.size !== data.codes.length ||
    new Set(data.scans.map((s) => s.id)).size !== data.scans.length
  )
    throw new z.ZodError([
      { code: "custom", path: [], message: "Duplicate IDs in import." },
    ]);
  if (data.scans.some((s) => !ids.has(s.qr_id)))
    throw new z.ZodError([
      {
        code: "custom",
        path: [],
        message: "A scan references a missing QR code.",
      },
    ]);
  for (const q of data.codes) {
    const u = new URL(q.redirect_url);
    if (
      !["http:", "https:"].includes(u.protocol) ||
      u.pathname !== `/r/${q.id}` ||
      u.search ||
      u.hash ||
      u.username ||
      u.password
    )
      throw new z.ZodError([
        {
          code: "custom",
          path: [],
          message: "Permanent URL must end in /r/<original-id>.",
        },
      ]);
  }
  await db.transaction(async (trx) => {
    for (const q of data.codes) {
      if (
        (await trx("qr_codes").where({ id: q.id }).first()) ||
        (await trx("qr_codes").where({ redirect_url: q.redirect_url }).first())
      )
        throw new z.ZodError([
          {
            code: "custom",
            path: [],
            message:
              "Import contains existing QR codes. Restore to an empty account or use the full database restore tool.",
          },
        ]);
      await trx("qr_codes").insert({
        ...q,
        user_id: userId,
        design: JSON.stringify(q.design),
      });
    }
    for (let i = 0; i < data.scans.length; i += 50)
      await trx("scans").insert(data.scans.slice(i, i + 50));
  });
  return { importedCodes: data.codes.length, importedScans: data.scans.length };
}
