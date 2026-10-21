// Builds the Lava Street Dental site from src/ into dist/.
//
//   npm run build
//
// 1. Copies src/ to dist/.
// 2. Fills every page from site.config.mjs (phone, email, address, hours,
//    opening date) and hides anything whose value is empty.
// 3. Adds canonical, Open Graph and Twitter tags to every page, and the
//    Dentist JSON-LD to the home, contact and location pages.
// 4. Writes sitemap.xml and robots.txt for the canonical domain.
// 5. Checks the result and stops with an error if anything is wrong, so a
//    broken build never deploys.
//
// No dependencies: Node 18 or later only.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "dist");
const config = (await import(pathToFileURL(path.join(ROOT, "site.config.mjs")).href)).default;

const errors = [];
const notices = [];
const err = (msg) => errors.push(msg);

// ---------------------------------------------------------------- helpers

const escHtml = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const escJson = (v) => JSON.stringify(String(v)).slice(1, -1);
const decode = (v) =>
  String(v)
    .replace(/&middot;/g, "·")
    .replace(/&rsquo;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name === ".DS_Store") continue;
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function telHref(phone) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (/^(13|18)\d+$/.test(digits)) return `tel:${digits}`; // 13, 1300, 1800 numbers
  if (digits.startsWith("0")) return `tel:+61${digits.slice(1)}`;
  return `tel:${digits}`;
}

// ---------------------------------------------------------------- config

const siteUrl = String(config.siteUrl || "").replace(/\/+$/, "");
if (!/^https:\/\/[^/]+$/.test(siteUrl)) err(`site.config.mjs: siteUrl must look like https://example.com.au (got "${config.siteUrl}")`);

const a = config.address || {};
const phone = String(config.phone || "").trim();
const hours = (config.hours || []).map((h) => String(h).trim()).filter(Boolean);
const addressStreet = String(a.streetAddress || "").trim() || a.streetFallback;
const ctx = {
  name: config.name,
  phone,
  phoneHref: telHref(phone),
  email: String(config.emails?.public || "").trim(),
  streetAddress: String(a.streetAddress || "").trim(),
  addressStreet,
  addressLine: `${addressStreet}, ${a.locality} ${a.region} ${a.postcode}`,
  hours: hours.length ? "yes" : "",
  hoursHtml: hours.map(escHtml).join("<br>"),
  openingDate: String(config.openingDate || "").trim(),
};
if (phone && !/\d{6,}/.test(phone.replace(/\D/g, ""))) err(`site.config.mjs: phone must be a number or empty, not "${phone}"`);
if (ctx.email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(ctx.email)) err(`site.config.mjs: emails.public is not a valid address`);

// ---------------------------------------------------------------- templating

function render(text, file, json = false) {
  let s = text;
  const section = /\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/;
  let m;
  while ((m = section.exec(s))) {
    const [all, kind, key, body] = m;
    if (!(key in ctx)) err(`${file}: unknown section {{${kind}${key}}}`);
    const on = Boolean(ctx[key]);
    s = s.replace(all, (kind === "#" ? on : !on) ? body : "");
  }
  s = s.replace(/\{\{\{(\w+)\}\}\}/g, (all, key) => {
    if (!(key in ctx)) err(`${file}: unknown value {{{${key}}}}`);
    return json ? escJson(ctx[key] ?? "") : String(ctx[key] ?? "");
  });
  s = s.replace(/\{\{(\w+)\}\}/g, (all, key) => {
    if (!(key in ctx)) err(`${file}: unknown value {{${key}}}`);
    return json ? escJson(ctx[key] ?? "") : escHtml(ctx[key] ?? "");
  });
  return s;
}

function renderPage(html, file) {
  // JSON-LD blocks get JSON escaping, everything else HTML escaping.
  return html
    .split(/(<script type="application\/ld\+json">[\s\S]*?<\/script>)/)
    .map((part) => (part.startsWith('<script type="application/ld+json">') ? render(part, file, true) : render(part, file)))
    .join("");
}

// ---------------------------------------------------------------- SEO tags

const urlFor = (rel) => {
  const p = rel.split(path.sep).join("/");
  if (p === "index.html") return `${siteUrl}/`;
  return `${siteUrl}/${p.replace(/index\.html$/, "")}`;
};

function dentistJsonLd() {
  const sameAs = Object.values(config.socials || {}).map((v) => String(v).trim()).filter(Boolean);
  const address = {
    "@type": "PostalAddress",
    ...(ctx.streetAddress ? { streetAddress: ctx.streetAddress } : {}),
    addressLocality: a.locality,
    addressRegion: a.region,
    postalCode: a.postcode,
    addressCountry: a.country,
  };
  const data = {
    "@context": "https://schema.org",
    "@type": "Dentist",
    "@id": `${siteUrl}/#dentist`,
    name: config.name,
    url: `${siteUrl}/`,
    image: `${siteUrl}${config.shareImage.path}`,
    logo: `${siteUrl}${config.logo}`,
    ...(ctx.email ? { email: ctx.email } : {}),
    ...(phone ? { telephone: phone } : {}),
    address,
    areaServed: (config.areaServed || []).map((n) => ({ "@type": "City", name: n })),
    ...((config.hoursSchema || []).length ? { openingHours: config.hoursSchema } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function seoBlock(html, rel) {
  const url = urlFor(rel);
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  const desc = (html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || "";
  const ogTitle = (html.match(/<meta property="og:title" content="([^"]*)">/) || [])[1];
  const ogDesc = (html.match(/<meta property="og:description" content="([^"]*)">/) || [])[1];
  const img = `${siteUrl}${config.shareImage.path}`;
  const imgAlt = escHtml(config.shareImage.alt);
  const lines = [
    `<link rel="canonical" href="${url}">`,
    ...(ogTitle ? [] : [`<meta property="og:title" content="${title}">`]),
    ...(ogDesc ? [] : [`<meta property="og:description" content="${desc}">`]),
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:site_name" content="${escHtml(config.name)}">`,
    `<meta property="og:locale" content="en_AU">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="${config.shareImage.width}">`,
    `<meta property="og:image:height" content="${config.shareImage.height}">`,
    `<meta property="og:image:alt" content="${imgAlt}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${ogTitle || title}">`,
    `<meta name="twitter:description" content="${ogDesc || desc}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<meta name="twitter:image:alt" content="${imgAlt}">`,
  ];
  // Dentist JSON-LD on the home page, the contact page and the location pages.
  if (rel === "index.html" || rel === path.join("contact", "index.html") || /^dentist-[^/\\]+[/\\]index\.html$/.test(rel)) lines.push(dentistJsonLd());
  return lines.join("\n");
}

// ---------------------------------------------------------------- build

await fs.rm(OUT, { recursive: true, force: true });
await fs.cp(SRC, OUT, { recursive: true, filter: (p) => path.basename(p) !== ".DS_Store" });

const files = await walk(OUT);
const pages = files.filter((f) => f.endsWith(".html"));
const SEO_MARK = /<!-- @seo:[^>]*-->/;

for (const file of pages) {
  const rel = path.relative(OUT, file);
  let html = renderPage(await fs.readFile(file, "utf8"), rel);
  if (rel !== "404.html") {
    if (!SEO_MARK.test(html)) err(`${rel}: missing the <!-- @seo --> marker in <head>`);
    html = html.replace(SEO_MARK, () => seoBlock(html, rel));
  }
  await fs.writeFile(file, html);
}

const publicPages = pages
  .map((f) => path.relative(OUT, f))
  .filter((rel) => rel !== "404.html")
  .sort((x, y) => (x === "index.html" ? -1 : y === "index.html" ? 1 : x.localeCompare(y)));
const today = new Date().toISOString().slice(0, 10);
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  publicPages.map((rel) => `  <url><loc>${urlFor(rel)}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
  `\n</urlset>\n`;
await fs.writeFile(path.join(OUT, "sitemap.xml"), sitemap);
await fs.writeFile(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);

// ---------------------------------------------------------------- checks

// Strings that must never ship. Built from parts so this file does not
// itself contain them and trip a project-wide search.
const j = (...p) => p.join("");
const BANNED = [
  [new RegExp(j("lavastreetdental", "\\.com(?!\\.au)"), "i"), "practice domain without .au"],
  [new RegExp(j("vercel", "\\.app"), "i"), "hard-coded Vercel preview address"],
  [new RegExp(j("no", "index"), "i"), "robots no-index directive"],
  [new RegExp(j("lor", "em"), "i"), "dummy Latin filler text"],
  [new RegExp(j("\\bT", "BA\\b")), "to-be-announced placeholder"],
];

const titles = new Map();
const descs = new Map();
const outFiles = await walk(OUT);
const textFiles = outFiles.filter((f) => /\.(html|xml|txt|js|css|json|webmanifest)$/.test(f));

for (const file of textFiles) {
  const rel = path.relative(OUT, file);
  const s = await fs.readFile(file, "utf8");
  if (/\{\{\{?[#^/]?\w+\}\}/.test(s)) err(`${rel}: unrendered {{ }} token`);
  for (const [re, what] of BANNED) if (re.test(s)) err(`${rel}: ${what}`);
  if (/\[(PHONE NUMBER|EMAIL ADDRESS|STREET ADDRESS|OPENING HOURS|OPENING DATE)[^\]]*\]/.test(s)) err(`${rel}: contact placeholder left in`);
}

for (const file of pages) {
  const rel = path.relative(OUT, file);
  const s = await fs.readFile(file, "utf8");
  const h1 = (s.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) err(`${rel}: ${h1} <h1> elements (expected exactly 1)`);
  const title = (s.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  const desc = (s.match(/<meta name="description" content="([^"]*)">/) || [])[1];
  if (!title) err(`${rel}: missing <title>`);
  if (!desc) err(`${rel}: missing meta description`);
  if (rel !== "404.html") {
    if (title) titles.set(title, [...(titles.get(title) || []), rel]);
    if (desc) descs.set(desc, [...(descs.get(desc) || []), rel]);
    const canon = (s.match(/<link rel="canonical"/g) || []).length;
    if (canon !== 1) err(`${rel}: ${canon} canonical tags (expected 1)`);
  }

  for (const block of s.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
    const body = block.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    try {
      JSON.parse(body);
    } catch (e) {
      err(`${rel}: invalid JSON-LD (${e.message})`);
    }
    if (/\[[A-Z][A-Z ]{3,}/.test(body)) err(`${rel}: placeholder text inside JSON-LD`);
  }

  for (const tag of s.match(/<img\b[^>]*>/g) || []) {
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) err(`${rel}: <img> without width and height: ${tag.slice(0, 90)}`);
  }

  // Internal links and assets must exist.
  const refs = [...s.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const m of s.matchAll(/\ssrcset="([^"]+)"/g)) refs.push(...m[1].split(",").map((x) => x.trim().split(/\s+/)[0]));
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|#|data:)/.test(ref)) continue;
    const clean = decodeURI(ref.split("#")[0].split("?")[0]);
    if (!clean) continue;
    let target = clean.startsWith("/") ? path.join(OUT, clean) : path.join(path.dirname(file), clean);
    try {
      if ((await fs.stat(target)).isDirectory()) target = path.join(target, "index.html");
      await fs.access(target);
    } catch {
      err(`${rel}: broken link or asset "${ref}"`);
    }
  }

  // Editorial placeholders still visible to visitors (client to supply).
  const visible = s.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
  for (const m of visible.matchAll(/\[[A-Z][^\]<]{3,}\]/g)) notices.push(`${rel}: ${m[0].slice(0, 90)}`);
}

for (const [t, list] of titles) if (list.length > 1) err(`duplicate <title> "${t}" on ${list.join(", ")}`);
for (const [d, list] of descs) if (list.length > 1) err(`duplicate meta description on ${list.join(", ")}`);

// Every config-referenced asset must ship.
for (const p of [config.shareImage.path, config.logo]) {
  try {
    await fs.access(path.join(OUT, p));
  } catch {
    err(`site.config.mjs references a missing file: ${p}`);
  }
}

// ---------------------------------------------------------------- report

console.log(`Built ${pages.length} pages into dist/ for ${siteUrl}`);
console.log(`Phone: ${phone || "(empty, phone links hidden)"}   Email: ${ctx.email || "(empty)"}   Hours: ${hours.length ? hours.join("; ") : "(empty, hidden)"}`);
console.log(`sitemap.xml: ${publicPages.length} URLs   robots.txt: indexing allowed`);
if (notices.length) {
  console.log(`\nContent notices: ${notices.length} editorial placeholder(s) still visible, for the client to supply:`);
  for (const n of notices) console.log(`  - ${n}`);
}
if (errors.length) {
  console.error(`\nBUILD FAILED: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  x ${e}`);
  process.exit(1);
}
console.log("\nBuild OK: 0 errors, 0 warnings.");
