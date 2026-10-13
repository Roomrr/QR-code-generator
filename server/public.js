import { Router } from "express";
import { randomBytes } from "node:crypto";
import qrcode from "qrcode-generator";
import { config } from "./config.js";
import { settings } from "./settings.js";
export const publicPages = Router();
export const publicPaths = [
  "/",
  "/privacy",
  "/terms",
  "/contact",
  "/refund-policy",
];
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (p) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(p / 100);
const faq = (site) => [
  [
    "What makes a QR code dynamic?",
    "Your QR code contains a permanent redirect link. You can change its destination in your dashboard without replacing the printed code.",
  ],
  [
    "Can I add my logo and brand colors?",
    "Yes. Choose your colors, module shapes, corner styles, and logo. The editor checks contrast and decodes your preview before downloads.",
  ],
  [
    "Does free access expire?",
    "No. Active accounts with verified email can create and manage QR codes for free, without a trial countdown.",
  ],
  [
    "How does pricing work?",
    "The platform is free for everyone. Verify your email to create and manage QR codes. No payment or subscription is required.",
  ],
  [
    "Can I download codes for print?",
    "Download PNG, SVG, or PDF. Test a physical sample at the intended size before printing a large batch.",
  ],
  [
    "Can the application move to a different server?",
    "Yes. Backups preserve QR identifiers, destinations, designs, and scan history. Keep the original redirect domain active and point it at the new deployment.",
  ],
];
function navigation(site) {
  return `<header class="marketing-nav"><a class="brand" href="/" aria-label="${escape(site.siteName)} home"><span class="brand-mark">▦</span>${escape(site.siteName)}<em>.</em></a><nav aria-label="Main navigation"><a href="/#features">Features</a><a href="/#how-it-works">How it works</a><a href="/#pricing">Pricing</a></nav><div><a href="/login" class="login-link">Log in</a><a href="/register" class="button primary">Create free account ↗</a></div></header>`;
}
function footer(site) {
  return `<footer class="marketing-footer"><div><a class="brand" href="/">${escape(site.siteName)}<em>.</em></a><p>Small codes. Lasting connections.</p></div><nav aria-label="Footer navigation"><a href="/privacy">Privacy Policy</a><a href="/terms">Terms & Conditions</a><a href="/contact">Contact</a><a href="/refund-policy">Refund Policy</a></nav><small>© ${new Date().getUTCFullYear()} ${escape(site.businessName || site.siteName)}. Made for the long run.</small></footer>`;
}
function homepage(site) {
  const qr = qrcode(0, "H");
  qr.addData(config.publicOrigin);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 5, margin: 20, scalable: true });
  return `
<section class="marketing-hero"><div><span class="eyebrow">CREATE ONCE. KEEP CONNECTING.</span><h1>A little code.<br/>Endless <span>possibilities.</span></h1><p>Create beautiful dynamic QR codes that grow with you. Add your brand, change destinations anytime, and bring every connection into one workspace.</p><div class="hero-actions"><a class="button primary" href="/register">Create your free account <span>↗</span></a><a class="text-link" href="#how-it-works">See how it works ↓</a></div><small>Free for everyone. No subscription required.</small></div><div class="marketing-art"><span class="floating-note">● Your brand. Your connection.</span><div class="demo-qr">${svg}<span class="demo-logo">r.</span></div><div class="demo-caption"><strong>Your next connection</strong><span>Design preview · scans to this homepage</span></div><div class="destination-card"><span>↗</span><div><small>ONE PERMANENT LINK</small><strong>A destination that can evolve.</strong></div><span>✓</span></div></div></section>
<div class="benefit-strip"><span>↗ Editable destinations</span><span>▦ Custom QR codes with logos</span><span>◉ Scan analytics</span><span>◎ Built for India</span></div>
<section id="features" class="marketing-section"><div class="section-title"><span class="eyebrow">MORE THAN A BLACK-AND-WHITE SQUARE</span><h2>Every connection, made yours.</h2><p>A custom QR code generator with room for your brand and your next idea.</p></div><div class="feature-grid">${[
    [
      "↗",
      "Change the link. Keep the code.",
      "Update a menu, campaign, or website destination without reprinting the QR code. Your permanent link stays the same.",
    ],
    [
      "▦",
      "A little more personality.",
      "Choose colors, six patterns, corner markers, and your logo. Watch your custom design come together in real time.",
    ],
    [
      "◉",
      "See the connections happen.",
      "Track total scans, daily activity, and approximate device and browser details in your workspace.",
    ],
    [
      "↓",
      "Ready for screen or print.",
      "Export PNG, SVG, or PDF. Your QR code is decoded before download, with margins and contrast checks built in.",
    ],
    [
      "▤",
      "One organized workspace.",
      "Name your codes, group them into collections, search your links, and pause or reactivate them when needed.",
    ],
    [
      "◎",
      "Built for the long run.",
      "Your published QR redirects stay active after subscription expiry. Data exports preserve designs, links, and history.",
    ],
  ]
    .map(
      ([icon, title, body]) =>
        `<article><span class="feature-icon">${icon}</span><h3>${title}</h3><p>${body}</p></article>`,
    )
    .join("")}</div></section>
<section id="how-it-works" class="marketing-section how-section"><div class="section-title"><span class="eyebrow">THREE STEPS. ONE LASTING CONNECTION.</span><h2>Make it. Share it. Keep it moving.</h2></div><div class="steps-grid">${[
    [
      "01",
      "Choose a destination",
      "Add your website, menu, form, or any HTTP(S) URL. We assign your code its own permanent redirect link.",
    ],
    [
      "02",
      "Give it your signature",
      "Customize colors, shapes, and your logo. Preview it live, then download the format you need.",
    ],
    [
      "03",
      "Stay in control",
      "Share or print your code. Change the destination from your dashboard anytime and see your scan history.",
    ],
  ]
    .map(
      ([n, title, body]) =>
        `<article><span>${n}</span><h3>${title}</h3><p>${body}</p></article>`,
    )
    .join("")}</div></section>
<section id="pricing" class="marketing-section pricing-section"><div class="section-title"><span class="eyebrow">FREE FOR EVERYONE</span><h2>Create freely. Stay connected.</h2><p>All core features. No payments or subscriptions.</p></div><div class="pricing-card"><div><span class="eyebrow">YOUR WORKSPACE, UNLOCKED</span><h3>Always free</h3><p>Get started after email verification.</p><div class="pricing-price">₹0</div><a class="button primary" href="/register">Create free account ↗</a></div><ul><li>✓ Dynamic, editable QR destinations</li><li>✓ Custom patterns, colors, and logos</li><li>✓ PNG, SVG, and PDF downloads</li><li>✓ Collections and scan history</li><li>✓ No access expiry</li><li>✓ Portable workspace exports</li></ul></div></section>
<section class="marketing-section faq-section"><div class="section-title"><span class="eyebrow">A FEW THINGS YOU MIGHT BE WONDERING</span><h2>Questions, connected.</h2></div><div class="faq-list">${faq(
    site,
  )
    .map(
      ([q, a]) =>
        `<details><summary>${escape(q)}<span>+</span></summary><p>${escape(a)}</p></details>`,
    )
    .join(
      "",
    )}</div></section><section class="closing-cta"><span class="eyebrow">YOUR NEXT CONNECTION IS WAITING</span><h2>Where will your code take you?</h2><a class="button primary" href="/register">Let's make a connection ↗</a></section>`;
}
function policy(site, path) {
  const fields = {
    "/privacy": ["Privacy Policy", "privacyPolicy"],
    "/terms": ["Terms and Conditions", "termsPolicy"],
    "/refund-policy": ["Refund Policy", "refundPolicy"],
  };
  if (path === "/contact")
    return `<section class="policy-page"><span class="eyebrow">GET IN TOUCH</span><h1>Let's stay connected.</h1><p>Contact ${escape(site.businessName || site.siteName)} for account or data questions.</p>${site.contactEmail ? `<a class="contact-email" href="mailto:${escape(site.contactEmail)}">${escape(site.contactEmail)} ↗</a>` : "<p>The operator has not yet configured a support email address.</p>"}${site.contactAddress ? `<p>${escape(site.contactAddress)}</p>` : ""}</section>`;
  const [title, key] = fields[path];
  return `<section class="policy-page"><span class="eyebrow">${escape(site.siteName.toUpperCase())}</span><h1>${title}</h1><div class="policy-copy">${
    site[key]
      ? escape(site[key])
          .split(/\n\s*\n/)
          .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
          .join("")
      : `<p>The operator has not yet published this policy. Please contact support before purchasing.</p>`
  }</div>${site.contactEmail ? `<p>Questions? <a href="mailto:${escape(site.contactEmail)}">${escape(site.contactEmail)}</a></p>` : ""}</section>`;
}
publicPages.get("/robots.txt", (req, res) =>
  res
    .type("text/plain")
    .send(
      `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /login\nDisallow: /register\nDisallow: /admin\nDisallow: /billing\nDisallow: /api/\nDisallow: /r/\nSitemap: ${config.publicOrigin}/sitemap.xml\n`,
    ),
);
publicPages.get("/sitemap.xml", (req, res) =>
  res
    .type("application/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicPaths.map((p) => `<url><loc>${escape(config.publicOrigin + p)}</loc></url>`).join("")}</urlset>`,
    ),
);
publicPages.get(publicPaths, async (req, res) => {
  const site = await settings();
  const home = req.path === "/";
  const canonical = config.publicOrigin + req.path;
  const names = {
    "/privacy": "Privacy Policy",
    "/terms": "Terms & Conditions",
    "/contact": "Contact",
    "/refund-policy": "Refund Policy",
  };
  const title = home
    ? `Dynamic QR Code Generator India — Custom QR Codes with Logo | ${site.siteName}`
    : `${names[req.path]} | ${site.siteName}`;
  const description = home
    ? `Create custom, editable QR codes with your logo. Update links without reprinting. Free for everyone. PNG, SVG, PDF and scan analytics.`
    : `${names[req.path]} for ${site.siteName}, the dynamic QR code management platform.`;
  const nonce = randomBytes(18).toString("base64");
  res.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'`,
  );
  res.set("Cache-Control", "no-cache");
  const structured = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: site.businessName || site.siteName,
      url: config.publicOrigin,
      ...(site.contactEmail ? { email: site.contactEmail } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: site.siteName,
      url: config.publicOrigin,
    },
  ];
  if (home)
    structured.push({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: site.siteName,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "INR",
        url: config.publicOrigin + "/#pricing",
      },
    });
  res
    .type("html")
    .send(
      `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escape(title)}</title><meta name="description" content="${escape(description)}"/><meta name="robots" content="index,follow"/><link rel="canonical" href="${escape(canonical)}"/><meta property="og:type" content="website"/><meta property="og:site_name" content="${escape(site.siteName)}"/><meta property="og:title" content="${escape(title)}"/><meta property="og:description" content="${escape(description)}"/><meta property="og:url" content="${escape(canonical)}"/><meta property="og:image" content="${config.publicOrigin}/social-card.svg"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${escape(title)}"/><meta name="twitter:description" content="${escape(description)}"/><meta name="twitter:image" content="${config.publicOrigin}/social-card.svg"/>${site.searchConsoleToken ? `<meta name="google-site-verification" content="${escape(site.searchConsoleToken)}"/>` : ""}<link rel="icon" href="/favicon.svg"/><link rel="preload" href="/fonts/manrope.ttf" as="font" type="font/ttf" crossorigin/><link rel="stylesheet" href="/marketing.css"/><script type="application/ld+json" nonce="${nonce}">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script></head><body>${navigation(site)}<main>${home ? homepage(site) : policy(site, req.path)}</main>${footer(site)}</body></html>`,
    );
});
