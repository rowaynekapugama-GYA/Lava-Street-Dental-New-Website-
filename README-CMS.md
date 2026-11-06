# Lava Street Dental: the website dashboard (v1.3.1)

The GYA standard client dashboard at `/admin`, added to the approved site without rebuilding it.
Layout after the Precision Dental dashboard, backend and sync pattern as the Coastal Dental and The
Cronulla Dentists retrofits (Payload on Neon Postgres, photos on Vercel Blob), in Lava Street
Dental's own colours and type.

This is an **update to the existing repo** `rowaynekapugama-GYA/Lava-Street-Dental-New-Website-`,
on top of `main` 3b884bc (v1.2.2). It has to go up as a whole (the layout of the repo changes), so it
is delivered as a full repo zip with `scripts/push-to-github.sh`.

## How it works

```
the practice edits in /admin  ->  Postgres (Neon)  ->  Publish website  ->  Vercel deploy hook
                                                                              |
  scripts/build.mjs:  migrate -> seed if empty -> pull into content/ -> render public/*.html -> next build
```

- The public pages are static HTML written at build time. Visitors never touch the database.
- If the database is down or empty, the build uses the content committed in the repo. Tested:
  no `DATABASE_URL`, an empty database, and an unreachable database all build.
- `content/pages/*.json` is the approved v1.2.2 markup, section by section, with every editable value
  as a `{{fN}}` placeholder. The practice details stay as the site's own tokens (`{{phone}}`,
  `{{#preOpening}}...{{/preOpening}}`), so opening mode and empty details still work.
- Rendering `content/` gives the v1.2.2 build back **byte for byte** (`npm run qa:parity`: 39 of 39
  files).
- Payload's own screens are at `/cms`, for GYA administrators only. The practice only ever sees `/admin`.

## Environment variables

Set in Vercel > Settings > Environment Variables, for Production and Preview.

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string. Added by Vercel > Storage > Neon. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for photo uploads. Added by Vercel > Storage > Blob. |
| `PAYLOAD_SECRET` | A long random string, 32 characters or more. Signs dashboard sign-ins. The build stops if `DATABASE_URL` is set without it. |
| `PUBLISH_HOOK_URL` | The Vercel deploy hook (Settings > Git > Deploy Hooks, branch `main`). Publish website calls it. |
| `NEXT_PUBLIC_SERVER_URL` | `https://lavastreetdental.com.au` (the live domain, no slash at the end). |
| `ALLOW_FIRST_USER` | `true` only for the very first sign in. Delete it and redeploy straight after. |
| `SMTP2GO_API_KEY` | SMTP2GO API key, unchanged from v1.2.2. |
| `FORM_FROM` | Optional sender, unchanged: `Lava Street Dental <hello@lavastreetdental.com.au>`. |
| `FORM_TO` | Optional recipients, comma separated. Wins over Site Settings > Form recipients. |

No real values are in the repo. `.env.example` lists them all.

## Rollout (Terminal)

1. **Stage it:** `bash scripts/push-to-github.sh stage ~/Downloads/lava-street-dental-v1.3.0.zip`.
   This puts the release on the `cms` branch only. `main` and the live site are untouched, and Vercel
   builds a preview.
2. **Storage**, in Vercel > the project > Storage:
   - create a **Neon** database (region Sydney, `ap-southeast-2`), connect it to Production and
     Preview. That adds `DATABASE_URL`.
   - create a **Blob** store and connect it. That adds `BLOB_READ_WRITE_TOKEN`.
3. **Variables:** add `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL` and `ALLOW_FIRST_USER=true`.
4. **Deploy hook:** Settings > Git > Deploy Hooks, name `dashboard-publish`, branch `main`. Copy the
   address into `PUBLISH_HOOK_URL` (Production). For testing on the preview, add a second hook on
   branch `cms` as `PUBLISH_HOOK_URL` for Preview.
5. **Redeploy the preview.** The first build with the database loads the website into the dashboard
   by itself.
6. **First login:** open `<preview address>/admin/login` and create the first login
   (rowayne@gyaclients.com). It is always an administrator. Then delete `ALLOW_FIRST_USER` and redeploy.
7. **Photos:** on the Dashboard, under Import, press **Import pictures into the Media Library** (once).
8. **Check:** edit a word on a page, Save, Publish website, and see it on the preview once the build
   finishes. Join the waitlist on the preview and check the email arrives and the sign-up shows under
   Waitlist.
9. **Go live:** `bash scripts/push-to-github.sh promote` (type `LIVE`). `main` moves to the tested `cms`
   commit and Vercel deploys production. `rollback` (type `ROLLBACK`) puts `main` back.
10. **Logins for the practice:** Users > Add a user, role Editor, for Dr Meg and the front desk. They
    choose their own password at the first sign in.

Preview and production share the one database, so what is edited on the preview is what goes live.

## Roles

- **Administrator (GYA):** everything, including Redirects, Users, the GYA tab in Site Settings
  (opening mode, form recipients, tracking, website address), site-wide SEO defaults, footer headings and
  links, the locked compliance wording, and the team cards.
- **Editor (Dr Meg and front desk):** Dashboard, Pages, Media Library, Team, Waitlist, SEO and Site
  Settings (Practice details only). The rules are checked on the server, not just hidden: an editor's
  change to locked wording is ignored, and the page markup can only be written by GYA.

## What the practice can change

- **Pages:** every word on all 37 pages, in place on the real page (Desktop or Mobile preview). Words
  only: font, size and colour stay with the design. Italic can be toggled only inside headings that
  already use an italic accent word.
- **Buttons and links:** where they go, from a list of this page's sections, the home page's sections
  (by name, such as "Waitlist form" and "Our care") and every page, or another website (opens in a new
  tab). Buttons that follow opening mode, and phone and email links, explain where they are set.
- **Photos:** any photo, including the hero background, from the Media Library or a new upload
  (resized to 2400px WebP). A focal point picker keeps the subject in view when the slot crops it.
- **Sections:** reorder by dragging, hide or show (the page header stays at the top), and repeating
  items: hero points, credential tags, care cards, timeline steps, reasons, questions and lists can be
  added (duplicate), moved and removed. Copies get their own element ids, and the FAQ structured data
  follows the questions on the page.
- **Locked compliance wording** (GYA only): the general dentist and PhD notes, the clinical assessment
  caveats, the FAQ "pain-free" sentence and the footer disclaimer. Editors see a lock and "This wording
  is there to meet advertising rules. Ask GYA if it needs to change."
- **Footer:** the tagline and copyright line, shared by every page.
- **Practice details:** in Site Settings, flowing everywhere (header phone, call buttons, timeline
  step 3, footer, contact page, Dentist structured data).
- **Waitlist:** every sign-up and enquiry, with status (To do, Contacted, Booked), notes, CSV export
  and Remove this person.
- **SEO:** title, description, share image and Hide from Google per page, with counters and a
  Google-style preview.

## Brand tokens used

All from `public/assets/css/site.css`. The dashboard's tokens are at the top of
`src/dashboard/dashboard.css`.

| Dashboard element | Site token | Value |
|---|---|---|
| Sidebar, top bar, sign in background | `--color-mine-shaft` (footer, dark sections) | `#292826` |
| Active menu item, links, Save changes outline, edit outlines | `--olive` (`--color-fuscous-gray`) | `#575A4D` |
| Publish website | `.btn-primary`, the "Join the waitlist" button: olive fill, `--on-dark` text, `--r-sm` corners | `#575A4D` / `#EAE2D6` |
| Page background, help card tint | `--surface-soft` (`--color-pearl-bush`) | `#EAE2D6` |
| Cards | `--surface` (`--color-bg`), border `rgb(fuscous-gray / .14)`, `--r-lg`, `--shadow` | `#F4F1EA` |
| Borders, field outlines | `--line` (`--color-malta`) | `#BDB4A3` |
| Text, muted text | `--ink`, `--ink-soft` | `#292826`, `#575A4D` |
| Active item marker, locked wording outline | `--clay` (`--color-santa-fe`), accent only | `#B4684B` |
| Headings, body | `--font-display` and `--font-body` as they render (Inter: the Adobe kit is not set up yet) | Inter |
| Labels like the site's eyebrows | `--font-accent` | Roboto Condensed |
| Corners and shadows | `--r-sm` 10px (buttons, fields), `--r-lg` 16px (cards), `--shadow` | |
| Logo | `logo-light.svg` on the dark sidebar, `logo.svg` on the light sign in card | |
| /admin favicon | `assets/icons/favicon.svg` and the PNG set | |

Status colours, checked against the palette and for contrast: amber `#8A5A00` on `#FFF4D6` (waiting
to publish, To do), red `#A13D2B` with white (the Waitlist count, 6.5:1), green `#186A41` on `#E6F4EC`
(published, Booked). An automated scan of every dashboard screen found no text below WCAG AA.

## Where the brief, the reference and the approved site differ

The brief says the approved site wins. Decisions:

| # | Brief or reference | Approved site | Decision |
|---|---|---|---|
| 1 | A single "opening soon" page with placeholders | 37 pages, with real phone, address, hours, opening date and a privacy policy (v1.2.x) | The dashboard covers all 37 pages. The "Before opening day" list is worked out from what is really still empty or a placeholder |
| 2 | Placeholders live: address, phone, email, hours, opening date, socials, privacy link | Only Instagram and Facebook are empty; three editorial placeholders remain (wisdom tooth note, support team portrait box, "Compliance note (must appear on page):" label) | Listed on the Dashboard with Fill in links. The compliance label is GYA's to remove |
| 3 | Privacy Policy link points to # | `/privacy-policy/` exists and is linked from every footer and both consent boxes | Kept. Still to be checked by the practice's adviser |
| 4 | No em dashes | The approved copy has them | Left as approved. `qa:banned` checks everything GYA wrote, not the approved copy |
| 5 | No blog, before and after or team page | No blog or gallery; there are Meet the Team, Dr Meg's page and Our Support Team | Blog and Before & After are switched off (flags in Site Settings, sidebar hidden). Team edits Dr Meg's Meet Dr Meg profile and links to her pages; team cards are GYA only until a design for more than one practitioner is approved |
| 6 | Pixel diff of the one page | 37 pages | Diffed 6 pages plus the waitlist error and success states at 1280 and 390: 0.0000% |
| 7 | Final domain to confirm | lavastreetdental.com.au is live | `NEXT_PUBLIC_SERVER_URL` and the canonical tags use it |
| 8 | Waitlist form is section 3 | The form is inside the hero, with the `#waitlist` anchor | One section, "Hero and waitlist form". It stays at the top and cannot be hidden, because every "Join the waitlist" button on the site jumps to it |
| 9 | Menu links are on-page anchors (#welcome, #care ...) | The menu links to pages | The "linked from the menu" warning works for any section a menu link points to; today only the waitlist anchor is linked |
| 10 | Footer Visit and Social columns | Visit column only (no social profiles yet) | Visit comes from Site Settings. Social links go into the structured data until a Social column is designed |
| 11 | Save in the link colour, Publish in the CTA style, standing apart | The link colour and the CTA colour are the same olive | Save changes is the olive outline button, Publish website the filled olive "Join the waitlist" button |
| 12 | Heading font from the site | `--font-display` is an Adobe font whose kit is not set up, so the site shows Inter | Inter, as the site renders. Swap both together when the Adobe kit is added |
| 13 | Reference sign in card is white | The site has no white; the light surface is `#F4F1EA` | The card uses the site's light surface |
| 14 | Team changes flow to the Dentist structured data | The approved structured data never listed practitioners | Not changed, to keep the approved output. Can be added if Rowayne wants it |
| 15 | Precision's Publish button is green | The brief asks for the site's CTA style | Followed the brief; green is kept for "published" status only |
| 16 | Brand (logo, colours) editable by GYA | Part of the approved design | Shown read-only in Site Settings (GYA tab); changed in the code so every page stays consistent |
| 17 | Health funds and HICAPS, booking link, postal address, Maps link | Not shown on the site; payment wording is in the page copy | Fields kept in Site Settings, empty or unused until a design uses them. Precision's list was not copied |
| 18 | Repeating items edited with the page | | Adding, moving and removing items saves straight away (not published). The editor asks for word changes to be saved first, so nothing typed is lost |
| 19 | Forms | v1.2.2 forms on Vercel functions in `api/` | Same behaviour on Next.js routes at the same addresses. New: each sign-up is kept in the dashboard, and if the practice email fails the person is still on the list (it shows "Email not sent") |
| 20 | Vercel project | "Other", output `dist`, redirects in `vercel.json` | `vercel.json` now sets Next.js; the 14 redirects moved to `content/redirects.json` (Redirects in the dashboard) |
| 21 | Opening day | `preOpening` flag | Opening soon mode in Site Settings (GYA). The home page waitlist wording or a booking design is Rowayne's call |
| 22 | Section forms | | The Sections tab's form view offers bold, italic and link on paragraphs; in-place editing is stricter (italic accent in headings only) |

## Verification (6 November 2026)

See `docs/VERIFICATION.md` for the full list and `docs/screenshots/` for the screens. In short:

- `tsc --noEmit` clean. `npm run build` with no database, with an empty database (imports, pulls,
  renders) and with an unreachable database: all pass.
- Seed, pull, diff: 41 of 41 content files identical. Build from files vs build from the database:
  39 of 39 public files identical. `qa:parity` 39 of 39 against v1.2.2. `qa:editor` 74 of 74.
- Pixel diff v1.2.2 vs v1.3.0 at 1280 and 390: 0.0000% on every page and form state.
- Browser drive of every function, in production mode with a local SMTP2GO mock and deploy hook
  (46 checks, all pass), then pull and render to confirm the published output.
- `qa:banned` and `qa:secrets` clean. `/admin` answers `X-Robots-Tag: noindex, nofollow` and is not in
  the sitemap.
