import QRCodeStyling from "qr-code-styling";
import qrGenerator from "qrcode-generator";
import jsQR from "jsqr";
import { designSchema } from "../shared/design.js";
export function createQR(url, design) {
  const d = designSchema.parse(design);
  const matrix = qrGenerator(0, d.errorCorrection);
  matrix.addData(url, "Byte");
  matrix.make();
  const minimum = Math.ceil((d.size * 4) / (matrix.getModuleCount() + 8));
  return new QRCodeStyling({
    width: d.size,
    height: d.size,
    type: "svg",
    data: url,
    margin: Math.max(d.margin, minimum),
    qrOptions: { errorCorrectionLevel: d.errorCorrection, mode: "Byte" },
    dotsOptions: { color: d.foreground, type: d.dots },
    cornersSquareOptions: { color: d.foreground, type: d.corners },
    cornersDotOptions: { color: d.foreground, type: d.cornerDots },
    backgroundOptions: { color: d.background },
    image: d.logo || undefined,
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: d.logoSize,
      margin: 4,
      saveAsBlob: true,
    },
  });
}
async function renderedPNG(qr) {
  let timer;
  try {
    return await Promise.race([
      qr.getRawData("png"),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                "QR rendering timed out. Remove or replace the logo and try again.",
              ),
            ),
          10000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function verifyQR(qr, url) {
  const blob = await renderedPNG(qr);
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(pixels.data, pixels.width, pixels.height, {
    inversionAttempts: "dontInvert",
  });
  return result?.data === url;
}
export async function downloadQR(record, format) {
  const qr = createQR(record.redirect_url, record.design);
  if (!(await verifyQR(qr, record.redirect_url)))
    throw Error(
      "This design could not be decoded. Use square or rounded modules, remove the logo, or increase the dimensions.",
    );
  const filename = record.name.replace(/[^a-zA-Z0-9_-]/g, "-") || "relay-qr";
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const blob = await renderedPNG(qr);
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const pdf = new jsPDF({ unit: "mm", format: [120, 120] });
    pdf.addImage(data, "PNG", 10, 10, 100, 100);
    pdf.save(filename + ".pdf");
  } else await qr.download({ extension: format, name: filename });
}
export async function resizeLogo(file) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw Error("Choose a PNG, JPEG, or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw Error("Choose an image under 5 MB.");
  const image = await createImageBitmap(file);
  const c = document.createElement("canvas");
  const ratio = Math.min(1, 400 / Math.max(image.width, image.height));
  c.width = Math.max(1, Math.round(image.width * ratio));
  c.height = Math.max(1, Math.round(image.height * ratio));
  c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
  image.close();
  const data = c.toDataURL("image/png");
  if (data.length > 700000)
    throw Error("Logo is too large. Please choose a simpler image.");
  return data;
}
