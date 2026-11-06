// Lava Street Dental: business details, the defaults.
//
// Since v1.3.0 these are edited in the website dashboard (/admin, Site
// Settings). This file holds the values the site was approved with: the build
// starts from them and puts whatever the dashboard saved
// (content/site-settings.json) on top. Every page, the footer, the header,
// sitemap.xml, robots.txt, the canonical and Open Graph tags and the Dentist
// JSON-LD are built from the result (src/lib/staticSite.ts).
//
// An empty value ("" or []) hides everything that depends on it: tel: links,
// "Call" buttons, phone lines, the hours line, and the matching JSON-LD
// fields. Nothing placeholder-like is ever shown publicly.

export default {
  name: "Lava Street Dental",

  // Canonical origin. No trailing slash. Used for canonical tags, og:url,
  // sitemap.xml, robots.txt and JSON-LD. Pages link to each other with
  // relative paths, so the site also works on its Vercel preview address.
  siteUrl: "https://lavastreetdental.com.au",

  // Practice phone. Leave empty until confirmed. When it arrives, type it the
  // way it should be shown, for example "0X XXXX XXXX". The tel: link
  // (+61...) is worked out automatically.
  phone: "03 5208 9006",

  emails: {
    // Public contact address: header, footer, contact page, mailto links, JSON-LD.
    public: "info@lavastreetdental.com.au",
    // Dr Meg's address. Kept here for reference; not published on the site.
    meg: "meg@lavastreetdental.com.au",
  },

  address: {
    // Full street line once confirmed, for example "12 Lava Street".
    // While empty the site shows "Lava Street, Warrnambool VIC 3280" and the
    // JSON-LD leaves out streetAddress.
    streetAddress: "116 Lava Street",
    streetFallback: "Lava Street",
    locality: "Warrnambool",
    region: "VIC",
    postcode: "3280",
    country: "AU",
  },

  // Opening hours, one line each, exactly as they should read on the site.
  // Leave empty to hide the hours line in the footer and on the contact page.
  // Example: ["Monday to Thursday, 8am to 5.30pm", "Friday, 8am to 4pm"]
  hours: [
    "Monday, Tuesday, Wednesday and Friday: 8:30am to 5:30pm",
    "Thursday: 11:00am to 7:00pm",
    "Saturday and Sunday: Closed",
  ],

  // Optional schema.org versions of the hours for the JSON-LD,
  // for example ["Mo-Th 08:00-17:30", "Fr 08:00-16:00"]. Leave empty to omit.
  hoursSchema: ["Mo,Tu,We,Fr 08:30-17:30", "Th 11:00-19:00"],

  // Shown in the homepage hero line and the opening timeline.
  openingDate: "December 2026",

  // Pre-opening mode. While true, booking buttons read "Join the waitlist"
  // and copy describes the practice as opening in December 2026. When the
  // practice opens, set this to false: every button and sentence switches
  // back to its open-practice wording (for example "Book an appointment")
  // with no page edits.
  preOpening: true,

  // Payments, for the JSON-LD paymentAccepted field. The on-page wording
  // (Tyro terminal, on-the-spot health fund claiming) is in the page copy.
  paymentAccepted: ["Card", "Afterpay", "humm"],

  // Profile URLs. Empty entries are ignored. Filled ones go into JSON-LD sameAs.
  socials: {
    facebook: "",
    instagram: "",
    google: "",
  },

  // Waitlist and enquiry forms post to /api/waitlist/ and /api/enquiry/
  // (src/app/api), which keep each sign-up in the dashboard and send email
  // through the SMTP2GO API. The API key, sender and recipients are Vercel
  // environment variables (SMTP2GO_API_KEY, FORM_FROM, FORM_TO), with
  // fallbacks in src/forms/mail.ts. Recipients can also be set in the
  // dashboard (Site Settings, GYA only). See README.md, "Forms and email".

  // Share image for Open Graph and Twitter cards, relative to the site root.
  shareImage: {
    path: "/assets/images/og/lava-street-dental-reception-waiting-area.jpg",
    width: 1200,
    height: 630,
    alt: "Reception and waiting area at Lava Street Dental, Warrnambool",
  },

  // Logo for JSON-LD, relative to the site root.
  logo: "/assets/icons/icon-512.png",

  // Suburbs named on the location pages. Used for JSON-LD areaServed.
  areaServed: ["Warrnambool", "Dennington", "Allansford", "Koroit", "Port Fairy"],

  // ---- Added with the dashboard (v1.3.0). Empty values change nothing on the site.

  // Postal address, if different from the street address. Not shown on the site yet.
  postalAddress: "",
  // Google Maps link for the practice. The contact page map is built from the
  // street address; this link is kept for when a "Get directions" link is added.
  mapsUrl: "",
  // Online booking link, for after opening. Not shown on the site yet.
  bookingUrl: "",
  // Health funds and HICAPS wording. Leave empty until the practice confirms it.
  healthFunds: "",
  // Tracking, added to every page only when filled in (GYA only in the dashboard).
  tracking: { ga4: "", metaPixel: "" },
  // Form emails go to these. Empty uses FORM_TO, then the fallback list in src/forms/mail.ts.
  formRecipients: [],
  // Dashboard features that need an approved design before they are switched on.
  features: { blog: false, beforeAfter: false },
};
