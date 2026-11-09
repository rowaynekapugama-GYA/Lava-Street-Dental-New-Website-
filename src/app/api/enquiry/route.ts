/**
 * POST /api/enquiry/
 * General enquiry form on the contact page. Same as the waitlist: kept in the dashboard (Waitlist,
 * Enquiries filter), a notification to the practice inbox and a short acknowledgement to the sender.
 * The page asks people not to include health information.
 */
import {
  auPhone, clean, cleanMultiline, clientIp, detailsTable, emailHtml, escapeHtml, isEmail, looksLikeBot, mailSettings,
  melbourneTime, pageFrom, practiceFor, rateLimited, readBody, send, sendEmail,
} from '@/forms/mail'
import { formSettings, markEmailFailed, storeSignup } from '@/forms/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return new Response(JSON.stringify({ ok: false, error: 'Method not allowed.' }), { status: 405, headers: { Allow: 'POST', 'Content-Type': 'application/json' } })
}

export async function POST(req: Request) {
  const body = await readBody(req)
  if (!body) return send(400, { ok: false, error: 'We could not read that message. Please try again.' })
  if (looksLikeBot(body)) return send(200, { ok: true })
  if (rateLimited(clientIp(req))) return send(429, { ok: false, error: 'That is a few messages in a short time. Please wait a few minutes and try again.' })

  const firstName = clean(body.firstName, 80)
  const lastName = clean(body.lastName, 80)
  const email = clean(body.email, 254).toLowerCase()
  const phoneRaw = clean(body.phone, 30)
  const phone = phoneRaw ? auPhone(phoneRaw) : ''
  const message = cleanMultiline(body.message, 2000)
  const consent = body.consent === true || body.consent === 'true' || body.consent === 'on'

  const fields: Record<string, string> = {}
  if (!firstName) fields.firstName = 'We just need a first name.'
  if (!isEmail(email)) fields.email = 'Could you check that email address?'
  if (phoneRaw && !phone) fields.phone = 'Please enter an Australian number, for example 0412 345 678.'
  if (!message) fields.message = 'Let us know how we can help.'
  if (!consent) fields.consent = 'Please tick the box so we can reply.'
  if (Object.keys(fields).length) return send(422, { ok: false, error: 'Please check the highlighted fields.', fields })

  const { payload, settings: site } = await formSettings()
  const settings = mailSettings(site)
  if (!settings.ok) {
    console.error('enquiry: SMTP2GO_API_KEY is not set')
    return send(503, { ok: false, error: 'Sorry, this form is not taking messages just now.' })
  }
  const practice = practiceFor(site)
  const name = [firstName, lastName].filter(Boolean).join(' ')
  const submitted = melbourneTime()
  const messageHtml = escapeHtml(message).replace(/\n/g, '<br>')
  const id = await storeSignup(payload, { form: 'enquiry', firstName, lastName, email, phone, message, page: pageFrom(req) || '/contact/', consent, status: 'todo', emailStatus: 'sent' })

  try {
    await sendEmail(settings, {
      to: settings.to,
      cc: settings.cc,
      reply_to: email,
      subject: `New website enquiry: ${name}`,
      html: emailHtml('New enquiry from the website', [
        detailsTable([
          ['Name', escapeHtml(name)],
          ['Email', `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`],
          ['Phone', phone ? escapeHtml(phone) : 'Not given'],
          ['Received', escapeHtml(submitted)],
        ]),
        `<strong>Message</strong><br>${messageHtml}`,
        'Reply to this email to answer them directly. The enquiry is also in the website dashboard under Waitlist, Enquiries.',
      ], `Sent from the contact form on ${escapeHtml(practice.site)}`),
      text: `New enquiry from the website\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not given'}\nReceived: ${submitted}\n\nMessage:\n${message}\n`,
    })
  } catch (e) {
    console.error('enquiry: practice notification failed', (e as Error).message)
    await markEmailFailed(payload, id)
    if (id !== null) return send(200, { ok: true })
    return send(502, { ok: false, error: 'Sorry, something went wrong on our side and your message was not sent.' })
  }

  try {
    await sendEmail(settings, {
      to: [email],
      reply_to: practice.email,
      subject: 'Thanks for getting in touch with Lava Street Dental',
      html: emailHtml(`Thanks, ${escapeHtml(firstName)}.`, [
        'We have your message and will get back to you as soon as we can.',
        practice.phone ? `If it is urgent, please call us on ${escapeHtml(practice.phone)}.` : '',
        'Warm regards,<br>The team at Lava Street Dental',
      ].filter(Boolean), `Read our <a href="${practice.privacyUrl}" style="color:#575A4D">Privacy Policy</a>.`),
      text: `Thanks, ${firstName}.\n\nWe have your message and will get back to you as soon as we can.${practice.phone ? `\n\nIf it is urgent, please call us on ${practice.phone}.` : ''}\n\nWarm regards,\nThe team at Lava Street Dental\n\nPrivacy Policy: ${practice.privacyUrl}\n`,
    })
  } catch (e) {
    console.error('enquiry: acknowledgement email failed', (e as Error).message)
  }
  return send(200, { ok: true })
}
