"""Task 25 — Vectoriseer het EAInesy-logo-mark uit de identity board.

Aanpak: kleurclassificatie (navy/blue/cyan/violet/wit) → per kleur binaire mask →
contouren via skimage.find_contours → vereenvoudigd → SVG-paden met evenodd.
Resultaat: public/logo-mark.svg (gradiënten per kleurzone) + public/favicon.svg.
"""
import numpy as np
from PIL import Image
from skimage import measure, filters
import colorsys

SRC = "/home/z/my-project/upload/EAInesy%20Logo%20Identity%20Board.png"
OUT_MARK = "/home/z/my-project/public/logo-mark.svg"

# 1) Crop het losse mark-tegel (middenrij, links) uit de board (1536x1024)
img = Image.open(SRC).convert("RGB")
W, H = img.size  # 1536, 1024
tile = img.crop((int(W * 0.045), int(H * 0.505), int(W * 0.235), int(H * 0.745)))
# Upscale voor strakke contouren
scale = 6
big = tile.resize((tile.width * scale, tile.height * scale), Image.LANCZOS)
arr = np.asarray(big).astype(float) / 255.0

# 2) Classificatie per pixel in 5 klassen
hsv = np.zeros_like(arr)
for i in range(arr.shape[0]):
    for j in range(arr.shape[1]):
        r, g, b = arr[i, j]
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        hsv[i, j] = (h, s, v)
hue = hsv[..., 0] * 360
sat = hsv[..., 1]
val = hsv[..., 2]

white = (sat < 0.16) & (val > 0.86)
navy = (~white) & (val < 0.42) & (hue >= 200) & (hue < 275) & (sat > 0.30)
violet = (~white) & (~navy) & (hue >= 246) & (hue < 305) & (sat > 0.35) & (val >= 0.42)
cyan = (~white) & (~navy) & (~violet) & (hue < 200) & (sat > 0.40) & (val >= 0.45)
blue = (~white) & (~navy) & (~violet) & (~cyan)

masks = {"cyan": cyan, "blue": blue, "violet": violet, "navy": navy}

# 3) Contouren → SVG-paden
def mask_to_paths(mask, epsilon=2.2):
    """Binaire mask → vereenvoudigde polygonen (buiten + gaten), coördinaten in 0..100 viewbox."""
    m = mask.astype(float)
    m = filters.gaussian(m, sigma=6) > 0.5
    padded = np.pad(m, 2)
    contours = measure.find_contours(padded, 0.5)
    h, w = m.shape
    paths = []
    for c in contours:
        c = c - 2.0  # pad terug
        c = measure.approximate_polygon(c, epsilon)
        if len(c) < 3:
            continue
        pts = [(x / w * 100.0, y / h * 100.0) for y, x in c]
        d = "M" + "L".join(f"{x:.2f} {y:.2f}" for x, y in pts) + "Z"
        paths.append(d)
    return paths

order = ["cyan", "blue", "violet", "navy"]  # navy bovenop
defs = []
body = []
# Basislaag: volledige silhouet in middenblauw — voorkomt haarlijn-gaten tussen kleurlagen
silhouette = ~(white.copy())
sil_paths = mask_to_paths(silhouette)
if sil_paths:
    body.append('<path fill-rule="evenodd" fill="#0d47d9" d="' + " ".join(sil_paths) + '"/>')
for name in order:
    paths = mask_to_paths(masks[name])
    if not paths:
        continue
    d_all = " ".join(paths)
    if name == "navy":
        fill = "url(#gNavy)"
    elif name == "blue":
        fill = "url(#gBlue)"
    elif name == "cyan":
        fill = "url(#gCyan)"
    else:
        fill = "url(#gViolet)"
    body.append(f'<path fill-rule="evenodd" fill="{fill}" d="{d_all}"/>')

gradient_defs = """
  <defs>
    <linearGradient id="gNavy" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#0b1238"/>
      <stop offset="0.55" stop-color="#0d47d9"/>
      <stop offset="1" stop-color="#0f6ff5"/>
    </linearGradient>
    <linearGradient id="gBlue" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#0d47d9"/>
      <stop offset="1" stop-color="#18b6f5"/>
    </linearGradient>
    <linearGradient id="gCyan" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#08b7f0"/>
      <stop offset="1" stop-color="#22e2f5"/>
    </linearGradient>
    <linearGradient id="gViolet" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#7c3af5"/>
      <stop offset="1" stop-color="#5b21e8"/>
    </linearGradient>
  </defs>"""

svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="EAInesy">\n'
    + gradient_defs
    + "\n"
    + "\n".join(body)
    + "\n</svg>\n"
)
with open(OUT_MARK, "w") as f:
    f.write(svg)
print("Wrote", OUT_MARK, "with", len(body), "color layers")

# 4) Controle-render: raster de SVG-naive via PIL is niet mogelijk; dump masks voor visuele check
vis = np.zeros((*val.shape, 3))
vis[white] = (1, 1, 1)
vis[cyan] = (0.1, 0.8, 0.95)
vis[blue] = (0.05, 0.4, 0.95)
vis[violet] = (0.45, 0.2, 0.95)
vis[navy] = (0.05, 0.08, 0.25)
out = Image.fromarray((vis * 255).astype(np.uint8))
out = out.resize((out.width // 3, out.height // 3), Image.LANCZOS)
out.save("/home/z/my-project/screenshots/task25/logo-classification.png")
print("classification check saved")
