# Lava Street Dental website

Live site: https://lavastreetdental.com.au. Repository:
`rowaynekapugama-GYA/Lava-Street-Dental-New-Website-`. Version 1.3.0 (see CHANGELOG.md).

Since v1.3.0 the site has the **GYA website dashboard** at `/admin`, where Dr Meg and the front
desk change wording and photos, fill in practice details, manage the waitlist and look after SEO.
Setting it up, the environment variables and the rollout are in **README-CMS.md**. How the practice
uses it is in **docs/HOW-TO-UPDATE.md**.

The public pages are still plain static HTML, written at deploy time. They never read the database
while someone visits, so the website cannot break because of the dashboard.

## Structure

```
content/              the website, as the dashboard edits it (written by the build from the database)
  pages/*.json        37 pages: each section's approved markup with {{fN}} placeholders, and the values
  chrome.json         the footer words shared by every page
  site-settings.json  practice details changed in the dashboard (on top of site.config.mjs)
  redirects.json      old addresses -> new ones
  seo.json            site-wide SEO switches
site.config.mjs       the practice details the site was approved with (the defaults)
public/assets/        CSS, JS, photos, icons (committed). The pages are written into public/ by the build.
src/lib/              the content model and the static build (staticSite.ts is the v1.2.2 build as a module)
src/dashboard/        the dashboard screens, editors, styles (Lava Street Dental tokens at the top of dashboard.css)
src/sitekit/          Payload collections and globals, import and sync
src/app/              Next.js: /admin (dashboard), /cms (Payload, GYA only), /api (forms, dashboard)
src/forms/            the waitlist and enquiry email (SMTP2GO), as in v1.2.2, plus keeping each sign-up
src/proxy.ts          serves the static pages with clean URLs, redirects and the site's own 404
scripts/              build, render, pull, seed and the QA checks
tools/v122/           the approved v1.2.2 templates and build, kept for the parity check
tools/extract-static-site/  the one-off extractor that turned tools/v122 into content/
```

## Build and deploy

Vercel builds it as a Next.js project (`vercel.json`): install `npm ci`, build `npm run build`,
output `.next`. No other project settings are needed. `npm run build` (scripts/build.mjs):

1. with `DATABASE_URL`: migrate the database, load the website into it the first time, and pull what
   the dashboard holds into `content/`. If the database cannot be reached, this step is skipped and
   the files in the repository are used.
2. `scripts/render-site.ts`: write every page, `sitemap.xml` and `robots.txt` into `public/`, and run
   the v1.2.2 checks (tokens, structured data, canonical tags, image sizes, links). Problems that would
   break the site stop the build; things the practice can cause by typing are reported as warnings.
3. `next build`.

Locally: `npm ci`, then `npm run build` and `npm start`. Without `DATABASE_URL` the site builds from
the files; the dashboard needs a database (README-CMS.md).

## Practice details and opening day

Practice details (phone, email, address, hours, opening date, social links) are edited in the
dashboard under Site Settings, and fill in everywhere: the header phone, every call button, the
opening timeline, the footer, the contact page and the Dentist structured data. An empty value hides
everything that depends on it. `site.config.mjs` keeps the approved defaults.

On opening day GYA switches off **Opening soon (waitlist) mode** (Site Settings, GYA tab) and presses
Publish website: every "Join the waitlist" button goes back to its booking wording and the contact
page. The home page waitlist section itself still needs new wording or an approved booking design
(README-CMS.md, conflicts).

## Forms and email

Unchanged in behaviour since v1.2.2, now Next.js routes at the same addresses (`/api/waitlist/`,
`/api/enquiry/`). Each sends a notification and a confirmation through the SMTP2GO HTTP API
(`SMTP2GO_API_KEY`, optional `FORM_FROM`, `FORM_TO`). New in v1.3.0: each sign-up is also kept in the
dashboard (Waitlist), and if the practice email fails the person is still on the list there.
Recipients: `FORM_TO` if set, else Site Settings > Form recipients (GYA), else
info@lavastreetdental.com.au and rowayne@gyaclients.com. Spam protection as before: honeypot, a
two-second check and five posts per address per 10 minutes.

## Checks

```
npm run typecheck     TypeScript
npm run qa:parity     content/ renders byte for byte as the v1.2.2 build (39 of 39 files)
npm run qa:editor     the editor's preview is the live page plus markers, nothing else
npm run qa:banned     em dashes and AHPRA wording in everything GYA wrote (not the approved copy)
npm run qa:secrets    keys, tokens and database addresses
DATABASE_URL=<empty test database> npx tsx scripts/qa-roundtrip.ts   seed, pull, compare
```

## Go-live checklist (open items)

- [x] Phone, street address, hours, map, privacy policy, forms (v1.2.x)
- [ ] SMTP2GO sender domain verified and `SMTP2GO_API_KEY` set in Vercel (plus the SmileOx intake address in `FORM_TO` or Site Settings)
- [ ] Dashboard set up: Neon, Blob, `PAYLOAD_SECRET`, deploy hook, first login, photos imported (README-CMS.md)
- [ ] Logins for Dr Meg and the front desk (Users, as Editors)
- [ ] Have the Privacy Policy checked against the practice management software and professional advice
- [ ] Editorial placeholders (the Dashboard's "Before opening day" list): wisdom tooth note, support team portrait box, the "Compliance note (must appear on page):" label
- [ ] Instagram and Facebook links once the accounts exist
- [ ] Opening day: switch off Opening soon mode and agree the home page's booking wording or design
- [ ] Search Console property and sitemap submitted
