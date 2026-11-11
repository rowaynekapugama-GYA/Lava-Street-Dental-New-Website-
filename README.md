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

1. with `DATABASE_URL`: migrate the database, load the website into it the first time, fill in anything
   a release adds to Site Settings while that field is still blank (`scripts/content-fixes.ts`), and pull
   what the dashboard holds into `content/`. If the database cannot be reached, this step is skipped and
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

## Search engines: demo address vs live domain

Only the live domain may appear in Google. The switch is one setting: **Site Settings > Website address**
(GYA tab), `https://lavastreetdental.com.au` (default in `site.config.mjs` as `siteUrl`). Requests on that
host and its `www` form get the normal pages. **Every other address** (lava-street-dental.vercel.app, the
`*-new-website.vercel.app` address, every Vercel preview) gets:

- `<meta name="robots" content="noindex, nofollow">` at the top of every page (the copies in `public/_demo/`,
  written by `scripts/render-site.ts`; design and words identical);
- an `X-Robots-Tag: noindex, nofollow` header on every response (`src/proxy.ts`, and `next.config.mjs` for
  `*.vercel.app` files such as images);
- no canonical tag, no `og:url`, no structured data (Dentist, FAQ), no tracking or site verification tags;
- an empty `sitemap.xml`, and a `robots.txt` that still **allows** crawling, with a comment saying why.
  Do not add `Disallow: /`: Google must crawl a page to see its noindex, otherwise the old listing stays.

### Going live: how to enable indexing

The live domain is already indexable; nothing needs switching on for lavastreetdental.com.au. Indexing
follows the Website address setting, so the only reason to touch it is a domain change.

**Moving to a different domain later:** set the new address in Site Settings > Website address (or
`siteUrl`), add the domain in Vercel, press Publish website (or redeploy), check
`curl -sI https://<new domain> | grep -i x-robots` prints nothing and the old address now shows the
header, then add the domain to Search Console and submit `https://<new domain>/sitemap.xml`.

**Hiding everything** (emergency): Dashboard > SEO > "Hide the whole website from search engines" (GYA)
puts noindex on every page on every address and empties the sitemap. Crawling stays allowed.

Checks after a deploy:

```
curl -sI https://lava-street-dental.vercel.app | grep -i x-robots-tag     # x-robots-tag: noindex, nofollow
curl -s  https://lava-street-dental.vercel.app | grep -i 'name="robots"'   # noindex, nofollow
curl -sI https://lavastreetdental.com.au | grep -i x-robots-tag           # (nothing: the live site stays indexable)
curl -s  https://lavastreetdental.com.au | grep -i 'name="robots"'         # (nothing)
```

## Tracking: Google Tag Manager

Added in v1.3.4 for the Google Ads campaign. Container **GTM-ML7789N3**.

- **Where it loads:** every public page of the live domain (lavastreetdental.com.au and www), including
  the 404 page, the privacy policy and the location pages. The `gtm.js` snippet is the first thing in
  `<head>`, exactly as Google supplied it, and the `<noscript>` iframe sits straight after `<body>`
  opens. Both are in the HTML the server sends (`finishPage` in `src/lib/staticSite.ts`).
- **Where it does not:** the demo address, Vercel previews (`stripTracking` in the `_demo/` copies) and
  the dashboard, including its page preview. Test visits never reach Google Ads.
- **The setting:** Dashboard > Site Settings > GYA > Tracking > Google Tag Manager ID (GYA only; it must
  look like `GTM-` followed by letters and numbers). Default in `site.config.mjs` (`tracking.gtmId`).
  The live value comes from the database, so the build fills the default in once while the dashboard
  field is blank (`scripts/content-fixes.ts`, build log line `[content-fixes] Google Tag Manager ...`). A
  different ID typed in the dashboard is kept. **To remove GTM:** blank `tracking.gtmId` in
  `site.config.mjs` and in the dashboard, otherwise the next build puts it back.
- **GA4 and the Meta Pixel** still have their own fields and load directly when filled in. If the GTM
  container also fires GA4 (or the same Google Ads conversion), clear the direct field in Site Settings
  and press Publish website, or visits are counted twice.
- **The render check** stops the build if a live page does not have exactly one GTM script and one
  noscript, or if a demo copy has any.

### dataLayer events

Pushed by `public/assets/js/site.js`. No personal details are ever included (no names, emails, phone
numbers or message text). GTM itself has no tags yet; the Google Ads team builds those.

| Event | When | Parameters |
|---|---|---|
| `generate_lead` | a form is sent and the function confirms the practice email went out through SMTP2GO (`{ ok: true, sent: true }`). Never on a failed send, a validation error, a server error or the spam trap | `form_name`: `waitlist` (home page) or `contact_enquiry` (contact page) |
| `click_to_call` | any `tel:` link | `link_location` |
| `click_email` | any `mailto:` link | `link_location` |
| `book_online` | a link with `data-book`, a link to a booking platform (HotDoc, HealthEngine, Centaur, D4W, Cliniko, Core Practice, Dentally), or an outside link whose path starts with `/book` | `link_location` |
| `get_directions` | a link with `data-directions`, or a Google Maps or Apple Maps link | `link_location` |

`link_location` is `header`, `mobile_menu`, `footer`, `sticky_mobile_bar` or `page_body`
(`data-track-location="..."` on a link or a parent overrides it). The site has no booking or directions
links yet (opening-soon mode); those two events start firing as soon as such links are added. The map on
the contact and location pages is an embedded Google map, which cannot report clicks.

Check after a deploy: `bash lava-street-dental-gtm.sh check`, then Google Tag Assistant
(tagassistant.google.com) on https://lavastreetdental.com.au.

## Forms and email

Unchanged in behaviour since v1.2.2, now Next.js routes at the same addresses (`/api/waitlist/`,
`/api/enquiry/`). Each sends a notification and a confirmation through the SMTP2GO HTTP API
(`SMTP2GO_API_KEY`, optional `FORM_FROM`, `FORM_TO`). New in v1.3.0: each sign-up is also kept in the
dashboard (Waitlist), and if the practice email fails the person is still on the list there.
Recipients: `FORM_TO` if set, else Site Settings > Form recipients (GYA), else
info@lavastreetdental.com.au and rowayne@gyaclients.com. Every practice notification is also copied
(CC) to brett@generateyouraudience.com, or to `FORM_CC` if set (`none` turns it off). The person who
filled in the form only ever gets their own confirmation. Spam protection as before: honeypot, a
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
- [ ] Privacy Policy updated for Google Tag Manager, Google Analytics and Google Ads (wording sent to the client with v1.3.4; it still says the site has no analytics or advertising tracking)
- [ ] Google Ads team: tags and conversions built in GTM-ML7789N3, and no GA4 counted twice
