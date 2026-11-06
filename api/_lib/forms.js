// Shared helpers for the website form functions (api/waitlist.js, api/enquiry.js).
//
// Files under api/_lib are not deployed as their own endpoints: Vercel skips
// paths that start with an underscore.
//
// Email goes through the SMTP2GO HTTP API (v3), the same relay as the other
// GYA sites. No dependencies: Node's built-in fetch. Environment variables,
// set in Vercel > Settings > Environment Variables:
//   SMTP2GO_API_KEY  SMTP2GO API key (required; the forms return 503 without it)
//   FORM_FROM        sender on the SMTP2GO-verified domain, for example
//                    "Lava Street Dental <hello@lavastreetdental.com.au>"
//   FORM_TO          optional: recipients, separated by commas. Without it the
//                    hard-coded FALLBACK_TO list below is used.
//   SMTP2GO_ENDPOINT optional: override the API address (testing only)
import config from "../../site.config.mjs";

export { config };

// ---------------------------------------------------------------- validation

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

export const clean = (v, max = 200) =>
  String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const cleanMultiline = (v, max = 2000) =>
  String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, max);

export const isEmail = (v) => v.length <= 254 && EMAIL_RE.test(v);

// Australian numbers: mobiles (04), landlines (02, 03, 07, 08), with or
// without +61. Returns the number in 0X XXXX XXXX / 04XX XXX XXX form, or ""
// if it is not a valid Australian number.
export function auPhone(v) {
  let d = String(v ?? "").replace(/[\s().-]/g, "");
  if (d.startsWith("+61")) d = "0" + d.slice(3);
  else if (d.startsWith("61") && d.length === 11) d = "0" + d.slice(2);
  if (!/^0[2-478]\d{8}$/.test(d)) return "";
  return d.startsWith("04")
    ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
    : `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
}

export const escapeHtml = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// ---------------------------------------------------------------- spam

// Best-effort rate limit: 5 submissions per address per 10 minutes, held in
// the memory of each function instance. It stops casual repeat posting; it is
// not a guarantee across instances.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const hits = new Map();

export function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }
  return recent.length > LIMIT;
}

export const clientIp = (req) =>
  String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();

// Honeypot and timing: real people do not fill the hidden field, and do not
// submit within two seconds of the page loading.
export function looksLikeBot(body) {
  if (clean(body.company)) return true;
  const started = Number(body.startedAt);
  if (Number.isFinite(started) && started > 0 && Date.now() - started < 2000) return true;
  return false;
}

// ---------------------------------------------------------------- request plumbing

export function readBody(req) {
  try {
    const b = req.body;
    if (b && typeof b === "object") return b;
    if (typeof b === "string" && b) return JSON.parse(b);
  } catch {
    return null;
  }
  return {};
}

export function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

// Recipients when FORM_TO is not set: the practice inbox and GYA.
// Add the practice's SmileOx intake address here (or in FORM_TO) once known.
export const FALLBACK_TO = ["info@lavastreetdental.com.au", "rowayne@gyaclients.com"];
const FALLBACK_FROM = "Lava Street Dental <hello@lavastreetdental.com.au>";

export function mailSettings() {
  const apiKey = String(process.env.SMTP2GO_API_KEY || "").trim();
  const listed = String(process.env.FORM_TO || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const to = listed.length ? listed : FALLBACK_TO;
  const from = String(process.env.FORM_FROM || "").trim() || FALLBACK_FROM;
  const endpoint = String(process.env.SMTP2GO_ENDPOINT || "").trim() || "https://api.smtp2go.com/v3/email/send";
  return { ok: Boolean(apiKey), apiKey, to, from, endpoint };
}

// message: { to, reply_to, subject, html, text }
export async function sendEmail(settings, message) {
  const r = await fetch(settings.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Smtp2go-Api-Key": settings.apiKey },
    body: JSON.stringify({
      sender: settings.from,
      to: message.to,
      subject: message.subject,
      html_body: message.html,
      text_body: message.text,
      custom_headers: message.reply_to ? [{ header: "Reply-To", value: message.reply_to }] : [],
    }),
  });
  const data = await r.json().catch(() => ({}));
  // SMTP2GO can answer 200 with failures listed, so check both.
  if (!r.ok || !data.data || data.data.failed > 0 || data.data.error) {
    throw new Error(`SMTP2GO ${r.status}: ${JSON.stringify(data.data || data).slice(0, 300)}`);
  }
  return data.data;
}

// ---------------------------------------------------------------- email layout

const site = config.siteUrl.replace(/\/+$/, "");
const addressLine = [config.address.streetAddress || config.address.streetFallback, `${config.address.locality} ${config.address.region} ${config.address.postcode}`].join(", ");

export const practice = {
  name: config.name,
  phone: config.phone,
  email: config.emails.public,
  address: addressLine,
  site,
  privacyUrl: `${site}/privacy-policy/`,
};

export function emailHtml(title, paragraphs, footer = "") {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#292826">${p}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F4F1EA;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #BDB4A3;border-radius:12px">
<tr><td style="padding:28px 28px 8px"><p style="margin:0 0 20px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#575A4D">Lava Street Dental</p>
<h1 style="margin:0 0 18px;font-size:22px;font-weight:500;color:#292826">${title}</h1>${body}</td></tr>
<tr><td style="padding:0 28px 24px;font-size:13px;line-height:1.6;color:#575A4D">${footer}</td></tr></table></body></html>`;
}

export function detailsTable(rows) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px;color:#292826">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#575A4D;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;vertical-align:top">${v}</td></tr>`
    )
    .join("")}</table>`;
}

export const melbourneTime = () =>
  new Intl.DateTimeFormat("en-AU", { dateStyle: "full", timeStyle: "short", timeZone: "Australia/Melbourne" }).format(new Date());
