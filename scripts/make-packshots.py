#!/usr/bin/env python3
"""Builds "usual pick vs cleaner swap" comparison images from real product photos.

    python scripts/make-packshots.py images/packshots/<slug>.json

Spec: { "slug": "...", "pairs": [ { "name": "ketchup", "usual": [["heinz", "Heinz Tomato Ketchup"]],
        "swap": [["primal-kitchen", "Primal Kitchen Unsweetened"]] } ], "hero": { "name": "cart", "pairs": [...names] } }
Photos live in images/products/<key>.src (the brand's or retailer's own product shot, as downloaded).
Optional "crop": { "<key>": [left, top, right, bottom] } as fractions of the photo.
Output: site/assets/guides/<slug>-<name>-1.jpg, 1200 px wide. Needs Pillow.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROD = os.path.join(ROOT, 'images', 'products')
FONTS = os.path.join(ROOT, 'images', 'fonts')
OUT = os.path.join(ROOT, 'site', 'assets', 'guides')
PAPER, LINE, INK, INK_SOFT = '#faf8f3', '#e2ded1', '#1a1a1a', '#5f5f5c'
RED, FOREST = '#8b2c2c', '#1a4a1a'


def font(w, size):
    return ImageFont.truetype(os.path.join(FONTS, f'LeagueSpartan-{w}.ttf'), size)


def photo(key, crops):
    im = Image.open(os.path.join(PROD, key + '.src'))
    im = ImageOps.exif_transpose(im).convert('RGBA')
    bg = Image.new('RGBA', im.size, 'white'); bg.alpha_composite(im); im = bg.convert('RGB')
    if key in crops:
        l, t, r, b = crops[key]; W, H = im.size
        im = im.crop((int(l * W), int(t * H), int(r * W), int(b * H)))
    # trim near-white margins so every pack fills its card the same way
    gray = ImageOps.invert(im.convert('L')).point(lambda v: 255 if v > 12 else 0)
    box = gray.getbbox()
    return im.crop(box) if box else im


def card(d, canvas, x, y, w, h, key, label, crops, name_size):
    d.rounded_rectangle((x, y, x + w, y + h), 22, fill='white', outline=LINE, width=2)
    im = photo(key, crops)
    name_h = name_size * 2 + 26
    im.thumbnail((w - 48, h - name_h - 40), Image.LANCZOS)
    canvas.paste(im, (x + (w - im.width) // 2, y + 24 + (h - name_h - 40 - im.height) // 2))
    f = font(500, name_size)
    words, lines, cur = label.split(), [], ''
    for wd in words:
        t = (cur + ' ' + wd).strip()
        if d.textlength(t, font=f) > w - 32 and cur: lines.append(cur); cur = wd
        else: cur = t
    lines.append(cur)
    ty = y + h - name_h + (name_h - len(lines) * (name_size + 6)) // 2
    for ln in lines[:2]:
        d.text((x + w / 2, ty), ln, font=f, fill=INK, anchor='mt'); ty += name_size + 6


def arrow(d, x, y, w, color):
    d.line((x, y, x + w - 8, y), fill=color, width=5)
    d.polygon([(x + w, y), (x + w - 12, y - 9), (x + w - 12, y + 9)], fill=color)


def pill(d, x, y, text, color, size=30):
    f = font(700, size); tw = d.textlength(text, font=f)
    d.rounded_rectangle((x, y, x + tw + 44, y + size + 26), (size + 26) // 2, fill=color)
    d.text((x + 22, y + (size + 26) / 2 + 2), text, font=f, fill='white', anchor='lm')


def pair_image(p, crops, path):
    W, H, M, G = 1200, 760, 36, 36
    im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
    colw = (W - 2 * M - G) // 2
    for side, (items, label, color) in enumerate(((p['usual'], 'Usual pick', RED), (p['swap'], 'Cleaner swap', FOREST))):
        x0 = M + side * (colw + G)
        pill(d, x0, M, label, color)
        top = M + 56 + 24; h = H - top - M
        n = len(items); cg = 20
        if p.get('stack') and side == 1:  # wide packs: one card above the other
            ch = (h - cg * (n - 1)) // n
            for i, (key, name) in enumerate(items):
                card(d, im, x0, top + i * (ch + cg), colw, ch, key, name, crops, 26)
            continue
        cw = (colw - cg * (n - 1)) // n
        for i, (key, name) in enumerate(items):
            card(d, im, x0 + i * (cw + cg), top, cw, h, key, name, crops, 30 if n == 1 else 26)
    d.line((W // 2, M + 10, W // 2, H - M - 10), fill=LINE, width=3)
    im.save(path, 'JPEG', quality=86, optimize=True, progressive=True)


def hero_image(spec, crops, path):
    pairs = {p['name']: p for p in spec['pairs']}
    names = spec['hero']['pairs']
    cols, rows = 3, (len(names) + 2) // 3
    W, M, G = 1200, 28, 20
    cw = (W - 2 * M - (cols - 1) * G) // cols; ch = 250
    H = M * 2 + 64 + rows * ch + (rows - 1) * G
    im = Image.new('RGB', (W, H), PAPER); d = ImageDraw.Draw(im)
    pill(d, M, M, 'Usual pick', RED, 24)
    f = font(700, 24); x2 = M + d.textlength('Usual pick', font=f) + 44 + 52
    arrow(d, x2 - 44, M + 25, 32, INK_SOFT)
    pill(d, x2, M, 'Cleaner swap', FOREST, 24)
    for i, n in enumerate(names):
        p = pairs[n]; x = M + (i % cols) * (cw + G); y = M + 64 + (i // cols) * (ch + G)
        d.rounded_rectangle((x, y, x + cw, y + ch), 20, fill='white', outline=LINE, width=2)
        half = (cw - 64) // 2
        for j, key in enumerate((p['usual'][0][0], p['swap'][0][0])):
            ph = photo(key, crops); ph.thumbnail((half - 8, ch - 60), Image.LANCZOS)
            px = x + 14 + j * (half + 36) + (half - ph.width) // 2
            canvas_y = y + 14 + (ch - 60 - ph.height) // 2
            im.paste(ph, (px, canvas_y))
        arrow(d, x + cw / 2 - 13, y + 14 + (ch - 60) // 2, 26, FOREST)
        d.text((x + cw / 2, y + ch - 24), p['title'], font=font(500, 22), fill=INK, anchor='mm')
    im.save(path, 'JPEG', quality=86, optimize=True, progressive=True)


def main():
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    crops = spec.get('crop', {})
    os.makedirs(OUT, exist_ok=True)
    for p in [q for q in spec['pairs'] if not q.get('skipPair')]:
        out = os.path.join(OUT, f"{spec['slug']}-{p['name']}-1.jpg"); pair_image(p, crops, out); print(' ', out)
    if 'hero' in spec:
        out = os.path.join(OUT, f"{spec['slug']}-{spec['hero']['name']}-1.jpg"); hero_image(spec, crops, out); print(' ', out)


if __name__ == '__main__':
    main()
