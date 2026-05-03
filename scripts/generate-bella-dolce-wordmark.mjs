/**
 * Luxury "Bella Dolce" wordmark → SVG (vector paths) + PNG.
 *
 * - Glyphs: **Great Vibes** (google/fonts OFL), laid out per-glyph + kerning so opentype.js
 *   does not hit unsupported ligature/CCMP tables.
 * - Style: gold gradients (#8C6A2F / #CFAE5B / #F5E6A5), embossed filter, ~15° skew,
 *   decorative underline path (approximation of a hand-drawn flourish).
 * - Outputs:
 *   - public/bella-dolce-wordmark.svg — transparent
 *   - public/bella-dolce-wordmark-on-white.svg — white backing
 *   - public/bella-dolce-wordmark.png — raster ~2400px wide (print-friendly)
 *
 * For B/D flourishes and contrast exactly as a bespoke trace, open the SVG in Illustrator
 * / Inkscape and refine paths; re-export and replace the public files.
 *
 * Run: npm run wordmark
 */
import opentype from 'opentype.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outSvg = path.join(root, 'public', 'bella-dolce-wordmark.svg');
const outSvgWhite = path.join(root, 'public', 'bella-dolce-wordmark-on-white.svg');
const outPng = path.join(root, 'public', 'bella-dolce-wordmark.png');

const FONT_URL =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf';
const fontFile = path.join(__dirname, 'GreatVibes-Regular.ttf');

async function ensureFont() {
  if (fs.existsSync(fontFile)) return;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
  fs.writeFileSync(fontFile, Buffer.from(await res.arrayBuffer()));
}

function pathFromGlyphs(font, text, x, y, fontSize) {
  const out = new opentype.Path();
  let penX = x;
  const scale = fontSize / font.unitsPerEm;
  for (let i = 0; i < text.length; i++) {
    const g = font.charToGlyph(text[i]);
    out.extend(g.getPath(penX, y, fontSize));
    const kern =
      i < text.length - 1 ? scale * font.getKerningValue(g, font.charToGlyph(text[i + 1])) : 0;
    penX += g.advanceWidth * scale + kern;
  }
  return out;
}

function flourishPath(bbox, w, pad) {
  const x0 = bbox.x1 + pad + (bbox.x2 - bbox.x1) * 0.38;
  const x1 = w - pad * 0.25;
  const y0 = bbox.y2 + pad + 10;
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} Q ${((x0 + x1) / 2 + 24).toFixed(1)} ${(y0 + 16).toFixed(1)} ${x1.toFixed(1)} ${(y0 - 3).toFixed(1)}`;
}

function buildSvg(font, { withWhiteBg, suffix }) {
  const fontSize = 128;
  const text = 'Bella Dolce';
  const baselineY = fontSize * 0.72;
  const p = pathFromGlyphs(font, text, 0, baselineY, fontSize);
  const pathData = p.toPathData(2);
  const bbox = p.getBoundingBox();
  const pad = 52;
  const skewPadX = Math.tan((15 * Math.PI) / 180) * (bbox.y2 - bbox.y1) * 0.48;
  const w = bbox.x2 - bbox.x1 + pad * 2 + skewPadX;
  const h = bbox.y2 - bbox.y1 + pad * 2 + 42;
  const ox = -bbox.x1 + pad + skewPadX * 0.35;
  const oy = -bbox.y1 + pad;
  const flourD = flourishPath(bbox, w, pad);

  const bgRect = withWhiteBg ? `<rect width="100%" height="100%" fill="#FFFFFF"/>\n  ` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" width="800" height="220">
  ${bgRect}<defs>
    <linearGradient id="goldFill${suffix}" x1="8%" y1="0%" x2="92%" y2="100%">
      <stop offset="0%" stop-color="#8C6A2F"/>
      <stop offset="50%" stop-color="#CFAE5B"/>
      <stop offset="100%" stop-color="#F5E6A5"/>
    </linearGradient>
    <linearGradient id="goldStroke${suffix}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6B5224"/>
      <stop offset="55%" stop-color="#E8D48A"/>
      <stop offset="100%" stop-color="#FFFBF0"/>
    </linearGradient>
    <filter id="emboss${suffix}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.9" result="b"/>
      <feOffset in="b" dx="0" dy="1.4" result="o"/>
      <feFlood flood-color="#2a2010" flood-opacity="0.45" result="f"/>
      <feComposite in="f" in2="o" operator="in" result="s"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.35" result="b2"/>
      <feOffset in="b2" dx="0" dy="-0.6" result="hi"/>
      <feFlood flood-color="#F5E6A5" flood-opacity="0.55" result="hl"/>
      <feComposite in="hl" in2="hi" operator="in" result="shine"/>
      <feMerge>
        <feMergeNode in="s"/>
        <feMergeNode in="shine"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="goldGlow${suffix}" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="1.2" result="g"/>
      <feMerge>
        <feMergeNode in="g"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g filter="url(#goldGlow${suffix})" transform="translate(${ox.toFixed(2)},${oy.toFixed(2)}) skewX(-15)">
    <path d="${pathData}" fill="url(#goldFill${suffix})" stroke="url(#goldStroke${suffix})" stroke-width="0.65" stroke-linejoin="round" filter="url(#emboss${suffix})"/>
    <path d="${flourD}" fill="none" stroke="url(#goldFill${suffix})" stroke-width="2.2" stroke-linecap="round" filter="url(#emboss${suffix})"/>
  </g>
</svg>`;
}

await ensureFont();
const font = opentype.parse(fs.readFileSync(fontFile));

fs.mkdirSync(path.dirname(outSvg), { recursive: true });
fs.writeFileSync(outSvg, buildSvg(font, { withWhiteBg: false, suffix: 'A' }), 'utf8');
fs.writeFileSync(outSvgWhite, buildSvg(font, { withWhiteBg: true, suffix: 'B' }), 'utf8');

const pngBuf = await sharp(Buffer.from(fs.readFileSync(outSvg)))
  .resize(2400, null, { fit: 'inside', withoutEnlargement: false })
  .png()
  .toBuffer();
fs.writeFileSync(outPng, pngBuf);

console.log('Wrote', outSvg);
console.log('Wrote', outSvgWhite);
console.log('Wrote', outPng);
