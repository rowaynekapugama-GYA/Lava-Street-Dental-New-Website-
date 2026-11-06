# Lava Street Dental website

Static HTML site for Lava Street Dental, Warrnambool. Pages live in `src/`,
business details live in `site.config.mjs`, and `npm run build` renders the
finished site into `dist/`. The waitlist and contact forms post to two Vercel
functions in `api/`, which send email through the SMTP2GO API. Vercel runs the build
and deploys the functions on every push.

## Structure

| Path | What it is |
|---|---|
| `site.config.mjs` | Single source of truth: practice name, phone, emails, address, hours, opening date, pre-opening switch, socials, share image |
| `src/` | Page templates, CSS, JS, images, favicon, 404 page |
| `scripts/build.mjs` | Build: fills pages from the config, adds SEO tags and JSON-LD, writes `sitemap.xml` and `robots.txt`, checks everything |
| `api/waitlist.js`, `api/enquiry.js` | Vercel functions for the home page waitlist and the contact form. Shared code in `api/_lib/forms.js` |
| `.env.example` | The environment variables the forms need, with descriptions |
| `vercel.json` | Build command, output folder, clean URLs, redirects |
| `dist/` | Build output. Not committed |

## Changing business details

Edit `site.config.mjs`, commit, push. Vercel rebuilds and the change appears
on every page, in the footer, header, contact page and JSON-LD. Examples:

```js
phone: "0X XXXX XXXX",                 // your number in this format; shows every Call button and tel: link
address: { streetAddress: "12 Lava Street", ... },
hours: ["Monday to Thursday, 8am to 5.30pm", "Friday, 8am to 4pm"],
```

Empty values hide what depends on them. Nothing placeholder-like is shown.

### Opening day

`preOpening: true` keeps the site in pre-opening mode: booking buttons read
"Join the waitlist" and copy says the practice opens in December 2026. When
the practice opens, set `preOpening: false` and push. Buttons return to their
original "Book ..." wording, pre-opening sentences switch back, and the
"Ready to book?" and emergency call lines appear once a phone number is set.
The home page waitlist section itself is separate copy and needs its own
update at opening.

## Template tokens (in `src/`)

`{{phone}}` value, `{{{hoursHtml}}}` raw HTML, `{{#phone}}...{{/phone}}`
shown only when set, `{{^phone}}...{{/phone}}` shown only when empty.
`{{#preOpening}}...{{/preOpening}}` and `{{^preOpening}}...{{/preOpening}}`
switch pre-opening and open-practice wording.
Unknown tokens fail the build.

## Build locally

```bash
npm install
npm run build        # writes dist/ and prints any problems
```

Node 18 or later. No dependencies. The build exits with an error, and Vercel
will not deploy, if it finds unrendered tokens, contact placeholders,
the practice domain without .au, a Vercel preview address, a robots no-index
directive, dummy filler text, to-be-announced placeholders, invalid JSON-LD,
duplicate titles or descriptions, a missing canonical, anything other than
one H1 per page, images without dimensions, or broken internal links. It
also lists editorial placeholders still waiting on the client.

## Deploy

Vercel picks up `vercel.json`, so no project settings are needed:

| Setting | Value |
|---|---|
| Framework preset | Other (set by `"framework": null`) |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Functions | everything in `api/` (files in `api/_lib` are shared code, not endpoints) |

Push to `main` and the Git integration deploys.

## Environment variables

Set these in Vercel > Project > Settings > Environment Variables, for the
Production environment (and Preview if you want the forms to work on preview
links). Redeploy after adding or changing them.

| Variable | What it is |
|---|---|
| `SMTP2GO_API_KEY` | Required. SMTP2GO API key (SMTP2GO > Sending > API Keys). Without it the forms show a friendly "not taking sign-ups" message with the practice email and phone |
| `FORM_FROM` | Sender on the SMTP2GO-verified domain. Default: `Lava Street Dental <hello@lavastreetdental.com.au>` |
| `FORM_TO` | Optional. Recipients, separated by commas (reception, the SmileOx intake address, rowayne@gyaclients.com). Without it the hard-coded fallback in `api/_lib/forms.js` is used: info@lavastreetdental.com.au and rowayne@gyaclients.com |

## Forms and email

Same setup as the other GYA sites. Each form posts JSON to its Vercel
function (`/api/waitlist/`, `/api/enquiry/`), which validates it on the server
and sends two emails through the SMTP2GO HTTP API (v3). No dependencies.

- **Waitlist** (`/api/waitlist/`, home page): a notification to the
  recipients (reply goes straight to the person), and a short "You're on the
  list" confirmation to the person.
- **Enquiry** (`/api/enquiry/`, contact page): a notification with the
  message, and a short acknowledgement to the sender.

Fields: first and last name, email, optional Australian phone number, and a
required consent tick box that links to the Privacy Policy. The enquiry form
adds a message box. No health information is asked for.

Spam protection, with no captcha: a hidden honeypot field, a check that the
form was not submitted within two seconds of loading, and a limit of five
submissions per IP address per 10 minutes (held in function memory, so it is
best-effort).

### Setting up SMTP2GO (once)

1. In the GYA SMTP2GO account, add `lavastreetdental.com.au` as a verified
   sender domain and add the CNAME records it shows at GoDaddy (DNS > DNS
   Records). They do not touch the MX records for info@ and meg@.
2. Create an API key (Sending > API Keys) with permission to send email.
3. In Vercel > Settings > Environment Variables (Production, and Preview if
   wanted) add `SMTP2GO_API_KEY`, plus `FORM_FROM` and `FORM_TO` if the
   defaults above are not right. Redeploy.
4. Test: join the waitlist on the live site with your own email. You should
   get the confirmation, and the recipients the notification.

Each sign-up uses two emails, plus one for each extra recipient.

### Testing locally

`npm run build` only builds the static pages. To run the functions locally,
copy `.env.example` to `.env.local`, fill it in, then run `vercel dev`.

## Go-live checklist (open items)

- [x] Phone number (03 5208 9006)
- [x] Street address (116 Lava Street) and map embed
- [x] Opening hours
- [x] Waitlist and contact forms send email through SMTP2GO (`api/`)
- [ ] SMTP2GO sender domain verified and `SMTP2GO_API_KEY` set in Vercel (plus `FORM_TO` with the SmileOx intake address)
- [x] Privacy Policy page at /privacy-policy/
- [x] Privacy Policy placeholders filled from site details (add the legal entity name and ABN if the client wants them shown)
- [ ] Have the Privacy Policy checked against the practice management software and professional advice
- [ ] Remaining editorial placeholders listed by `npm run build`
- [x] Booking CTAs and "opened" wording switched to pre-opening (`preOpening`)
- [ ] Dilla Shauqy's bio, and team headshots (Jaimee due November)
- [ ] Wisdom tooth wording on the extractions page (client to confirm)
- [ ] Set `preOpening: false` on opening day, and update the home waitlist section
- [ ] Adobe Fonts kit ID (LAUNCH-TODO in each page head)
- [x] Domain connected in Vercel (lavastreetdental.com.au is live)
- [ ] Search Console property and sitemap submitted
- [ ] Confirm phone, address, hours and health funds against the brief
