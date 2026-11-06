// POST /api/enquiry
// General enquiry form on the contact page. Same email setup as the waitlist:
// a notification to the practice inbox and a short acknowledgement to the
// sender. The page asks people not to include health information.

import {
  auPhone, clean, cleanMultiline, clientIp, detailsTable, emailHtml, escapeHtml, isEmail,
  looksLikeBot, mailSettings, melbourneTime, practice, rateLimited, readBody, send, sendEmail,
} from "./_lib/forms.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { ok: false, error: "Method not allowed." });
  }

  const body = readBody(req);
  if (!body) return send(res, 400, { ok: false, error: "We could not read that message. Please try again." });
  if (looksLikeBot(body)) return send(res, 200, { ok: true });
  if (rateLimited(clientIp(req))) {
    return send(res, 429, { ok: false, error: "That is a few messages in a short time. Please wait a few minutes and try again." });
  }

  const firstName = clean(body.firstName, 80);
  const lastName = clean(body.lastName, 80);
  const email = clean(body.email, 254).toLowerCase();
  const phoneRaw = clean(body.phone, 30);
  const phone = phoneRaw ? auPhone(phoneRaw) : "";
  const message = cleanMultiline(body.message, 2000);
  const consent = body.consent === true || body.consent === "true" || body.consent === "on";

  const fields = {};
  if (!firstName) fields.firstName = "We just need a first name.";
  if (!isEmail(email)) fields.email = "Could you check that email address?";
  if (phoneRaw && !phone) fields.phone = "Please enter an Australian number, for example 0412 345 678.";
  if (!message) fields.message = "Let us know how we can help.";
  if (!consent) fields.consent = "Please tick the box so we can reply.";
  if (Object.keys(fields).length) return send(res, 422, { ok: false, error: "Please check the highlighted fields.", fields });

  const settings = mailSettings();
  if (!settings.ok) {
    console.error("enquiry: SMTP_HOST, SMTP_USER, SMTP_PASS, WAITLIST_TO_EMAIL or WAITLIST_FROM_EMAIL is not set");
    return send(res, 503, { ok: false, error: "Sorry, this form is not taking messages just now." });
  }

  const name = [firstName, lastName].filter(Boolean).join(" ");
  const submitted = melbourneTime();
  const messageHtml = escapeHtml(message).replace(/\n/g, "<br>");

  try {
    await sendEmail(settings, {
      to: settings.to,
      reply_to: email,
      subject: `New website enquiry: ${name}`,
      html: emailHtml(
        "New enquiry from the website",
        [
          detailsTable([
            ["Name", escapeHtml(name)],
            ["Email", `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`],
            ["Phone", phone ? escapeHtml(phone) : "Not given"],
            ["Received", escapeHtml(submitted)],
          ]),
          `<strong>Message</strong><br>${messageHtml}`,
          "Reply to this email to answer them directly.",
        ],
        `Sent from the contact form on ${escapeHtml(practice.site)}`
      ),
      text: `New enquiry from the website\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || "Not given"}\nReceived: ${submitted}\n\nMessage:\n${message}\n`,
    });
  } catch (e) {
    console.error("enquiry: practice notification failed", e.message);
    return send(res, 502, { ok: false, error: "Sorry, something went wrong on our side and your message was not sent." });
  }

  try {
    await sendEmail(settings, {
      to: [email],
      reply_to: practice.email,
      subject: "Thanks for getting in touch with Lava Street Dental",
      html: emailHtml(
        `Thanks, ${escapeHtml(firstName)}.`,
        [
          "We have your message and will get back to you as soon as we can.",
          practice.phone ? `If it is urgent, please call us on ${escapeHtml(practice.phone)}.` : "",
          "Warm regards,<br>The team at Lava Street Dental",
        ].filter(Boolean),
        `Read our <a href="${practice.privacyUrl}" style="color:#575A4D">Privacy Policy</a>.`
      ),
      text: `Thanks, ${firstName}.\n\nWe have your message and will get back to you as soon as we can.${practice.phone ? `\n\nIf it is urgent, please call us on ${practice.phone}.` : ""}\n\nWarm regards,\nThe team at Lava Street Dental\n\nPrivacy Policy: ${practice.privacyUrl}\n`,
    });
  } catch (e) {
    console.error("enquiry: acknowledgement email failed", e.message);
  }

  return send(res, 200, { ok: true });
}
