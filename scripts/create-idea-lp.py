#!/usr/bin/env python3
"""Prepare the separate static landing page from a hydrated public reference.

Maintenance only (requires lxml). The committed page builds without Python or
network access. Capture a fresh hydrated DOM and assets before using --source.
"""
import argparse
import base64
from copy import deepcopy
import json
from pathlib import Path
import re
from urllib.parse import urldefrag, urljoin
from lxml import html, etree

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=ROOT / 'output/playwright/idea-lp-v39/hydrated-top.html')
args = parser.parse_args()
PAGE = 'https://www.jetbrains.com/idea/'
mapping = json.loads((ROOT / 'dist/idea-lp-assets/url-map.json').read_text())
doc = html.fromstring(args.source.read_text())


def elements_with_class(name, root=doc):
    return root.xpath('.//*[contains(concat(" ",normalize-space(@class)," ")," ' + name + ' ")]')


def local(value):
    if not value or value.startswith(('data:', '#', 'about:')):
        return value
    url, fragment = urldefrag(urljoin(PAGE, value))
    if url not in mapping:
        raise ValueError('Uncaptured visual asset: ' + url)
    return mapping[url] + ('#' + fragment if fragment else '')


# Keep the resolved page, without the original site's execution or analytics.
for element in doc.xpath('//script|//iframe|//noscript|//template'):
    element.drop_tree()
for element in elements_with_class('ch2'):
    element.drop_tree()
for element in doc.xpath('//link'):
    if element.get('rel') != 'stylesheet' or 'cookie-banner' in element.get('href', ''):
        element.drop_tree()
for element in doc.xpath('//meta[@http-equiv]|//meta[@property]|//meta[@name="twitter:card"]'):
    element.drop_tree()
for element in doc.iter():
    if not isinstance(element.tag, str):
        continue
    for key in list(element.attrib):
        if key.lower().startswith(('on', 'data-gtm', 'data-google', 'nonce')):
            del element.attrib[key]

# Retain the original imagery around the main movie; replace its player only.
hero = elements_with_class('idea-hero-media')[0]
content = elements_with_class('ides-lib-hero-media__content', hero)[0]
mobile_player = deepcopy(content[0])
mobile_player.set('class', mobile_player.get('class', '') + ' idea-mobile-video')
mobile_video = mobile_player.xpath('.//video')[0]
mobile_video.set('id', 'idea-mobile-video')
mobile_video.set('aria-label', 'IntelliJ IDEA overview video')
mobile_video.set('preload', 'none')
mobile_video.set('playsinline', '')
for source in mobile_video.xpath('.//source'):
    source.set('data-src', source.attrib.pop('src'))
for child in list(content):
    content.remove(child)
content.append(html.fromstring('''<div class="idea-interactive-demo" id="idea-demo">
  <div class="idea-demo-toolbar" aria-label="Interactive demo controls">
    <div class="idea-demo-copy"><div class="idea-demo-meta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m5 3 14 9-7 1-3 7-4-17Z"/></svg><strong>Interactive demo</strong><span class="idea-demo-separator" aria-hidden="true">·</span><span id="idea-demo-state" role="status" aria-live="polite">Click to explore</span></div><p>Click files, explore agent sessions, inspect debugger variables.</p></div>
    <button class="idea-demo-control" id="idea-demo-control" type="button" data-mode="explore" aria-controls="idea-widget">Explore yourself</button>
  </div>
  <div class="idea-widget" id="idea-widget-shell" aria-label="Interactive IntelliJ IDEA demo">
  <img class="idea-widget-placeholder" src="https://resources.jetbrains.com/storage/products/intellij-idea/video/overview/hero.png" alt="" loading="lazy">
  <iframe id="idea-widget" title="Interactive IntelliJ IDEA — NotifyHub" data-src="./index.html?workspace=idea-lp" allowfullscreen></iframe>
  <button class="idea-widget-fullscreen" id="idea-widget-fullscreen" type="button" aria-label="Expand IDE widget" title="Expand IDE widget"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/></svg></button>
  </div>
</div>'''))
content.append(mobile_player)

# Secondary feature demos keep their native previews and link to their movies.
# No remote media is loaded just to view the landing-page prototype.
feature_players = []
for video in doc.xpath('//video[not(@id="idea-mobile-video")]'):
    source = video.find('source')
    remote = source.get('src') if source is not None else PAGE
    poster = video.get('poster')
    image = html.Element('img', src=poster, alt='IntelliJ IDEA feature preview', loading='lazy')
    image.set('class', 'idea-feature-poster')
    image.set('data-lp-light-src', local(poster.replace('-dark-', '-light-')))
    image.set('data-lp-dark-src', local(poster.replace('-light-', '-dark-')))
    container = video.getparent()
    video.getparent().replace(video, image)
    container.set('data-feature-video', remote)
    feature_players.append((poster, remote))
    for control in container.xpath('.//button'):
        label = control.get('aria-label', '')
        if label in ['Play', 'Full screen']:
            control.tag = 'a'
            control.set('href', remote)
            control.set('target', '_blank')
            control.set('rel', 'noopener noreferrer')
            control.set('aria-label', 'Watch feature video' if label == 'Play' else 'Open feature video')
            for key in ['type', 'aria-pressed']:
                control.attrib.pop(key, None)
        else:
            control.set('disabled', '')
    for slider in container.xpath('.//*[@role="slider"]'):
        slider.attrib.pop('role', None)
        slider.set('tabindex', '-1')
        slider.set('aria-hidden', 'true')

# Populate all four desktop feature slides, which the original loads on demand.
unique_players = list(dict.fromkeys(feature_players))
slideshow = elements_with_class('ides-lib-features-showcase__slideshow')[0]
slides = elements_with_class('slideshow__slide', slideshow)
first_frame = slides[0][0]
for index, slide in enumerate(slides):
    if index:
        for child in list(slide):
            slide.remove(child)
        frame = deepcopy(first_frame)
        slide.append(frame)
        poster, movie = unique_players[min(index, len(unique_players) - 1)]
        frame.xpath('.//img')[0].set('src', poster)
        frame.xpath('.//img')[0].set('data-lp-light-src', local(poster.replace('-dark-', '-light-')))
        frame.xpath('.//img')[0].set('data-lp-dark-src', local(poster.replace('-light-', '-dark-')))
        for a in frame.xpath('.//a'):
            a.set('href', movie)
    slide.set('data-lp-slide', str(index))
for index, tab in enumerate(elements_with_class('slideshow__tab', slideshow)):
    tab.set('data-lp-feature', str(index))
    tab.set('aria-pressed', 'true' if index == 0 else 'false')

for carousel in elements_with_class('jb-snap-carousel-block'):
    noun = 'customer story' if 'ides-lib-testimonials-carousel-block' in carousel.get('class', '') else 'slide'
    for index, button in enumerate(carousel.xpath('.//div[contains(@class,"jb-carousel-controls")]/button')):
        button.set('data-lp-carousel', str(-1 if index == 0 else 1))
        button.set('aria-label', ('Previous ' if index == 0 else 'Next ') + noun)
        button.attrib.pop('disabled', None)
        button.set('class', button.get('class', '').replace('_disabled_l33nyt_141', '').strip())

for image in doc.xpath('//img'):
    image.set('decoding', 'async')
    if not image.get('class', '').startswith('idea-social-proof') and 'header-img' not in image.get('src', ''):
        image.set('loading', 'lazy')

for element in doc.iter():
    if not isinstance(element.tag, str):
        continue
    for key in ['src', 'poster']:
        if element.get(key):
            element.set(key, local(element.get(key)))
    if element.get('srcset'):
        parts = []
        for part in element.get('srcset').split(','):
            resource, *descriptor = part.strip().split()
            parts.append(' '.join([local(resource), *descriptor]))
        element.set('srcset', ', '.join(parts))
    if element.tag == 'link' and element.get('href'):
        element.set('href', local(element.get('href')))
    if element.tag == 'a' and element.get('href'):
        href = element.get('href')
        if not href.startswith(('#', 'mailto:', 'tel:')):
            absolute = urljoin(PAGE, href)
            element.set('href', 'idea-lp.html' if absolute == PAGE else absolute)
        if element.get('target') == '_blank':
            element.set('rel', 'noopener noreferrer')
    if element.get('style'):
        element.set('style', re.sub(r'url\(([^)]+)\)', lambda m: 'url("' + local(m[1].strip('\'" ')) + '")', element.get('style')))

head = doc.find('head')
doc.find('.//title').text = 'IntelliJ IDEA — Interactive landing page prototype'
head.append(html.Element('meta', name='robots', content='noindex, nofollow'))
icon = doc.xpath('//*[@class="menu-second-title-box__logo"]/*')[0]
icon = deepcopy(icon)
icon.set('xmlns', 'http://www.w3.org/2000/svg')
if 'viewbox' in icon.attrib:
    icon.set('viewBox', icon.attrib.pop('viewbox'))
icon_bytes = etree.tostring(icon, method='xml')
head.append(html.Element('link', rel='icon', href='data:image/svg+xml;base64,' + base64.b64encode(icon_bytes).decode()))
head.append(html.Element('link', rel='stylesheet', href='idea-lp.css'))
script = html.Element('script', src='idea-lp.js', defer='')
doc.find('body').append(script)
(ROOT / 'dist/idea-lp.html').write_text('<!doctype html>\n<!-- Separate landing-page study based on https://www.jetbrains.com/idea/. The IDE is embedded unchanged. -->\n' + html.tostring(doc, encoding='unicode', method='html') + '\n')
print('Created dist/idea-lp.html with local visual assets and an isolated IDE iframe.')
