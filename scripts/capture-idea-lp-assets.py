#!/usr/bin/env python3
"""Capture the public IDEA landing-page CSS and static visual assets.

JavaScript, tracking endpoints and video files are deliberately excluded.
Images/fonts are saved byte-for-byte; CSS changes only resource URLs.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlsplit, urldefrag, unquote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PAGE = 'https://www.jetbrains.com/idea/'
SOURCE = ROOT / 'output/playwright/idea-lp-v39/original.html'
DEST = ROOT / 'dist/idea-lp-assets'
DEST.mkdir(parents=True, exist_ok=True)
URL_PATTERN = re.compile(r'''url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)''', re.I)
IMPORT_PATTERN = re.compile(r'@import\s+[\'\"]([^\'\"]+)[\'\"]', re.I)
VIDEO_EXT = {'.mp4', '.webm', '.mov', '.m4v'}


def canonical(value, base=PAGE):
    value = value.strip()
    if not value or value.startswith(('data:', '#', 'blob:')):
        return None
    url = urldefrag(urljoin(base, value))[0]
    if urlsplit(url).scheme not in ('http', 'https'):
        return None
    if Path(urlsplit(url).path).suffix.lower() in VIDEO_EXT:
        return None
    return url


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()
        self.stylesheets = []
        self.in_style = False

    def add(self, value):
        url = canonical(value)
        if url:
            self.urls.add(url)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'style':
            self.in_style = True
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            url = canonical(attrs.get('href', ''))
            if url:
                self.stylesheets.append(url)
                self.urls.add(url)
        if tag in ('img', 'source', 'video'):
            for key in ('src', 'poster'):
                self.add(attrs.get(key, ''))
            for item in attrs.get('srcset', '').split(','):
                if item.strip():
                    self.add(item.strip().split()[0])
        for match in URL_PATTERN.finditer(attrs.get('style', '')):
            self.add(next(value for value in match.groups() if value is not None))


    def handle_endtag(self, tag):
        if tag == 'style':
            self.in_style = False

    def handle_data(self, text):
        if self.in_style:
            for match in URL_PATTERN.finditer(text):
                self.add(next(value for value in match.groups() if value is not None))


parser = Assets()
if SOURCE.exists():
    source_html = SOURCE.read_text()
else:
    with urlopen(Request(PAGE, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as response:
        source_html = response.read().decode('utf-8')
parser.feed(source_html)
hydrated = ROOT / 'output/playwright/idea-lp-v39/hydrated-top.html'
hydrated_parser = Assets()
if hydrated.exists():
    hydrated_parser.feed(hydrated.read_text())
    parser.urls.update(hydrated_parser.urls)
# The source favicon route is unavailable; the page can use its embedded logo.
original_bytes = {}
content_types = {}
missing = {}


previous = json.loads((DEST / 'manifest.json').read_text()).get('assets', {}) if (DEST / 'manifest.json').exists() else {}


def fetch(url):
    cached = previous.get(url)
    if cached and cached['source_sha256'] == cached['local_sha256']:
        path = ROOT / 'dist' / cached['path']
        if path.exists() and sha256(path.read_bytes()).hexdigest() == cached['source_sha256']:
            return path.read_bytes(), cached['content_type']
    with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; landing-page-prototype-capture)'}), timeout=30) as response:
        return response.read(), response.headers.get_content_type()


pending = parser.urls.copy()
with ThreadPoolExecutor(max_workers=8) as pool:
    while pending:
        jobs = {pool.submit(fetch, url): url for url in sorted(pending)}
        pending = set()
        for future in as_completed(jobs):
            url = jobs[future]
            try:
                body, kind = future.result()
            except Exception as error:
                missing[url] = str(error)
                continue
            original_bytes[url] = body
            content_types[url] = kind
            if kind == 'text/css' or urlsplit(url).path.endswith('.css'):
                css = body.decode('utf-8')
                values = [next(value for value in m.groups() if value is not None) for m in URL_PATTERN.finditer(css)] + IMPORT_PATTERN.findall(css)
                for value in values:
                    referenced = canonical(value, url)
                    if referenced and referenced not in original_bytes and referenced not in jobs.values() and referenced not in missing:
                        pending.add(referenced)


def filename(url):
    name = Path(unquote(urlsplit(url).path)).name or 'asset'
    name = re.sub(r'[^A-Za-z0-9._-]+', '-', name)
    return sha256(url.encode()).hexdigest()[:10] + '-' + name


mapping = {url: 'idea-lp-assets/' + filename(url) for url in original_bytes}
records = {}
for url, body in sorted(original_bytes.items()):
    kind = content_types[url]
    modified = body
    if kind == 'text/css' or urlsplit(url).path.endswith('.css'):
        def replace_url(match):
            value = next(value for value in match.groups() if value is not None)
            target = canonical(value, url)
            if target not in mapping:
                return match[0]
            fragment = urlsplit(urljoin(url, value)).fragment
            return 'url("./' + filename(target) + ('#' + fragment if fragment else '') + '")'
        css = URL_PATTERN.sub(replace_url, body.decode('utf-8'))
        css = IMPORT_PATTERN.sub(lambda m: '@import "./' + filename(canonical(m[1], url)) + '"' if canonical(m[1], url) in mapping else m[0], css)
        modified = css.encode()
    (DEST / filename(url)).write_bytes(modified)
    records[url] = {
        'path': mapping[url], 'content_type': kind,
        'source_sha256': sha256(body).hexdigest(),
        'local_sha256': sha256(modified).hexdigest(),
        'bytes': len(modified), 'css_urls_rewritten': modified != body,
    }

(DEST / 'url-map.json').write_text(json.dumps(mapping, indent=2) + '\n')
(DEST / 'manifest.json').write_text(json.dumps({
    'source_page': PAGE,
    'captured_at': datetime.now(timezone.utc).isoformat(),
    'purpose': 'Separate IDEA landing-page prototype; JetBrains images/fonts preserved; CSS resource URLs localized. No original video files or scripts.',
    'stylesheet_order': parser.stylesheets,
    'hydrated_stylesheet_order': hydrated_parser.stylesheets,
    'assets': records,
    'missing': missing,
    'excluded': [{'url': 'https://www.jetbrains.com/favicon.svg', 'reason': 'Source route returned HTTP 404; use an embedded favicon instead.'}],
    'video_files_omitted': True,
}, indent=2) + '\n')
print(json.dumps({'assets': len(records), 'stylesheets': len(parser.stylesheets), 'bytes': sum(r['bytes'] for r in records.values()), 'missing': missing}, indent=2))
if missing:
    raise SystemExit(1)
