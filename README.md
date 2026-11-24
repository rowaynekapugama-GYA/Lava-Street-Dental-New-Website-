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
page (or stays on the booking portal, if Online booking buttons is on, below). The home page waitlist
section itself still needs new wording or an approved booking design (README-CMS.md, conflicts).

## Online booking buttons (`onlineBooking`)

Added in v1.4.0. The booking portal is Principle: `https://app.principle.dental/portal/booking/Lp8f7z5YyIlPS9W1TYPQ`
(from Dr Meg, 23 Nov 2026). It is linked, never embedded.

- **The link:** Site Settings > Practice details > Booking link (default `bookingUrl` in `site.config.mjs`).
  The build fills it into the dashboard once while that field is blank (`scripts/content-fixes.ts`); a
  different link typed in the dashboard is kept.
- **The switch:** Site Settings > GYA > Opening mode > **Online booking buttons** (default `onlineBooking`
  in `site.config.mjs`, shipped **on**). It is separate from Opening soon mode.

| Online booking | Opening soon mode | Booking buttons |
|---|---|---|
| on, with a link | on or off | "Book an appointment" and each page's own wording ("Book a consultation", "Book with Dr Meg" ...), opening the portal in a new tab (`target="_blank" rel="noopener"`) |
| off, or no link | on | "Join the waitlist", to the waitlist form on the home page (as before v1.4.0) |
| off, or no link | off | the "Book ..." wording, to the contact page (as before v1.4.0) |

Nothing else follows the switch: the opening wording, the home page waitlist form and its own two links,
the contact form, and the emergency page (which has no booking button in the page and says emergency
appointments cannot be booked online) are all untouched. No page is edited: the rule is applied when the
pages are written (`bookingButtons` in `src/lib/staticSite.ts`), so it works on whatever wording the
dashboard holds. Each button carries `data-book`, which `site.js` reports as the `book_online` event.

To turn the buttons off: untick Online booking buttons, Save, Publish website. Until GYA saves that page
in the dashboard once, the value comes from `site.config.mjs`.

## The practice email address (`emailActive`)

Added in v1.4.0 because info@lavastreetdental.com.au was not receiving mail (the domain and Microsoft 365
were being moved away from GoDaddy). Site Settings > GYA > Opening mode > **Email address is working**
(default `emailActive` in `site.config.mjs`, shipped **off**).

**Off:**
- The address and its mailto links are hidden on every page, by the same rule as an empty phone number:
  the footer line, the contact page's Email row and the `email` in the Dentist structured data go.
- Wording written around the address falls back (`emailOffFallbacks` in `src/lib/staticSite.ts`):
  the privacy contact keeps Phone and Post; the contact page's feedback line reads "Speak to Jaimee
  Griffiths and we will look into it."; "get in touch at" on Our Support Team shows the phone number; the
  forms' error hint reads "You can also call 03 5208 9006."
- Form emails (`src/forms/mail.ts`): practice notifications go to meg@lavastreetdental.com.au and
  rowayne@gyaclients.com, never to the switched-off address, **whatever `FORM_TO` or Site Settings > Form
  recipients say**. The CC is unchanged (brett@generateyouraudience.com, or `FORM_CC`). The patient's
  confirmation has meg@lavastreetdental.com.au as its Reply-To.
- In the page editor, the few paragraphs that hold the address cannot be clicked into while it is off,
  so saving a page cannot drop the address from them. The build warns if a page still shows the address
  because someone typed it into a paragraph.

**On:** everything shows and sends exactly as before v1.4.0, with no page edits. The address is the first
recipient again (`FORM_TO`, then Form recipients, then info@ and rowayne@) and the Reply-To.

To switch it on when Dr Meg confirms the inbox works: tick Email address is working, Save, send a test
enquiry (form emails follow the switch as soon as it is saved), then Publish website for the pages.

## Team photos (headshots)

Jaimee and Dilla show initials placeholders until their headshots arrive. **They are not dentists, so
their photos go on the website only once Dr Meg has sent them for the website.** No stock or stand-in
photos. Each photo is replaced in the dashboard, with no release:

1. Prepare the photo: portrait, 4:5 (for example 800 x 1000 or 1200 x 1500 pixels), JPG or PNG, face
   in the upper middle. Any shape works, since the frame crops to 4:5, but 4:5 avoids surprises.
2. Dashboard > Pages > **Our Support Team**. Click the photo (or Replace under "Photos on this page"),
   Upload, and choose the file.
3. Photo description: `Jaimee Griffiths, Practice Manager at Lava Street Dental` or
   `Dilla Shauqy, Senior Dental Assistant at Lava Street Dental` (they are already filled in; keep them).
4. Focal point: click the face, so it stays in view in the 4:5 frame.
5. Save changes, then Publish website.

Dr Meg's own portrait (`assets/images/dr-meg.webp`, on her page, the Meet the Team card and the home
page) is replaced the same way, or everywhere at once from Media Library > the photo > Upload a
replacement. The striped "IMAGE: Support team portrait" box on Meet the Team is hidden (v1.4.0); it
needs a release to become a photo.

## If the domain or its DNS moves (GoDaddy, Microsoft 365)

The website and the form emails depend on DNS records in the lavastreetdental.com.au zone. If the
nameservers change or the zone is rebuilt somewhere else, copy these across first, with the exact
values from the current zone (GoDaddy > DNS) or the services named. No secret values are involved.

| What | Type | Host | Points to | Breaks without it |
|---|---|---|---|---|
| Website | A | `@` (lavastreetdental.com.au) | the Vercel address shown in Vercel > lava-street-dental-new-website > Settings > Domains | the whole website |
| Website | CNAME | `www` | the Vercel target shown on the same screen | www.lavastreetdental.com.au |
| Form emails (SMTP2GO sender domain) | CNAME x 3 | the three hosts shown in SMTP2GO > Sending > Verified Senders > lavastreetdental.com.au (one `em...`, one `s...._domainkey`, one `link`) | the three smtp2go.net targets shown there | waitlist and enquiry emails (they are sent from hello@lavastreetdental.com.au) |
| Google Search Console, if the domain was verified by DNS | TXT | `@` | the `google-site-verification=...` value in the current zone | Search Console access (the site itself keeps working) |

Microsoft 365 adds its own records (MX, autodiscover, an SPF TXT). They sit alongside the ones above
and must not replace them. Moving only the registration (same nameservers and zone) changes nothing.
After any change: `bash lava-street-dental-v1.4.0.sh check`, and a test enquiry from the contact page.

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
(`SMTP2GO_API_KEY`, optional `FORM_FROM`, `FORM_TO`). The sender is on the practice's own domain
(hello@lavastreetdental.com.au), verified in SMTP2GO by DNS records (see the domain section above). New in v1.3.0: each sign-up is also kept in the
dashboard (Waitlist), and if the practice email fails the person is still on the list there.
While the practice address is switched off (`emailActive`, above) notifications go to
meg@lavastreetdental.com.au and rowayne@gyaclients.com instead and the rest of this paragraph's
recipient rules are set aside. Otherwise, recipients: `FORM_TO` if set, else Site Settings > Form
recipients (GYA), else info@lavastreetdental.com.au and rowayne@gyaclients.com. Every practice notification is also copied
(CC) to brett@generateyouraudience.com, or to `FORM_CC` if set (`none` turns it off). The person who
filled in the form only ever gets their own confirmation. Spam protection as before: honeypot, a
two-second check and five posts per address per 10 minutes.

## Checks

```
npm run typecheck     TypeScript
npm run qa:parity     content/ renders byte for byte as the v1.2.2 build (39 of 39 files)
npm run qa:editor     the editor's preview is the live page plus markers, nothing else
npm run qa:switches   opening-soon mode, online booking and the email switch in all 8 combinations
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
- [ ] Editorial placeholders (the Dashboard's "Before opening day" list): wisdom tooth note, the "Compliance note (must appear on page):" label (still showing on Meet the Team). The support team portrait box is hidden since v1.4.0
- [ ] Instagram and Facebook links once the accounts exist
- [ ] Opening day: switch off Opening soon mode and agree the home page's booking wording or design
- [ ] Search Console property and sitemap submitted
- [ ] Privacy Policy updated for Google Tag Manager, Google Analytics and Google Ads (wording sent to the client with v1.3.4; it still says the site has no analytics or advertising tracking)
- [ ] Google Ads team: tags and conversions built in GTM-ML7789N3, and no GA4 counted twice
- [ ] info@lavastreetdental.com.au: when Dr Meg confirms it receives mail, switch on Email address is working (Site Settings, GYA), send a test enquiry, Publish website
- [ ] Before the domain or Microsoft 365 moves from GoDaddy: pass on the DNS records in "If the domain or its DNS moves"
- [ ] Headshots for Jaimee and Dilla: add in the dashboard once Dr Meg sends them for the website (they are not dentists; "Team photos" above)
- [ ] Dr Meg to confirm: the portal is ready to take bookings; Jaimee's title (Practice Manager on the site, dental assistant in her new bio); "both worked with Dr Meg before" for Jaimee; whether her own bio changes
- [ ] Next.js 16.4.4 has moderate security advisories fixed in 16.4.6 (none in features this site uses); upgrade in its own small release
