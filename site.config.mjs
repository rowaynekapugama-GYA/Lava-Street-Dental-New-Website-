// Lava Street Dental: business details, single source of truth.
//
// Every page, the footer, the header, sitemap.xml, robots.txt, the canonical
// and Open Graph tags and the Dentist JSON-LD are built from this file by
// scripts/build.mjs. Change a value here, commit, and Vercel rebuilds the
// whole site with it. No page needs editing.
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
  phone: "",

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
    streetAddress: "",
    streetFallback: "Lava Street",
    locality: "Warrnambool",
    region: "VIC",
    postcode: "3280",
    country: "AU",
  },

  // Opening hours, one line each, exactly as they should read on the site.
  // Leave empty to hide the hours line in the footer and on the contact page.
  // Example: ["Monday to Thursday, 8am to 5.30pm", "Friday, 8am to 4pm"]
  hours: [],

  // Optional schema.org versions of the hours for the JSON-LD,
  // for example ["Mo-Th 08:00-17:30", "Fr 08:00-16:00"]. Leave empty to omit.
  hoursSchema: [],

  // Shown in the homepage hero line and the opening timeline.
  openingDate: "December 2026",

  // Profile URLs. Empty entries are ignored. Filled ones go into JSON-LD sameAs.
  socials: {
    facebook: "",
    instagram: "",
    google: "",
  },

  // Enquiry and waitlist forms.
  // The forms are still in preview mode: nothing is sent or stored, and there
  // is no recipient yet. When a form relay is wired (GYA standard: SMTP2GO
  // serverless function), it reads its recipient from here. Do not set this to
  // info@ until that inbox is confirmed working.
  forms: {
    recipient: "",
  },

  // Share image for Open Graph and Twitter cards, relative to the site root.
  shareImage: {
    path: "/assets/images/og/lava-street-dental-reception-waiting-area.jpg",
    width: 1200,
    height: 630,
    alt: "Reception and patient waiting area at Lava Street Dental",
  },

  // Logo for JSON-LD, relative to the site root.
  logo: "/assets/icons/icon-512.png",

  // Suburbs named on the location pages. Used for JSON-LD areaServed.
  areaServed: ["Warrnambool", "Dennington", "Allansford", "Koroit", "Port Fairy"],
};
