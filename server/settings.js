import { db } from "./db.js";
import { config } from "./config.js";
import { z } from "zod";
export const settingSchema = z.object({
  siteName: z.string().trim().min(1).max(60),
  contactEmail: z.union([z.email(), z.literal("")]),
  businessName: z.string().trim().max(150),
  contactAddress: z.string().trim().max(1000),
  privacyPolicy: z.string().max(20000),
  termsPolicy: z.string().max(20000),
  refundPolicy: z.string().max(20000),
  searchConsoleToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]*$/)
    .max(200),
});
export async function settings(trx = db) {
  const row = await trx("app_settings").where({ key: "public" }).first();
  return row
    ? settingSchema.parse(JSON.parse(row.value))
    : {
        siteName: "Relay",
        contactEmail: process.env.CONTACT_EMAIL || "",
        businessName: process.env.BUSINESS_NAME || "",
        contactAddress: "",
        privacyPolicy: "",
        termsPolicy: "",
        refundPolicy: "",
        searchConsoleToken: process.env.GOOGLE_SITE_VERIFICATION || "",
      };
}
