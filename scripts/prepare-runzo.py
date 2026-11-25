#!/usr/bin/env python3
"""Prepare the supplied Runzo portrait for a small CSS puppet (Pillow only)."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
dest = root / 'dist/v2-assets'
dest.mkdir(exist_ok=True)
source = args.source.read_bytes()
image = Image.open(args.source).convert('RGB')
assert image.size == (1024, 1536), 'This cutout is aligned to the supplied portrait.'
r, g, b = image.split()
background = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v < 42 else 0)
ImageDraw.floodfill(background, (0, 0), 128)
alpha = background.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.GaussianBlur(.55))
image = image.convert('RGBA')
image.putalpha(alpha)
records = {}
for name in ['body', 'left-leg', 'right-leg']:
    region = Image.new('L', image.size)
    draw = ImageDraw.Draw(region)
    if name == 'body':
        draw.rectangle((0, 0, 1024, 999), fill=255)
        draw.rectangle((520, 950, 1024, 1536), fill=0)
    elif name == 'left-leg':
        draw.rectangle((293, 975, 505, 1385), fill=255)
    else:
        draw.rectangle((515, 930, 712, 1385), fill=255)
    part = image.copy()
    part.putalpha(ImageChops.multiply(alpha, region))
    part = part.crop((80, 70, 975, 1400)).resize((448, 665), Image.Resampling.LANCZOS)
    import io
    output = io.BytesIO()
    part.save(output, 'WEBP', quality=94, method=6)
    data = output.getvalue()
    digest = sha256(data).hexdigest()
    filename = f'runzo-{name}.{digest[:12]}.webp'
    (dest / filename).write_bytes(data)
    records[name] = {'path': 'v2-assets/' + filename, 'sha256': digest, 'bytes': len(data)}
(dest / 'manifest.json').write_text(json.dumps({
    'source': 'User-supplied Runzo portrait, codex-clipboard-c50cc5e4-83ba-4c67-b793-855741c70b73.png',
    'source_sha256': sha256(source).hexdigest(),
    'processing': 'Connected black background removed; original face/artwork retained. Three transparent layers for CSS leg motion.',
    'assets': records,
}, indent=2) + '\n')
print(json.dumps(records, indent=2))
