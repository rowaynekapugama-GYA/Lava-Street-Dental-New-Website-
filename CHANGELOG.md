# Changelog

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
