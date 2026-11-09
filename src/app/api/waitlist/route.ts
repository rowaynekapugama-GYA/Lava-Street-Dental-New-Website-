/**
 * POST /api/waitlist/
 * Founding patients waitlist on the home page. Keeps the sign-up in the dashboard (Waitlist), sends a
 * notification to the practice inbox and a short confirmation to the person who signed up.
 * No health information is collected: name, email, optional phone, consent.
 */
import {
  auPhone, clean, clientIp, detailsTable, emailHtml, escapeHtml, isEmail, looksLikeBot, mailSettings, melbourneTime,
  pageFrom, practiceFor, rateLimited, readBody, send, sendEmail,
} from '@/forms/mail'
import { formSettings, markEmailFailed, storeSignup } from '@/forms/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(JSON.stringify({ ok: false, error: 'Method not allowed.' }), { status: 405, headers: { Allow: 'POST', 'Content-Type': 'application/json' } })
}

export async function POST(req: Request) {
  const body = await readBody(req)
  if (!body) return send(400, { ok: false, error: 'We could not read that submission. Please try again.' })
  if (looksLikeBot(body)) return send(200, { ok: true })
  if (rateLimited(clientIp(req))) return send(429, { ok: false, error: 'That is a few sign-ups in a short time. Please wait a few minutes and try again.' })

  const firstName = clean(body.firstName, 80)
  const lastName = clean(body.lastName, 80)
  const email = clean(body.email, 254).toLowerCase()
  const phoneRaw = clean(body.phone, 30)
  const phone = phoneRaw ? auPhone(phoneRaw) : ''
  const consent = body.consent === true || body.consent === 'true' || body.consent === 'on'

  const fields: Record<string, string> = {}
  if (!firstName) fields.firstName = 'We just need a first name.'
  if (!lastName) fields.lastName = 'And a last name.'
  if (!isEmail(email)) fields.email = 'Could you check that email address?'
  if (phoneRaw && !phone) fields.phone = 'Please enter an Australian number, for example 0412 345 678.'
  if (!consent) fields.consent = 'Please tick the box so we can contact you.'
  if (Object.keys(fields).length) return send(422, { ok: false, error: 'Please check the highlighted fields.', fields })

  const { payload, settings: site } = await formSettings()
  const settings = mailSettings(site)
  if (!settings.ok) {
    console.error('waitlist: SMTP2GO_API_KEY is not set')
    return send(503, { ok: false, error: 'Sorry, the waitlist is not taking sign-ups just now.' })
  }
  const practice = practiceFor(site)
  const name = `${firstName} ${lastName}`
  const submitted = melbourneTime()
  const page = pageFrom(req) || '/'
  const id = await storeSignup(payload, { form: 'waitlist', firstName, lastName, email, phone, page, consent, status: 'todo', emailStatus: 'sent' })

  try {
    await sendEmail(settings, {
      to: settings.to,
      cc: settings.cc,
      reply_to: email,
      subject: `New waitlist sign-up: ${name}`,
      html: emailHtml('New founding patients waitlist sign-up', [
        detailsTable([
          ['Name', escapeHtml(name)],
          ['Email', `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`],
          ['Phone', phone ? escapeHtml(phone) : 'Not given'],
          ['Consent', 'Agreed to be contacted about opening and appointments'],
          ['Received', escapeHtml(submitted)],
        ]),
        'Reply to this email to answer them directly. The sign-up is also in the website dashboard under Waitlist.',
      ], `Sent from the waitlist form on ${escapeHtml(practice.site)}`),
      text: `New founding patients waitlist sign-up\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not given'}\nConsent: agreed to be contacted about opening and appointments\nReceived: ${submitted}\n`,
    })
  } catch (e) {
    console.error('waitlist: practice notification failed', (e as Error).message)
    await markEmailFailed(payload, id)
    // kept in the dashboard, so the person is on the list even though the email did not go
    if (id !== null) return send(200, { ok: true })
    return send(502, { ok: false, error: 'Sorry, something went wrong on our side and your details were not sent.' })
  }

  const when = practice.openingDate ? `in ${escapeHtml(practice.openingDate)}` : 'soon'
  try {
    await sendEmail(settings, {
      to: [email],
      reply_to: practice.email,
      subject: "You're on the list at Lava Street Dental",
      html: emailHtml(`You're on the list, ${escapeHtml(firstName)}.`, [
        'Thank you for joining the founding patients waitlist at Lava Street Dental.',
        `We open at ${escapeHtml(practice.address)} ${when}. You will hear from us before the books open publicly, so you can choose a time that suits you and your family.`,
        `If you have a question in the meantime, simply reply to this email${practice.phone ? ` or call us on ${escapeHtml(practice.phone)}` : ''}.`,
        'Warm regards,<br>Dr Meg and the team at Lava Street Dental',
      ], `You are receiving this because you joined our waitlist at ${escapeHtml(practice.site.replace(/^https?:\/\//, ''))}. To be taken off the list, reply with "remove". Read our <a href="${practice.privacyUrl}" style="color:#575A4D">Privacy Policy</a>.`),
      text: `You're on the list, ${firstName}.\n\nThank you for joining the founding patients waitlist at Lava Street Dental.\n\nWe open at ${practice.address} ${practice.openingDate ? `in ${practice.openingDate}` : 'soon'}. You will hear from us before the books open publicly, so you can choose a time that suits you and your family.\n\nIf you have a question in the meantime, simply reply to this email${practice.phone ? ` or call us on ${practice.phone}` : ''}.\n\nWarm regards,\nDr Meg and the team at Lava Street Dental\n\nTo be taken off the list, reply with "remove". Privacy Policy: ${practice.privacyUrl}\n`,
    })
  } catch (e) {
    console.error('waitlist: confirmation email failed', (e as Error).message)
  }
  return send(200, { ok: true })
}
