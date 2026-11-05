# Lava Street Dental website

Static HTML site for Lava Street Dental, Warrnambool. Pages live in `src/`,
business details live in `site.config.mjs`, and `npm run build` renders the
finished site into `dist/`. Vercel runs the build on every push.

## Structure

| Path | What it is |
|---|---|
| `site.config.mjs` | Single source of truth: practice name, phone, emails, address, hours, opening date, socials, form recipient, share image |
| `src/` | Page templates, CSS, JS, images, favicon, 404 page |
| `scripts/build.mjs` | Build: fills pages from the config, adds SEO tags and JSON-LD, writes `sitemap.xml` and `robots.txt`, checks everything |
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

Vercel picks up `vercel.json`: install `npm install`, build `npm run build`,
output `dist`. Push to `main` and the Git integration deploys.

## Environment variables

None yet. When the enquiry and waitlist forms are wired to a relay (GYA
standard: SMTP2GO serverless function), its API key goes in Vercel
environment variables and the recipient comes from `forms.recipient` in
`site.config.mjs`.

## Go-live checklist (open items)

- [x] Phone number (03 5208 9006)
- [x] Street address (116 Lava Street) and map embed
- [x] Opening hours
- [ ] Wire the enquiry and waitlist forms (currently preview mode, nothing is sent)
- [ ] Set `forms.recipient` once info@ is confirmed working
- [ ] Privacy Policy page (footer link is a placeholder)
- [ ] Remaining editorial placeholders listed by `npm run build`
- [x] Booking CTAs and "opened" wording switched to pre-opening (`preOpening`)
- [ ] Dilla Shauqy's bio, and team headshots (Jaimee due November)
- [ ] Wisdom tooth wording on the extractions page (client to confirm)
- [ ] Set `preOpening: false` on opening day, and update the home waitlist section
- [ ] Adobe Fonts kit ID (LAUNCH-TODO in each page head)
- [ ] Domain connected in Vercel and DNS set at GoDaddy
- [ ] Search Console property and sitemap submitted
- [ ] Confirm phone, address, hours and health funds against the brief
