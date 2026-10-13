import { z } from "zod";
export const defaultDesign = {
  foreground: "#263d2c",
  background: "#ffffff",
  dots: "rounded",
  corners: "extra-rounded",
  cornerDots: "dot",
  size: 512,
  margin: 32,
  errorCorrection: "H",
  logo: "",
  logoSize: 0.2,
};
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export function luminance(hex) {
  const c = hex
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
export function contrast(a, b) {
  return (
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05)
  );
}
export const designSchema = z
  .object({
    foreground: color,
    background: color,
    dots: z.enum([
      "square",
      "dots",
      "rounded",
      "extra-rounded",
      "classy",
      "classy-rounded",
    ]),
    corners: z.enum(["square", "dot", "extra-rounded"]),
    cornerDots: z.enum(["square", "dot"]),
    size: z.number().int().min(256).max(2048),
    margin: z.number().int().min(0).max(128),
    errorCorrection: z.enum(["L", "M", "Q", "H"]),
    logo: z
      .string()
      .max(700000)
      .refine(
        (s) =>
          !s || /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(s),
        "Use a PNG, JPEG, or WebP logo under 500 KB",
      ),
    logoSize: z.number().min(0.1).max(0.22),
  })
  .superRefine((d, c) => {
    if (
      contrast(d.foreground, d.background) < 4.5 ||
      luminance(d.foreground) >= luminance(d.background)
    )
      c.addIssue({
        code: "custom",
        message:
          "Use dark modules on a lighter background with at least 4.5:1 contrast.",
      });
    if (d.logo && d.errorCorrection !== "H")
      c.addIssue({
        code: "custom",
        message: "Logos require high (H) error correction.",
      });
    if (d.margin > d.size / 4)
      c.addIssue({
        code: "custom",
        message: "Margin must be at most one quarter of the QR dimensions.",
      });
  });
export const destinationSchema = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((s) => {
    try {
      const u = new URL(s);
      return (
        ["http:", "https:"].includes(u.protocol) &&
        !!u.hostname &&
        !u.username &&
        !u.password
      );
    } catch {
      return false;
    }
  }, "Enter an HTTP or HTTPS URL without embedded credentials.");
export const qrSchema = z.object({
  name: z.string().trim().min(1).max(100),
  destination: destinationSchema,
  folder: z.string().trim().max(60).default(""),
  active: z.boolean().default(true),
  design: designSchema,
});
