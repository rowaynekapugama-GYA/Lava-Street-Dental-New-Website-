# Changelog

## 2026-11-06: privacy policy details (v1.2.1)

- Privacy Policy placeholders filled from the site's own details: the
  practice name (Lava Street Dental) and the privacy contact email
  (info@lavastreetdental.com.au, from `site.config.mjs`). Phone and address
  already came from the config.
- The ABN is not on the site, so the ABN mention is removed rather than
  guessed. The practice location (116 Lava Street, Warrnambool VIC 3280)
  is used for "Who we are", the postal contact and the line on where patient
  records are managed.

## 2026-11-06: go-live (v1.2.0): working forms, privacy policy, mobile refresh

- Forms now send email. Before this, both forms were front-end only and
  nothing was sent or stored.
  - `api/waitlist.js` (home page waitlist) and `api/enquiry.js` (contact
    form) are Vercel functions that send over SMTP (SMTP2GO, via
    nodemailer 10.2.1): a notification to the practice and a confirmation
    to the person.
  - Shared code in `api/_lib/forms.js`.
  - Env vars only: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
    `WAITLIST_TO_EMAIL`, `WAITLIST_FROM_EMAIL` (see `.env.example` and
    README).
  - Server-side validation (names, email, Australian phone, consent),
    honeypot, two-second timing check and per-IP rate limit.
  - Required consent tick box linking to the Privacy Policy.
  - Inline success and error states, and the button is disabled while
    sending.
  - "Preview only" notices removed.
- "Join the waitlist" buttons now go to the waitlist form on the home page
  (smooth scroll on the home page). Open-mode links are unchanged.
- New Privacy Policy page at `/privacy-policy/`, linked in every footer and
  from both consent boxes. Highlighted placeholders: legal name, ABN, privacy
  contact email, practice software data location.
- Mobile (768px and below):
  - a practice photo under the hero headline
  - the hero paragraph hidden
  - trust tags on one row
  - a shorter waitlist intro and a tighter card
  - photos added in the welcome and opening sections
  - a shorter Dr Meg bio with a link to her profile
  - anchor and focus offsets for the sticky header and Safari's toolbar
  - the mobile menu sized to the visible viewport
- Accessibility:
  - footer headings are now h2, with the same look
  - links inside lists are underlined
- Build notice now also flags short placeholders like [ABN].

## 2026-11-05: practice phone number

- Phone 03 5208 9006 set in `site.config.mjs`. It now shows in the header,
  mobile menu, footer and contact page, on the "Call" buttons, and in the
  emergency wording, with tel: links to +61352089006 (142 links across 36
  pages).
- Dentist JSON-LD `telephone` uses the international format (+61352089006).
- Contact page pre-opening line now offers the phone as well as the form.
- Still hidden until `preOpening` is false: the "Ready to book?" lines on the
  location pages and the emergency page "Call us now" button.

## 2026-10-22: client updates (address, hours, waitlist, team, payments, emergency)

Client feedback from Dr Meg Takiguchi, 22 Oct 2026. No design changes.

- Address 116 Lava Street, Warrnambool VIC 3280 set in `site.config.mjs`:
  footer, contact page, location pages, map embed (contact and location
  pages) and Dentist JSON-LD streetAddress. Phone still empty and hidden.
- Opening hours set in `site.config.mjs`: footer, contact page, all five
  location pages and JSON-LD openingHours. Saturday and Sunday show Closed.
- New `preOpening` flag in `site.config.mjs` (true). Every "Book ..." button
  (97 across 36 pages) reads "Join the waitlist" with the same link, and
  copy that described the practice as already open now reads as pre-opening.
  Setting the flag to false restores the open-practice wording everywhere.
- Our Support Team: Dilla Shauqy, Senior Dental Assistant, with a DS
  initials placeholder at `assets/images/team/dilla-shauqy.webp` and a
  "bio coming soon" line.
- Parking: paid street parking and free two-hour parking at the nearby
  shopping centre, on the contact page and location pages.
- Payments: on-the-spot health fund claiming with a Tyro terminal; card
  payments, Afterpay and humm. Contact page, home FAQ (visible and JSON-LD),
  JSON-LD paymentAccepted.
- Straumann named on the dental implants and single tooth implants pages.
- Emergency: two same-day emergency appointments each day, call first thing
  in the morning, not bookable online. After-hours care is not offered; go
  to the Emergency Department. Emergency page, contact page, general
  dentistry page and location page FAQs. The emergency call panel shows only
  when the practice is open and has a phone number.
- Practice images replaced with the client's HD versions of the same shots:
  waiting area (2111x745), reception desk and corridor (2100x749) and
  treatment room (2112x745). Same file names, placements and crops. WebP
  srcset 480 to 2112px, every file under 150KB. Width, height and srcset
  updated; alt text unchanged. New 1200x630 share image from the HD waiting
  area.

## 2026-10-21: client revision round (pre-launch)

Client revision round from Dr Meg Takiguchi, 21 Oct 2026. No design changes.

- Project now builds: `npm run build` renders `src/` into `dist/` from
  `site.config.mjs`, the single source of truth for name, phone, emails,
  address, hours, opening date, socials and the form recipient. Vercel runs
  the build (see `vercel.json`).
- Canonical domain https://lavastreetdental.com.au on every canonical tag,
  og:url, sitemap.xml, robots.txt and JSON-LD. Internal links stay relative,
  so the Vercel preview address keeps working.
- Public email info@lavastreetdental.com.au in the footer, contact page and
  mailto links. Dr Meg's address (meg@lavastreetdental.com.au) is held in the
  config; the old .com address did not appear anywhere in the build.
- Phone is empty in the config, so tel: links, Call buttons and phone lines
  are hidden. Address and hours follow the same rule: the site shows
  "Lava Street, Warrnambool VIC 3280" until the street number is confirmed,
  and hides hours until they are supplied.
- Stock clinic interiors replaced with the client's three practice images,
  served as WebP with srcset, per-placement focal points, lazy loading below
  the fold and a priority hero. Six stock files removed.
- Pre-launch SEO: robots meta tags and the robots.txt block removed; sitemap.xml
  and robots.txt generated for the .com.au domain; Open Graph and Twitter tags
  with a 1200x630 reception share image; Dentist JSON-LD built from the
  config on the home, contact and location pages (no address number, hours,
  phone or reviews invented); "Opening December 2026" in the home hero line
  and timeline; new 404 page.
- Build checks fail the deploy on unrendered tokens, contact placeholders,
  the domain without .au, preview addresses, no-index directives, filler or
  to-be-announced text, invalid JSON-LD, duplicate titles or descriptions, missing canonicals, more or
  fewer than one H1, images without dimensions, and broken internal links.

## 2026-10-21: practice manager profile

Client change request from Dr Meg Takiguchi, 21 Oct 2026.

- Our Support Team page: the practice manager placeholder card is now
  Jaimee Griffiths, Practice Manager. Credentials line and bio as supplied
  by the client, bio verbatim in first person.
- Headshot placeholder: JG initials on Fuscous Gray at
  `assets/images/team/jaimee-griffiths.webp` (800x1000, 4:5). Overwrite that
  file with the professional headshot in November; no markup change needed.
- Contact page: the feedback line now names Jaimee Griffiths in place of the
  practice manager placeholder.
- Removed from the card with the placeholder: the "Relocated from New South
  Wales" line and the agency written role paragraphs, pending client
  confirmation.

## 2026-10-20: favicon and typography

- Favicon set built from the supplied monogram: ico, svg, 16 and 32 png,
  apple touch icon, 192 and 512 png, maskable 512, web manifest, theme-color.
  Head tags on all 35 pages. Tab sizes enlarge the mark to stay legible;
  app icon sizes use it as drawn.
- Typography moved to the brand faces. Neue Haas Grotesk (Medium for headings
  and labels, Roman for body) and Acumin Condensed (Medium, for supporting
  labels). Both are Adobe Fonts families: stacks name the Adobe slugs first,
  Inter and Roboto Condensed serve from Google Fonts until the kit ID is added
  at the commented LAUNCH-TODO line in the head.
- Fraunces and Karla retired. Variation axis settings removed. Weights
  reduced to the two the guidelines name. Display floors lowered a step for
  narrow screens, inner page H1 ceiling lowered to keep three lines.
- Em dashes removed from agency authored strings in robots.txt, site.js and
  the form preview notices.

## 2026-10-20: brand palette

Applied the approved palette from the Lava Street Dental brand guidelines,
page 03. Colours only. No layout, content, font or functionality change.

- Seven brand tokens defined once on `:root`, with channel triplets for
  translucent fills. Every rule now references a token. No raw colour values
  remain outside `:root` and the two logo SVGs.
- Semantic tokens renamed from the retired blue and cream scheme:
  `--ink`, `--ink-soft`, `--olive`, `--olive-deep`, `--clay`, `--sage`,
  `--surface`, `--surface-soft`, `--surface-dark`, `--line`, `--on-dark`.
- Footer is now a dark section, Mine Shaft with Pearl Bush text, per the
  guidelines. Footer logo switched to the reversed mark on all 35 pages.
- Logo fills corrected to exact palette values: `#585A4E` to `#575A4D`,
  and the reversed mark to Pearl Bush.
- Accessibility corrections: input outlines lifted to Fuscous Gray for a
  3:1 component boundary, all sage panel text set to Mine Shaft, validation
  message text set to Mine Shaft, footer link hover set to Pearl Bush,
  placeholders set to Fuscous Gray, root element colour set so pure black no
  longer sits at the top of the cascade.
- Housekeeping: em dashes removed from CSS comments, per the GYA standard.
  Client copy in the HTML is untouched.

Verified: zero off-palette values, all text meets WCAG AA against the painted
background on 35 pages at two widths, every interactive state checked, and
element geometry identical to the previous build.

## 2026-09-16: logo and mobile

- Brand logo installed in header, footer and the homepage closing band,
  traced to SVG so the keyline stays crisp at any size.
- Mobile fixes: masthead children no longer flex-shrink, header CTA hidden
  below 400px with the drawer CTA pinned, burger icon geometry corrected,
  footer and breadcrumb tap targets lifted above 24px.

## 2026-08-24: full site

- 35 pages built from the approved copy documents, static HTML and CSS.
- Staging safeguards: noindex on every page, robots.txt disallow, Dentist
  schema withheld until the business details are confirmed, forms in preview
  mode with no endpoint.
