/**
 * Task 25 — rapport-builder (docx, R1-recept, DM-1 palet, 3 secties).
 * Gebaseerd op de gevalideerde task24-pipeline; uitgebreid met singleShot.
 * Run: bun scripts/task25-report.mjs
 * Daarna: add_toc_placeholders.py --auto, task25-postprocess.py, postcheck.py
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, TableOfContents,
  PageBreak, TableLayoutType, ImageRun,
} from 'docx';
import fs from 'fs';
import { meta, body } from './task25-report-content.mjs';

// ── Palet DM-1 (Deep Cyan — AI/tech) ─────────────────────────────────────────
const PAL = {
  bg: '162235', primary: '162235', accent: '1B6B7A',
  cover: { titleColor: 'FFFFFF', subtitleColor: 'B0B8C0', metaColor: '90989F', footerColor: '687078' },
  table: { headerBg: '1B6B7A', headerText: 'FFFFFF', accentLine: '1B6B7A', innerLine: 'C8DDE2', surface: 'EDF3F5' },
  body: '000000', secondary: '506070',
};

const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const SHOT_DIR = '/home/z/my-project/screenshots/task25/';

// ── Titel-layout (Latijn-bewuste variant van calcTitleLayout) ────────────────
function widthUnits(text) {
  let u = 0;
  for (const ch of text) u += /[\u4e00-\u9fff\u3000-\u303f]/.test(ch) ? 1 : 0.55;
  return u;
}
function splitTitleLinesLatin(title, maxUnits) {
  const words = title.split(/\s+/);
  const lines = []; let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (widthUnits(cand) <= maxUnits || !cur) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop(); lines[lines.length - 1] += ' ' + last;
  }
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 36, minPt = 24) {
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const maxUnits = Math.floor(maxWidthTwips / (titlePt * 20));
    lines = splitTitleLinesLatin(title, maxUnits);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLinesLatin(title, Math.floor(maxWidthTwips / (minPt * 20)));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(p) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = p;
  const SAFETY = 1200;
  const usable = pageHeight - marginTop - marginBottom - SAFETY;
  const contentH = titleLineCount * (titlePt * 23 + 200)
    + (hasSubtitle ? (12 * 23 + 600) : 0)
    + (hasEnglishLabel ? (9 * 23 + 600) : 0)
    + metaLineCount * (10 * 23 + 100)
    + fixedHeight + 3 * 300;
  const rem = Math.max(usable - contentH, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(rem * 0.45), rawBottom = Math.floor(rem * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: Math.max(rem - topSpacing - bottomSpacing, 0), bottomSpacing };
}

// ── Cover R1 (Pure Paragraph Left) ───────────────────────────────────────────
function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 36, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split('').join('  '), size: 18, color: P.accent, font: { ascii: 'Calibri', eastAsia: 'SimHei' }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: 'atLeast' },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: P.cover.titleColor, font: { eastAsia: 'SimHei', ascii: 'Arial' } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 800, line: 320, lineRule: 'atLeast' },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.cover.subtitleColor, font: { eastAsia: 'Microsoft YaHei', ascii: 'Arial' } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200, right: padR }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 22, color: P.cover.metaColor, font: { eastAsia: 'Microsoft YaHei', ascii: 'Arial' } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || '', size: 16, color: P.cover.footerColor, font: { ascii: 'Arial' } }),
      new TextRun({ text: '                                        ' }),
      new TextRun({ text: config.footerRight || '', size: 16, color: P.cover.footerColor, font: { ascii: 'Arial' } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: 'exact' },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        verticalAlign: 'top',
        children,
      })],
    })],
  })];
}

// ── Body-builders ─────────────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: PAL.primary, font: { ascii: 'Calibri', eastAsia: 'SimHei' } })],
  });
}
function para(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 22, color: PAL.body, font: { ascii: 'Calibri', eastAsia: 'SimSun' } })],
  });
}
function caption(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 20, color: PAL.primary, font: { ascii: 'Calibri', eastAsia: 'SimHei' } })],
  });
}
function makeTable({ headers, rows }) {
  const widths = headers.length === 3 ? [10, 45, 45] : [30, 70];
  const cellP = (text, bold, color) => new Paragraph({
    spacing: { line: 276 },
    children: [new TextRun({ text, bold: !!bold, size: 18, color: color || PAL.body, font: { ascii: 'Calibri', eastAsia: 'SimSun' } })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: PAL.table.innerLine },
      insideVertical: NB,
    },
    rows: [
      new TableRow({
        tableHeader: true, cantSplit: true,
        children: headers.map((t, i) => new TableCell({
          children: [cellP(t, true, PAL.table.headerText)],
          shading: { type: ShadingType.CLEAR, fill: PAL.table.headerBg },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
        })),
      }),
      ...rows.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((t, i) => new TableCell({
          children: [cellP(t, false)],
          shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: PAL.table.surface } : undefined,
          margins: { top: 50, bottom: 50, left: 120, right: 120 },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
        })),
      })),
    ],
  });
}

// ── Screenshot-paar (voor | na) + losse afbeelding ───────────────────────────
function shotCell(file, w, h, label) {
  const imgW = 250;
  const imgH = Math.round(imgW * h / w);
  return new TableCell({
    borders: noBorders,
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
    width: { size: 50, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new ImageRun({
          type: 'png',
          data: fs.readFileSync(SHOT_DIR + file),
          transformation: { width: imgW, height: imgH },
        })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [new TextRun({ text: label, bold: true, size: 18, color: PAL.secondary, font: { ascii: 'Calibri', eastAsia: 'SimSun' } })],
      }),
    ],
  });
}
function imgPairItem({ left, right, w, h, caption: cap }) {
  const tbl = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      cantSplit: true,
      children: [shotCell(left, w, h, 'V\u00f3\u00f3r'), shotCell(right, w, h, 'Na')],
    })],
  });
  return [
    tbl,
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 200, line: 276 },
      children: [new TextRun({ text: cap, size: 18, color: PAL.secondary, font: { ascii: 'Calibri', eastAsia: 'SimSun' } })],
    }),
  ];
}
function singleShotItem({ file, w, h, caption: cap }) {
  const imgW = 510;
  const imgH = Math.round(imgW * h / w);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [new ImageRun({
        type: 'png',
        data: fs.readFileSync(SHOT_DIR + file),
        transformation: { width: imgW, height: imgH },
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 200, line: 276 },
      children: [new TextRun({ text: cap, size: 18, color: PAL.secondary, font: { ascii: 'Calibri', eastAsia: 'SimSun' } })],
    }),
  ];
}

function buildChildren(items) {
  const out = [];
  for (const it of items) {
    if (it.h1) out.push(h1(it.h1));
    else if (it.h2) out.push(h1(it.h2));
    else if (it.p) out.push(para(it.p));
    else if (it.note) out.push(para(it.note));
    else if (it.table) { out.push(caption(it.table.caption)); out.push(makeTable(it.table)); out.push(new Paragraph({ spacing: { after: 120 }, children: [] })); }
    else if (it.imgPair) out.push(...imgPairItem(it.imgPair));
    else if (it.singleShot) out.push(...singleShotItem(it.singleShot));
  }
  return out;
}

// ── Voettekst / koptekst ─────────────────────────────────────────────────────
const pageFooter = () => new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '808080', font: { ascii: 'Calibri' } })],
  })],
});
const pageHeader = () => new Header({
  children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine, space: 4 } },
    children: [new TextRun({ text: 'EAInesy \u00b7 Task 25 \u2014 UI/UX & branding (EAI Humanizor)', size: 16, color: '808080', font: { ascii: 'Calibri' } })],
  })],
});

// ── Document ─────────────────────────────────────────────────────────────────
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  creator: 'EAInesy Task 25 UI/UX & branding',
  title: meta.title,
  styles: {
    default: {
      document: {
        run: { font: { ascii: 'Calibri', eastAsia: 'SimSun' }, size: 22, color: PAL.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: 'Calibri', eastAsia: 'SimHei' }, size: 32, bold: true, color: PAL.primary },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: { ascii: 'Calibri', eastAsia: 'SimHei' }, size: 26, bold: true, color: PAL.primary },
        paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
      },
    },
  },
  sections: [
    { // Sectie 1 — cover (marge 0, geen voettekst)
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: meta.title, subtitle: meta.subtitle, englishLabel: meta.englishLabel,
        metaLines: meta.metaLines, footerLeft: meta.footerLeft, footerRight: meta.footerRight,
        palette: PAL,
      }),
    },
    { // Sectie 2 — inhoudsopgave (romeins)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: 'Inhoudsopgave', bold: true, size: 32, font: { eastAsia: 'SimHei', ascii: 'Calibri' }, color: PAL.primary })],
        }),
        new TableOfContents('Inhoudsopgave', { hyperlink: true, headingStyleRange: '1-2' }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: 'Let op: deze inhoudsopgave is opgebouwd met veldcodes. Klik na het openen in Word met de rechtermuisknop op de inhoudsopgave en kies "Veld bijwerken" om de paginanummers te verversen.',
            italics: true, size: 18, color: '888888', font: { ascii: 'Calibri', eastAsia: 'SimSun' },
          })],
        }),
      ],
    },
    { // Sectie 3 — hoofdtekst (arabisch, vanaf 1)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: pageHeader() },
      footers: { default: pageFooter() },
      children: buildChildren(body),
    },
  ],
});

const OUT = '/home/z/my-project/download/EAInesy-Task25-uiux-brandingrapport.docx';
Packer.toBuffer(doc).then((buf) => {
  fs.mkdirSync('/home/z/my-project/download', { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log('geschreven:', OUT, buf.length, 'bytes');
});
