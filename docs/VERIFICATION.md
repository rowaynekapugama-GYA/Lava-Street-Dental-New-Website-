# Verification, v1.3.0 (6 November 2026)

Run in production mode (`next build`, `next start`) against a local Postgres 16, with a local mock of
the SMTP2GO API (`SMTP2GO_ENDPOINT`) and of the Vercel deploy hook. Screenshots in `docs/screenshots/`.

## Builds

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm ci` then `npm run build` with no `DATABASE_URL` | pass (builds from the content files) |
| `npm run build` with an empty database | pass: migrations, website imported, pulled, rendered, `next build` |
| `npm run build` with an unreachable database | pass: builds from the content files |
| `next build` warnings | none |

## Content and output match the originals

| Check | Result |
|---|---|
| `npm run qa:parity`: content/ rendered vs the v1.2.2 build | 39 of 39 files identical (37 pages, sitemap, robots) |
| Seed, pull, diff (`scripts/qa-roundtrip.ts`) | 41 of 41 content files identical |
| Build from files vs build from the database | 39 of 39 public files identical |
| Pages served by `next start` vs the rendered files | 36 of 36 identical |
| `npm run qa:editor`: editor preview with markers removed vs the live page | 74 of 74 (GYA and practice views of 37 pages) |
| Pixel diff v1.2.2 vs v1.3.0, 1280 and 390: Home, About, Contact, Dental Implants, Dr Meg Takiguchi, Privacy Policy, plus the waitlist error and success states | 0.0000% on all 16 |

## Branding

- Sign in, Dashboard, Pages, page editor (desktop, mobile, sections), Team, Waitlist, Site Settings,
  SEO and Media Library screenshotted; every colour and font comes from the site's tokens
  (README-CMS.md, Brand tokens).
- Automated contrast scan of every text element on 8 screens: 0 below WCAG AA.
- 390px wide: no sideways scroll on Dashboard, Pages, Waitlist, Site Settings, Team, SEO or Media.

## Browser drive (46 checks, all pass)

Editor (GYA): first login; sign in; edit words in place (status "Unsaved changes", Save enabled);
italic accent on a selection in a heading that has one; a link's "Link goes to" lists sections by
name ("Waitlist form", "Our care") and pages, and changes the link; upload a photo from the page; edit
its description; Save ("All changes saved"); Mobile shows 390px; SEO tab counters; unsaved changes
warning on leaving; sections listed by readable name; hide a section; reorder by keyboard drag;
duplicate a care card; move and remove cards; duplicating a question gives its answer panel its own id;
practice details and menu explain where they are edited; Publish website fires the deploy hook and
says the changes will be live in a few minutes.

Practice details and the rest: import the website's photos; filling in Instagram drops it off the
"Before opening day" list; "changes waiting to publish" notice; the preview shows the new phone and
opening date; opening mode switch in the GYA tab; Team edits name, role and a credential tag and adds a
tag; Media Library upload, delete an unused photo, a used photo cannot be deleted; SEO overview lists
every page; joining the waitlist on the website sends both SMTP2GO emails, logs the sign-up and shows
the count beside Waitlist; status change; CSV export; Remove this person; a contact page enquiry lands
under Enquiries.

Editor role: menu without Redirects and Users; `/admin/users` answers 404; Site Settings shows Practice
details only; `/cms` refuses; compliance wording is locked and explains why; a direct API attempt to
replace a page's markup is ignored (model unchanged).

## Published output after the drive (pull, then render)

Edited words, the italic accent, the changed link, the uploaded photo and its description, the SEO
title, the new section order, 6 care cards, 8 questions and FAQ structured data with 8 questions all
appear. New phone: 149 places on 37 pages, 146 phone links, 0 left of the old number, in the Dentist
structured data too; the opening date, Instagram (structured data `sameAs`) and Dr Meg's role and tag
appear.

## Scans

- `npm run qa:banned`: 0 em dashes; 15 reviewed and allowed mentions (the advertising rules reminders).
- `npm run qa:secrets`: no secrets found.
- `/admin` and `/cms` answer `X-Robots-Tag: noindex, nofollow`; neither is in `sitemap.xml`.
- `scripts/push-to-github.sh` against a local bare repository: declined stage, stage, status, wrong-word
  promote, promote, rollback, and the guard when main moves after staging.
