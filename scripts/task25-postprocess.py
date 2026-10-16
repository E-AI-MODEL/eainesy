#!/usr/bin/env python3
"""Task 25 — footer-postprocessing volgens toc.md:
1) Verwijder lege <w:pgNumType/> (cover-sectie, WPS-verwarring).
2) Patch footer-PAGE-velden met expliciete formaat-switches:
   - footer behorend bij de TOC-sectie  -> PAGE \\* ROMAN
   - footer behorend bij de body-sectie -> PAGE \\* arabic
Sectie->footer mapping via document.xml sectPr-volgorde + rels.
"""
import re, shutil, sys, zipfile, os

DOC = '/home/z/my-project/download/EAInesy-Task25-uiux-brandingrapport.docx'
TMP = DOC + '.tmp'

with zipfile.ZipFile(DOC, 'r') as z:
    names = z.namelist()
    data = {n: z.read(n) for n in names}

docxml = data['word/document.xml'].decode('utf-8')

# 1) lege pgNumType weg
before = docxml.count('<w:pgNumType/>')
docxml = docxml.replace('<w:pgNumType/>', '')
print(f"lege pgNumType verwijderd: {before}")

# 2) sectievolgorde: elke sectPr met footerReference r:id, en fmt uit pgNumType
sectprs = re.findall(r'<w:sectPr[^>]*>.*?</w:sectPr>', docxml, re.S)
rels = data['word/_rels/document.xml.rels'].decode('utf-8')
rid2file = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels))

plan = []  # (footerfile, fmt)
for sp in sectprs:
    fmt = 'upperRoman' if 'upperRoman' in sp else ('decimal' if 'w:pgNumType' in sp and 'fmt="decimal"' in sp else None)
    for rid in re.findall(r'<w:footerReference[^>]*r:id="(rId\d+)"', sp):
        f = rid2file.get(rid)
        if f and fmt:
            plan.append((f, fmt))

print('sectieplan:', plan)
for f, fmt in plan:
    key = 'word/' + f
    if key not in data:
        continue
    xml = data[key].decode('utf-8')
    switch = 'ROMAN' if fmt == 'upperRoman' else 'arabic'
    new = re.sub(r'(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)',
                 rf'\1 PAGE \\* {switch} \\* MERGEFORMAT \2', xml)
    if new != xml:
        data[key] = new.encode('utf-8')
        print(f'  {f}: PAGE -> PAGE \\* {switch}')
    else:
        print(f'  {f}: geen bare PAGE gevonden (reeds geformatteerd of afwezig)')

data['word/document.xml'] = docxml.encode('utf-8')

with zipfile.ZipFile(TMP, 'w', zipfile.ZIP_DEFLATED) as z:
    for n in names:
        z.writestr(n, data[n])
shutil.move(TMP, DOC)
print('klaar:', DOC)
