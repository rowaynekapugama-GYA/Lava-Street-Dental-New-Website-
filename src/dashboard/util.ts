/** Small text helpers shared by the dashboard screens and the page preview. */

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/** Escaping for words between tags: quotes are left as typed. */
export function escText(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', hellip: '\u2026', rsquo: '\u2019',
  lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', ndash: '\u2013', mdash: '\u2014', middot: '\u00b7',
  rarr: '\u2192', larr: '\u2190', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', deg: '\u00b0',
}

export function unescapeHtml(s: string): string {
  return String(s ?? '').replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return NAMED[e] ?? m
  })
}

/** Visible text of a fragment of markup. */
export function plain(s: string): string {
  return unescapeHtml(String(s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/**
 * Practice details inside words are the site's own tokens ({{phone}}); in the form views they show as
 * typed, and the page editor shows them as shaded chips. Kept as functions so the shared GYA screens
 * stay the same from site to site.
 */
export function tokensToFriendly(s: string): string {
  return String(s ?? '')
}

export function friendlyToTokens(s: string): string {
  return String(s ?? '')
}
