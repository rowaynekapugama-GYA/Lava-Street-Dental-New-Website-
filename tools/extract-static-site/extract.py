#!/usr/bin/env python3
"""
One-off: turn the approved v1.2.2 page templates into the content model the dashboard edits.

  python3 tools/extract-static-site/extract.py tools/v122/src content

The v1.2.2 templates (tools/v122/src) already hold the practice details as tokens ({{phone}},
{{#preOpening}}...{{/preOpening}} and so on, filled from Site Settings at build time). Those tokens stay
in the content model untouched, so opening mode, empty details and the build checks keep working.

For each page it writes content/pages/<slug>.json:
  head      everything up to and including <main id="main">, with the SEO values as {{seo:...}} tokens and the
            FAQ structured data as {{gen:faqSchema}} (built from the questions on the page)
  sections  each <section> in <main> as a part: tag, attributes and its inner HTML with every editable value
            replaced by {{fN}}, plus the values (Heading, Paragraph, Photo, Button link ...). Repeating items
            (cards, questions, tags, steps) are wrapped in {{[Ln]}} ... {{[/Ln]}} so the dashboard can add,
            duplicate, move and remove them. The markers are removed when the page is written.
  footer    the page's footer with {{fN}} placeholders for the shared footer words (content/chrome.json)
  tail      everything after the footer (scripts)

Rendering the result gives the v1.2.2 templates back byte for byte (scripts/qa-parity.ts proves it).
Kept in the repo for the record; it is not part of the build.
"""
import json
import os
import re
import sys

SRC, OUT = sys.argv[1], sys.argv[2]

VOID = {'img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'track', 'wbr', 'area', 'base', 'col', 'embed', 'param'}
RAW = {'script', 'style', 'textarea', 'title'}
INLINE = {'a', 'strong', 'em', 'b', 'i', 'span', 'br', 'sup', 'sub', 'mark', 'small', 'abbr', 'time', 's', 'u', 'q', 'cite', 'code'}
SKIP = {'svg', 'script', 'style', 'template', 'noscript', 'select', 'textarea', 'iframe', 'video', 'audio', 'canvas', 'input'}

MUSTACHE = re.compile(r'\{\{\{?[#^/]?\w+\}?\}\}')
SECTION_TAG = re.compile(r'(\{\{[#^/]\w+\}\})')

GROUPS = [
    ('Main pages', lambda p: p in ('/', '/about/', '/contact/', '/services/', '/meet-the-team/')),
    ('Team', lambda p: p.startswith('/meet-the-team/')),
    ('General dentistry', lambda p: p.startswith('/services/general-dentistry/')),
    ('Dental implants', lambda p: p.startswith('/services/dental-implants/')),
    ('Restorative dentistry', lambda p: p.startswith('/services/restorative-dentistry/')),
    ('Cosmetic dentistry', lambda p: p.startswith('/services/cosmetic-dentistry/')),
    ('Laser and digital dentistry', lambda p: p.startswith('/services/laser-digital-dentistry/')),
    ('Areas we serve', lambda p: p.startswith('/dentist-')),
    ('Legal and other pages', lambda p: True),
]

NAMES = {
    '/': 'Home', '/about/': 'About', '/contact/': 'Contact', '/services/': 'Services', '/meet-the-team/': 'Meet the Team',
    '/meet-the-team/dr-meg-takiguchi/': 'Dr Meg Takiguchi', '/meet-the-team/our-support-team/': 'Our Support Team',
    '/privacy-policy/': 'Privacy Policy', '/404': 'Page not found',
    '/services/general-dentistry/': 'General Dentistry', '/services/dental-implants/': 'Dental Implants',
    '/services/restorative-dentistry/': 'Restorative Dentistry', '/services/cosmetic-dentistry/': 'Cosmetic Dentistry',
    '/services/laser-digital-dentistry/': 'Laser and Digital Dentistry',
    '/services/general-dentistry/check-ups-and-cleans/': 'Check-ups and Cleans',
    '/services/general-dentistry/childrens-dentistry/': "Children's Dentistry",
    '/services/general-dentistry/custom-mouthguards/': 'Custom Mouthguards',
    '/services/general-dentistry/dental-fillings/': 'Dental Fillings',
    '/services/general-dentistry/emergency-dental-care/': 'Emergency Dental Care',
    '/services/general-dentistry/gum-disease-treatment/': 'Gum Disease Treatment',
    '/services/general-dentistry/night-guards-teeth-grinding/': 'Night Guards and Teeth Grinding',
    '/services/dental-implants/bone-grafting/': 'Bone Grafting',
    '/services/dental-implants/single-tooth-implants/': 'Single Tooth Implants',
    '/services/dental-implants/multiple-implants-implant-bridges/': 'Multiple Implants and Implant Bridges',
    '/services/restorative-dentistry/dental-bridges/': 'Dental Bridges',
    '/services/restorative-dentistry/dental-crowns/': 'Dental Crowns',
    '/services/restorative-dentistry/partial-dentures/': 'Partial Dentures',
    '/services/restorative-dentistry/root-canal-treatment/': 'Root Canal Treatment',
    '/services/restorative-dentistry/tooth-extractions/': 'Tooth Extractions',
    '/services/cosmetic-dentistry/porcelain-veneers/': 'Porcelain Veneers',
    '/services/laser-digital-dentistry/diode-laser-dentistry/': 'Diode Laser Dentistry',
    '/services/laser-digital-dentistry/digital-scanning-cbct/': 'Digital Scanning and CBCT',
    '/dentist-warrnambool/': 'Dentist Warrnambool', '/dentist-dennington/': 'Dentist Dennington',
    '/dentist-allansford/': 'Dentist Allansford', '/dentist-koroit/': 'Dentist Koroit', '/dentist-port-fairy/': 'Dentist Port Fairy',
}

# Home page sections by their anchor, named the way the practice talks about them.
HOME_SECTIONS = {
    'hero': 'Hero and waitlist form', 'welcome': 'Meet Dr Meg', 'care': 'Our care', 'opening': 'Opening timeline',
    'questions': 'Questions', 'contact': 'Closing message', 's5': 'Why join',
}

# Repeating items: the container's class decides the readable names.
LIST_NAMES = [
    ('trust', 'Hero points', 'Point'), ('chips', 'Credential tags', 'Tag'), ('cards', 'Care cards', 'Card'),
    ('faq-list', 'Questions', 'Question'), ('steps', 'Timeline steps', 'Step'), ('timeline', 'Timeline steps', 'Step'),
    ('reasons', 'Reasons', 'Reason'), ('benefits', 'Reasons', 'Reason'), ('why', 'Reasons', 'Reason'), ('ticklist', 'Points', 'Point'),
    ('team-grid', 'Team cards', 'Team card'), ('flow', 'Service groups', 'Service group'),
]


class Node:
    def __init__(self, tag, start, open_end, attrs_raw):
        self.tag = tag
        self.start = start
        self.open_end = open_end
        self.close_start = open_end
        self.end = open_end
        self.attrs_raw = attrs_raw
        self.children = []
        self.parent = None

    def attr(self, name):
        m = re.search(r'(?:^|\s)' + re.escape(name) + r'(?:="([^"]*)")?(?=\s|/?$)', self.attrs_raw)
        if not m:
            return None
        return m.group(1) if m.group(1) is not None else ''

    def classes(self):
        return (self.attr('class') or '').split()

    def inside(self, tag):
        p = self.parent
        while p is not None:
            if p.tag == tag:
                return True
            p = p.parent
        return False


def parse(html):
    root = Node('#root', 0, 0, '')
    stack = [root]
    i = 0
    n = len(html)
    while i < n:
        lt = html.find('<', i)
        if lt < 0:
            break
        if html.startswith('<!--', lt):
            i = html.index('-->', lt) + 3
            continue
        if html.startswith('<!', lt):
            i = html.index('>', lt) + 1
            continue
        m = re.match(r'<(/?)([a-zA-Z][\w:-]*)', html[lt:lt + 64])
        if not m:
            i = lt + 1
            continue
        j = lt + len(m.group(0))
        q = None
        while j < n:
            c = html[j]
            if q:
                if c == q:
                    q = None
            elif c in '"\'':
                q = c
            elif c == '>':
                break
            j += 1
        tag = m.group(2).lower()
        if m.group(1):
            while len(stack) > 1:
                top = stack.pop()
                if top.tag == tag:
                    top.close_start = lt
                    top.end = j + 1
                    break
            i = j + 1
            continue
        raw_attrs = html[lt + len(m.group(0)):j].rstrip('/').strip()
        node = Node(tag, lt, j + 1, raw_attrs)
        node.parent = stack[-1]
        stack[-1].children.append(node)
        i = j + 1
        if tag in VOID or html[j - 1] == '/':
            node.close_start = node.end = j + 1
            continue
        if tag in RAW:
            close = html.lower().index('</' + tag, i)
            node.close_start = close
            node.end = html.index('>', close) + 1
            i = node.end
            continue
        stack.append(node)
    return root.children


def text_of(html):
    t = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    t = MUSTACHE.sub(' ', t)
    t = re.sub(r'<[^>]+>', ' ', t)
    t = t.replace('&middot;', ' ').replace('&nbsp;', ' ')
    return re.sub(r'\s+', ' ', t).strip()


LABELS = {
    'h1': 'Main heading', 'h2': 'Heading', 'h3': 'Small heading', 'h4': 'Small heading', 'p': 'Paragraph',
    'li': 'List item', 'blockquote': 'Quote', 'figcaption': 'Caption', 'button': 'Button words', 'label': 'Label',
    'dt': 'Term', 'dd': 'Description', 'span': 'Words', 'div': 'Words', 'summary': 'Question', 'a': 'Link words',
    'td': 'Table cell', 'th': 'Table heading',
}


class Extractor:
    def __init__(self, links=True):
        # links=False (the footer): link addresses, link-only list items and the logo are GYA's to change
        self.n = 0
        self.fields = []
        self.lists = []
        self.links = links
        self.photos = {}

    def new(self, label, ftype, value, **extra):
        self.n += 1
        fid = f'f{self.n}'
        f = {'id': fid, 'label': label, 'type': ftype, 'value': value}
        f.update(extra)
        self.fields.append(f)
        return fid

    def no_edit(self, node):
        if node.attr('hidden') is not None:
            return True
        cls = node.classes()
        if any(c in cls for c in ('hp', 'msg', 'form-status', 'visually-hidden', 'pm')):
            return True
        return False

    def is_text_container(self, node, html):
        def inline_only(nd):
            for c in nd.children:
                if c.tag not in INLINE or c.tag == 'a' and ('btn' in c.classes() or not self.links):
                    return False
                if not inline_only(c):
                    return False
            return True
        inner = html[node.open_end:node.close_start]
        if SECTION_TAG.search(inner):
            return False
        return inline_only(node) and text_of(inner) != ''

    def render(self, node, html):
        out = []
        pos = node.open_end
        items = self.list_items(node, html)
        for c in node.children:
            out.append(self.text_between(html, pos, c.start))
            body = self.node_html(c, html)
            if items is not None and c in items:
                body = '{{[' + items[c] + ']}}' + body + '{{[/' + items[c] + ']}}'
            out.append(body)
            pos = c.end
        out.append(self.text_between(html, pos, node.close_start))
        return ''.join(out)

    def list_items(self, node, html):
        """Children that are the same kind of thing, one after another: cards, questions, tags, steps."""
        kids = node.children
        if len(kids) < 2 or node.tag not in ('ul', 'ol', 'div', 'dl') or node.inside('form') or node.tag == 'form':
            return None
        first = kids[0]
        if first.tag not in ('li', 'article', 'div', 'figure'):
            return None
        if any(k.tag != first.tag or k.attrs_raw.split('id=')[0] != first.attrs_raw.split('id=')[0] for k in kids):
            return None
        # nothing but whitespace between the items
        pos = node.open_end
        for k in kids:
            if html[pos:k.start].strip():
                return None
            pos = k.end
        if html[pos:node.close_start].strip():
            return None
        if not all(text_of(html[k.open_end:k.close_start]) for k in kids):
            return None
        cls = node.classes()
        name, item = 'List', 'Item'
        for key, n, i in LIST_NAMES:
            if key in cls:
                name, item = n, i
                break
        lid = f'L{len(self.lists) + 1}'
        entry = {'id': lid, 'label': name, 'item': item}
        if 'team-grid' in cls:
            entry['adminOnly'] = True  # a second practitioner needs an approved design first
        self.lists.append(entry)
        return {k: lid for k in kids}

    def text_between(self, html, a, b):
        """Loose words next to an icon (a button's label beside its arrow) become a field of their own.
        Opening mode and empty-detail switches ({{#preOpening}} ... {{/preOpening}}) stay in the template."""
        seg = html[a:b]
        out = []
        for part in re.split(r'(<!--.*?-->|\{\{[#^/]\w+\}\})', seg, flags=re.S):
            if part.startswith('<!--') or SECTION_TAG.fullmatch(part) or not text_of(part):
                out.append(part)
                continue
            m = re.match(r'^(\s*)(.*?)(\s*)$', part, re.S)
            out.append(m.group(1) + '{{' + self.new('Words', 'text', m.group(2)) + '}}' + m.group(3))
        return ''.join(out)

    def open_tag(self, node, html, repl):
        t = html[node.start:node.open_end]
        for attr, fid in repl:
            t = re.sub(r'(\s' + re.escape(attr) + r'=")[^"]*(")', lambda m: m.group(1) + '{{' + fid + '}}' + m.group(2), t, count=1)
        return t

    def node_html(self, node, html):
        tag = node.tag
        whole = html[node.start:node.end]
        if tag in SKIP or self.no_edit(node):
            return whole
        if tag == 'img':
            return self.img(node, html) if self.links else whole
        if tag in VOID:
            return whole
        inner = html[node.open_end:node.close_start]
        if node.inside('form') and tag not in ('button', 'form') and not self.form_words(node):
            # the form's fields, honeypot and messages: structure only
            if node.children:
                return html[node.start:node.open_end] + self.render(node, html) + html[node.close_start:node.end]
            return whole
        if tag == 'a' or tag == 'button':
            repl = []
            href = node.attr('href')
            if self.links and tag == 'a' and href is not None and '{{' not in href:
                repl.append(('href', self.new('Button link' if 'btn' in node.classes() else 'Link address', 'href', href)))
            if node.children and not self.is_text_container(node, html):
                body = self.render(node, html)
            elif text_of(inner) and not SECTION_TAG.search(inner):
                body = '{{' + self.new('Button words' if tag == 'button' or 'btn' in node.classes() else 'Link words',
                                      'richtext' if node.children else 'text', inner) + '}}'
            elif SECTION_TAG.search(inner):
                body = self.text_between(html, node.open_end, node.close_start)
            else:
                body = inner
            return self.open_tag(node, html, repl) + body + html[node.close_start:node.end]
        if self.is_text_container(node, html):
            label = LABELS.get(tag, 'Words')
            cls = node.classes()
            if 'eyebrow' in cls or 'rule-eyebrow' in cls or 'badge' in cls:
                label = 'Small heading above'
            elif tag == 'p' and 'lead' in cls:
                label = 'Introduction'
            elif tag == 'p' and ('note-fine' in cls or 'fine' in cls or 'disclaimer' in cls):
                label = 'Fine print'
            fid = self.new(label, 'richtext', inner)
            return html[node.start:node.open_end] + '{{' + fid + '}}' + html[node.close_start:node.end]
        return html[node.start:node.open_end] + self.render(node, html) + html[node.close_start:node.end]

    def form_words(self, node):
        cls = node.classes()
        return 'reassure' in cls or (node.tag == 'span' and node.parent is not None and 'check' in node.parent.classes())

    def img(self, node, html):
        src = node.attr('src')
        alt = node.attr('alt')
        if src is None or '{{' in src:
            return html[node.start:node.end]
        # the same photo twice in a section (the hero background and its mobile copy) is one photo
        key = (src, alt)
        if key in self.photos:
            fid, aid, sid = self.photos[key]
        else:
            fid = self.new('Photo', 'image', src, original=src, width=node.attr('width'), height=node.attr('height'))
            aid = self.new('Photo description', 'alt', alt) if alt else None
            srcset = node.attr('srcset')
            sid = self.new('Photo sizes', 'srcset', srcset, of=fid) if srcset else None
            self.photos[key] = (fid, aid, sid)
        repl = [('src', fid)]
        if aid:
            repl.append(('alt', aid))
        if sid and node.attr('srcset') is not None:
            repl.append(('srcset', sid))
        return self.open_tag(node, html, repl)


def attrs_of(node, html):
    raw = html[node.start + len(node.tag) + 1:node.open_end - 1].rstrip('/')
    out = {}
    for m in re.finditer(r'([\w:-]+)(?:="([^"]*)")?', raw):
        out[m.group(1)] = m.group(2) if m.group(2) is not None else None
    return out


def section_label(node, html, i, path):
    sid = node.attr('id') or f's{i + 1}'
    if path == '/' and sid in HOME_SECTIONS:
        return HOME_SECTIONS[sid]
    if 'page-hero' in node.classes():
        return 'Page header'
    lab = node.attr('aria-label')
    if lab:
        return lab
    h = re.search(r'<h([123])[^>]*>(.*?)</h\1>', html[node.open_end:node.close_start], re.S)
    if h:
        t = text_of(h.group(2))
        if t:
            return t if len(t) <= 60 else t[:57].rsplit(' ', 1)[0] + '...'
    return f'Section {i + 1}'


def py_json(v):
    """json.dumps(v, ensure_ascii=False) with Python's default separators, as the v1.2.2 pages were written."""
    return json.dumps(v, ensure_ascii=False)


def unescape(s):
    import html as h
    return h.unescape(s)


def plain(s):
    s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', unescape(s)).strip()


def faq_schema(main_html):
    qs = []
    for m in re.finditer(r'<div class="faq">(.*?)<div class="faq-a"[^>]*>(.*?)</div>\s*</div>', main_html, re.S):
        q = re.search(r'<span>(.*?)</span>', m.group(1), re.S)
        a = ' '.join(plain(p) for p in re.findall(r'<(?:p|li)\b[^>]*>(.*?)</(?:p|li)>', m.group(2), re.S))
        qs.append({'@type': 'Question', 'name': plain(q.group(1)), 'acceptedAnswer': {'@type': 'Answer', 'text': a}})
    if not qs:
        return ''
    return '<script type="application/ld+json">' + py_json({'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': qs}) + '</script>'


def tokenise_head(head, main_html):
    title = re.search(r'<title>(.*?)</title>', head, re.S).group(1)
    meta = {'title': unescape(title)}
    head = head.replace(f'<title>{title}</title>', '<title>{{seo:title}}</title>', 1)
    d = re.search(r'<meta name="description" content="([^"]*)">', head)
    if d:
        meta['description'] = unescape(d.group(1))
        head = head.replace(d.group(0), '<meta name="description" content="{{seo:description}}">', 1)
    for prop, key, base in (('og:title', 'ogTitle', 'title'), ('og:description', 'ogDescription', 'description')):
        m = re.search(r'<meta property="' + prop + r'" content="([^"]*)">', head)
        if m:
            if unescape(m.group(1)) != meta.get(base):
                meta[key] = unescape(m.group(1))
            head = head.replace(m.group(0), '<meta property="' + prop + '" content="{{seo:' + key + '}}">', 1)
    ld = re.search(r'<script type="application/ld\+json">\{"@context": "https://schema.org", "@type": "FAQPage".*?</script>', head, re.S)
    faq = None
    if ld:
        # kept as approved while the questions on the page are unchanged; rebuilt from them once edited
        faq = {'literal': ld.group(0), 'source': faq_source(main_html)}
        assert faq['source'], 'FAQ structured data on a page without questions'
        head = head.replace(ld.group(0), '{{gen:faqSchema}}', 1)
    return head, meta, faq


def faq_source(main_html):
    """The questions as they stand in the page source (the render step compares the same thing)."""
    return ''.join(m.group(0) for m in re.finditer(r'<div class="faq">.*?<div class="faq-a"[^>]*>.*?</div>\s*</div>', main_html, re.S))


def footer_part(seg):
    root = parse(seg)[0]
    ex = Extractor(links=False)
    template = seg[root.start:root.open_end] + ex.render(root, seg) + seg[root.close_start:root.end]
    return root, template, ex.fields


def page_path(rel):
    if rel == '404.html':
        return '/404'
    if rel == 'index.html':
        return '/'
    return '/' + rel[:-len('index.html')]


def slug_of(p):
    if p == '/':
        return 'home'
    if p == '/404':
        return 'not-found'
    return p.strip('/').replace('/', '--')


def extract_page(rel, chrome):
    html = open(os.path.join(SRC, rel), encoding='utf-8').read()
    path = page_path(rel)
    slug = slug_of(path)
    main_open = html.index('<main id="main">') + len('<main id="main">')
    main_close = html.index('</main>')
    fstart = html.index('<footer')
    fend = html.index('</footer>') + len('</footer>')
    main = html[main_open:main_close]
    head, meta, faq = tokenise_head(html[:main_open], main)
    page = {
        'slug': slug, 'name': NAMES.get(path, path), 'path': path, 'file': rel,
        'group': next(g for g, test in GROUPS if test(path)), 'meta': meta, 'head': head,
    }
    if faq:
        page['faqSchema'] = faq
    nodes = parse(main)
    sections = []
    order = []
    pos = 0
    for i, nd in enumerate(nodes):
        assert nd.tag == 'section', (slug, nd.tag)
        before = main[pos:nd.start]
        assert not text_of(before), (slug, before)
        pos = nd.end
        ex = Extractor()
        template = ex.render(nd, main)
        sid = nd.attr('id')
        kind = 'hero' if i == 0 else ('faq' if 'faqs' in nd.classes() else 'content')
        part = {
            'key': sid or f's{i + 1}', 'kind': kind, 'label': section_label(nd, main, i, path), 'tag': 'section',
            'attrs': attrs_of(nd, main), 'before': before, 'template': template, 'fields': ex.fields,
        }
        if ex.lists:
            part['lists'] = ex.lists
        sections.append(part)
        order.append(f'section:{i}')
    page['sections'] = sections
    page['order'] = order
    page['mainEnd'] = main[pos:]
    page['afterMain'] = html[main_close:fstart]
    # the footer: shared words, this page's own links
    fseg = html[fstart:fend].replace('<li>Warrnambool VIC 3280</li>', '<li>{{localityLine}}</li>')
    _, ftemplate, ffields = footer_part(fseg)
    if chrome.get('footer') is None:
        chrome['footer'] = {'key': 'footer', 'kind': 'footer', 'label': 'Footer', 'fields': ffields}
    else:
        ref = chrome['footer']['fields']
        assert [(f['id'], f['type'], f['value']) for f in ffields] == [(f['id'], f['type'], f['value']) for f in ref], slug
    page['footer'] = ftemplate
    page['tail'] = html[fend:]
    return page


def main():
    os.makedirs(os.path.join(OUT, 'pages'), exist_ok=True)
    files = []
    for d, _, fs in os.walk(SRC):
        for f in fs:
            if f.endswith('.html'):
                files.append(os.path.relpath(os.path.join(d, f), SRC))
    files.sort(key=lambda r: (r != 'about/index.html', r))  # the shared footer is taken from About
    chrome = {'footer': None}
    total = 0
    for rel in files:
        page = extract_page(rel, chrome)
        with open(os.path.join(OUT, 'pages', page['slug'] + '.json'), 'w', encoding='utf-8') as fh:
            json.dump(page, fh, ensure_ascii=False, indent=1)
            fh.write('\n')
        n = sum(len(s['fields']) for s in page['sections'])
        total += n
        lists = sum(len(s.get('lists', [])) for s in page['sections'])
        print(f"{page['slug']:<60} {len(page['sections'])} sections {n:>4} fields {lists} lists")
    with open(os.path.join(OUT, 'chrome.json'), 'w', encoding='utf-8') as fh:
        json.dump({'parts': {'footer': chrome['footer']}}, fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print('footer', len(chrome['footer']['fields']), 'fields;', len(files), 'pages,', total, 'fields')


main()
