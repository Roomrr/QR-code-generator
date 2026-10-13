import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { PNG } from "pngjs";
import jsQR from "jsqr";
let qr;
test("complete QR lifecycle, exports, logo customization, and mobile workspace", async ({
  page,
  browser,
}) => {
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Browser error:", e.message);
  });
  await page.goto("/register");
  const email = `browser-${Date.now()}@example.test`;
  await page.getByLabel("Your name").fill("Browser Tester");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("a-good-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Verify email", exact: true }),
  ).toBeVisible();
  const inbox = JSON.parse(
    await fs.readFile(process.env.TEST_MAILBOX_PATH, "utf8"),
  );
  const code = inbox[email].match(/code is (\d{6})/)[1];
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My QR codes." }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/dashboard-empty.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Create your first QR code" }).click();
  await page.getByLabel("QR code name").fill("Browser campaign");
  await page
    .getByLabel("Destination URL")
    .fill("https://website-a.example/campaign");
  await page.getByLabel("Collection optional").fill("Marketing");
  await page.getByRole("button", { name: "Classic", exact: true }).click();
  await page.getByLabel("Corner markers").selectOption("square");
  await page.getByLabel("Corner centers").selectOption("square");
  await expect(page.getByText("Preview decoded successfully")).toBeVisible();
  await page
    .getByRole("button", { name: "Create QR code", exact: true })
    .click();
  await expect(page.getByText("YOUR PERMANENT LINK")).toBeVisible();
  qr = await page.evaluate(async () => {
    const r = await fetch("/api/qrs");
    return (await r.json())[0];
  });
  expect(qr.redirect_url).toContain(`/r/${qr.id}`);
  await page.getByRole("button", { name: "Colors", exact: true }).click();
  await page.getByRole("button", { name: "Indigo", exact: true }).click();
  await expect(page.getByText("Preview decoded successfully")).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Changes saved. Your permanent link is unchanged."),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/editor.png", fullPage: true });
  for (const format of ["png", "svg", "pdf"]) {
    await page
      .getByRole("combobox", { name: "Export format" })
      .selectOption(format);
    const event = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download", exact: true }).click();
    const dl = await event;
    await dl.saveAs(`test-results/qr.${format}`);
    const content = await fs.readFile(`test-results/qr.${format}`);
    expect(content.length).toBeGreaterThan(500);
    if (format === "png") {
      const image = PNG.sync.read(content);
      expect(
        jsQR(new Uint8ClampedArray(image.data), image.width, image.height).data,
      ).toBe(qr.redirect_url);
    }
    if (format === "svg") {
      expect(content.toString()).toContain("<svg");
    }
    if (format === "pdf") {
      expect(content.toString().slice(0, 4)).toBe("%PDF");
    }
  }
  await page
    .getByLabel("Destination URL")
    .fill("https://website-b.example/updated");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const updated = await page.evaluate(
    async (id) => await (await fetch(`/api/qrs/${id}`)).json(),
    qr.id,
  );
  expect(updated.redirect_url).toBe(qr.redirect_url);
  expect(updated.destination).toBe("https://website-b.example/updated");
  const redirect = await page.request.get(qr.redirect_url, { maxRedirects: 0 });
  expect(redirect.status()).toBe(302);
  expect(redirect.headers().location).toBe(updated.destination);
  await page.getByRole("button", { name: "Logo", exact: true }).click();
  const image = PNG.sync.write({
    width: 40,
    height: 40,
    data: Buffer.alloc(40 * 40 * 4, 100),
  });
  await page
    .locator(".upload-area input")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: image });
  await expect(page.getByText("Preview decoded successfully")).toBeVisible();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByText("Changes saved. Your permanent link is unchanged."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to my QR codes" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  await page
    .getByRole("button", { name: "Actions for Browser campaign" })
    .click();
  await page.getByRole("button", { name: "Scan history", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Scan history", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1 total visits")).toBeVisible();
  await page
    .getByRole("button", { name: "Settings & data", exact: true })
    .click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export workspace" }).click();
  const dl = await event;
  await dl.saveAs("test-results/workspace.json");
  const exported = JSON.parse(
    await fs.readFile("test-results/workspace.json", "utf8"),
  );
  expect(exported.codes[0].design.logo).toMatch(/^data:image\/png/);
  expect(exported.scans).toHaveLength(1);
  await page
    .getByRole("button", { name: "My QR codes", exact: false })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Search QR codes" })
    .fill("does not exist");
  await expect(page.getByText("No codes match your search.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page
    .getByRole("button", { name: "Actions for Browser campaign" })
    .click();
  await page.getByRole("button", { name: "Pause code", exact: true }).click();
  await expect(page.getByText("QR code paused")).toBeVisible();
  expect(
    (await page.request.get(qr.redirect_url, { maxRedirects: 0 })).status(),
  ).toBe(410);
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: await page.context().storageState(),
  });
  const mp = await mobile.newPage();
  await mp.goto("/app");
  await expect(mp.getByRole("heading", { name: "My QR codes." })).toBeVisible();
  await mp.screenshot({ path: "test-results/mobile.png", fullPage: true });
  expect(
    await mp.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await mp.getByRole("button", { name: "Open menu" }).click();
  await mp.getByRole("button", { name: "Settings & data" }).click();
  await expect(
    mp.getByRole("heading", { name: "Settings & data." }),
  ).toBeVisible();
  await mobile.close();
  await page
    .getByRole("button", { name: "Actions for Browser campaign" })
    .click();
  await page.getByRole("button", { name: "Delete code", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Good things start with a little code.",
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
