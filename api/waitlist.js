// POST /api/waitlist
// Founding patients waitlist on the home page. Sends a notification to the
// practice inbox and a short confirmation to the person who signed up.
// Email goes out over SMTP (see api/_lib/forms.js).
// No health information is collected: name, email, optional phone, consent.

import {
  auPhone, clean, clientIp, detailsTable, emailHtml, escapeHtml, isEmail, looksLikeBot,
  mailSettings, melbourneTime, practice, rateLimited, readBody, send, sendEmail,
} from "./_lib/forms.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { ok: false, error: "Method not allowed." });
  }

  const body = readBody(req);
  if (!body) return send(res, 400, { ok: false, error: "We could not read that submission. Please try again." });

  // Spam: answer bots with a quiet success so they learn nothing.
  if (looksLikeBot(body)) return send(res, 200, { ok: true });
  if (rateLimited(clientIp(req))) {
    return send(res, 429, { ok: false, error: "That is a few sign-ups in a short time. Please wait a few minutes and try again." });
  }

  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80);
  const email = clean(body.email, 254).toLowerCase();
  const phoneRaw = clean(body.phone, 30);
  const phone = phoneRaw ? auPhone(phoneRaw) : "";
  const consent = body.consent === true || body.consent === "true" || body.consent === "on";

  const fields = {};
  if (!firstName) fields.firstName = "We just need a first name.";
  if (!lastName) fields.lastName = "And a last name.";
  if (!isEmail(email)) fields.email = "Could you check that email address?";
  if (phoneRaw && !phone) fields.phone = "Please enter an Australian number, for example 0412 345 678.";
  if (!consent) fields.consent = "Please tick the box so we can contact you.";
  if (Object.keys(fields).length) return send(res, 422, { ok: false, error: "Please check the highlighted fields.", fields });

  const settings = mailSettings();
  if (!settings.ok) {
    console.error("waitlist: SMTP_HOST, SMTP_USER, SMTP_PASS, WAITLIST_TO_EMAIL or WAITLIST_FROM_EMAIL is not set");
    return send(res, 503, { ok: false, error: "Sorry, the waitlist is not taking sign-ups just now." });
  }

  const name = `${firstName} ${lastName}`;
  const submitted = melbourneTime();

  try {
    await sendEmail(settings, {
      to: settings.to,
      reply_to: email,
      subject: `New waitlist sign-up: ${name}`,
      html: emailHtml(
        "New founding patients waitlist sign-up",
        [
          detailsTable([
            ["Name", escapeHtml(name)],
            ["Email", `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`],
            ["Phone", phone ? escapeHtml(phone) : "Not given"],
            ["Consent", "Agreed to be contacted about opening and appointments"],
            ["Received", escapeHtml(submitted)],
          ]),
          "Reply to this email to answer them directly.",
        ],
        `Sent from the waitlist form on ${escapeHtml(practice.site)}`
      ),
      text: `New founding patients waitlist sign-up\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "Not given"}\nConsent: agreed to be contacted about opening and appointments\nReceived: ${submitted}\n`,
    });
  } catch (e) {
    console.error("waitlist: practice notification failed", e.message);
    return send(res, 502, { ok: false, error: "Sorry, something went wrong on our side and your details were not sent." });
  }

  // The person is on the list once the practice has the notification, so a
  // failed confirmation email is logged rather than reported as an error.
  try {
    await sendEmail(settings, {
      to: [email],
      reply_to: practice.email,
      subject: "You're on the list at Lava Street Dental",
      html: emailHtml(
        `You're on the list, ${escapeHtml(firstName)}.`,
        [
          "Thank you for joining the founding patients waitlist at Lava Street Dental.",
          `We open at ${escapeHtml(practice.address)} in December 2026. You will hear from us before the books open publicly, so you can choose a time that suits you and your family.`,
          `If you have a question in the meantime, simply reply to this email${practice.phone ? ` or call us on ${escapeHtml(practice.phone)}` : ""}.`,
          "Warm regards,<br>Dr Meg and the team at Lava Street Dental",
        ],
        `You are receiving this because you joined our waitlist at ${escapeHtml(practice.site.replace(/^https?:\/\//, ""))}. To be taken off the list, reply with "remove". Read our <a href="${practice.privacyUrl}" style="color:#575A4D">Privacy Policy</a>.`
      ),
      text: `You're on the list, ${firstName}.\n\nThank you for joining the founding patients waitlist at Lava Street Dental.\n\nWe open at ${practice.address} in December 2026. You will hear from us before the books open publicly, so you can choose a time that suits you and your family.\n\nIf you have a question in the meantime, simply reply to this email${practice.phone ? ` or call us on ${practice.phone}` : ""}.\n\nWarm regards,\nDr Meg and the team at Lava Street Dental\n\nTo be taken off the list, reply with "remove". Privacy Policy: ${practice.privacyUrl}\n`,
    });
  } catch (e) {
    console.error("waitlist: confirmation email failed", e.message);
  }

  return send(res, 200, { ok: true });
}
