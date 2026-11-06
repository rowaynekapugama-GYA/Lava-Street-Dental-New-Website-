/**
 * The page editor's preview must be the live page plus markers and nothing else.
 * Renders every page twice (as the website, and marked for editing as GYA would see it), removes the
 * markers, and compares. Also counts what can be edited.
 *
 *   npm run qa:editor
 */
import './load-env'
import { getChrome, getPages } from '../src/lib/content'
import { getSettings } from '../src/lib/site'
import { renderPageHtml } from '../src/dashboard/render'

const settings = getSettings()
const chrome = getChrome()

const strip = (html: string) => html
  .replace(/<base href="[^"]*">/, '')
  .replace(' data-pdc="header"', '')
  .replace(/<span class="pd-tok" contenteditable="false" data-pdt="\w+"(?: data-raw="1")?>([\s\S]*?)<\/span>/g, '$1')
  .replace(/<pd-e data-pde="[^"]*" data-t="(?:text|rich)"(?: data-lock="1")?>/g, '')
  .replace(/<\/pd-e>/g, '')
  .replace(/ data-(?:pdi|pda|pdh|pds|pdr|pdc)="[^"]*"/g, '')

let bad = 0
const totals = { words: 0, locked: 0, photos: 0, links: 0, items: 0 }
for (const admin of [true, false]) {
  for (const page of getPages()) {
    const plain = renderPageHtml(page, { chrome, settings })
    const marked = renderPageHtml(page, { chrome, settings, editable: true, admin })
    if (strip(marked) !== plain) {
      bad++
      const a = strip(marked)
      let i = 0
      while (i < a.length && a[i] === plain[i]) i++
      console.log(`differs (${admin ? 'GYA' : 'practice'}): ${page.file} at ${i}\n  live:   ${JSON.stringify(plain.slice(i - 60, i + 80))}\n  editor: ${JSON.stringify(a.slice(i - 60, i + 80))}`)
    }
    if (!admin) {
      totals.words += (marked.match(/<pd-e /g) || []).length
      totals.locked += (marked.match(/data-lock="1"/g) || []).length
      totals.photos += (marked.match(/ data-pdi="/g) || []).length
      totals.links += (marked.match(/ data-pdh="/g) || []).length
      totals.items += (marked.match(/ data-pdr="/g) || []).length
    }
  }
}
const n = getPages().length
console.log(`qa:editor: ${2 * n - bad} of ${2 * n} previews are the live page plus markers (GYA and practice views).`)
console.log(`  practice view: ${totals.words} editable words (${totals.locked} locked compliance wording), ${totals.photos} photos, ${totals.links} links, ${totals.items} repeating items`)
process.exit(bad ? 1 : 0)
