// Generates SVG placeholder artwork for the sample projects and products in
// public/assets/js/data/seed.js. Replace these files with real exports
// (WebP or JPG) of your work, and update the image paths in Firestore.
//
//   node scripts/generate-placeholders.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { projects, products } from '../public/assets/js/data/seed.js';

const OUT = new URL('../public/assets/img/', import.meta.url);
mkdirSync(new URL('work/', OUT), { recursive: true });
mkdirSync(new URL('products/', OUT), { recursive: true });

const FONT = `font-family="'Arial Black','Helvetica Neue',Arial,sans-serif"`;
const SANS = `font-family="'Helvetica Neue',Arial,sans-serif"`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;');

const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-opacity=".28"/></filter><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0"/></filter></defs>${body}<rect width="100%" height="100%" filter="url(#grain)"/></svg>`;

// A single poster/flyer, drawn at (0,0) with size w×h.
function poster(a, w, h, variant = 0) {
  const t = esc(a.text), s = esc(a.sub);
  const size = Math.min(w / (t.length * 0.62), h * 0.26);
  const shapes = [
    `<circle cx="${w * 0.72}" cy="${h * 0.3}" r="${w * 0.36}" fill="${a.accent}"/><circle cx="${w * 0.72}" cy="${h * 0.3}" r="${w * 0.2}" fill="none" stroke="${a.fg}" stroke-width="${w * 0.012}"/>`,
    `<rect x="${w * 0.1}" y="${h * 0.12}" width="${w * 0.8}" height="${h * 0.42}" rx="${w * 0.4}" fill="${a.accent}"/><path d="M${w * 0.1} ${h * 0.33}h${w * 0.8}" stroke="${a.bg}" stroke-width="${w * 0.02}"/>`,
    `<path d="M0 ${h * 0.55} L${w} ${h * 0.12} L${w} ${h * 0.4} L0 ${h * 0.83}Z" fill="${a.accent}"/>`
  ][variant % 3];
  return `<rect width="${w}" height="${h}" fill="${a.bg}"/>${shapes}
  <text x="${w * 0.07}" y="${h * 0.74}" ${FONT} font-size="${size}" fill="${a.fg}" letter-spacing="-2">${t}</text>
  <text x="${w * 0.075}" y="${h * 0.82}" ${SANS} font-weight="700" font-size="${w * 0.045}" fill="${a.fg}" letter-spacing="4">${s}</text>
  <path d="M${w * 0.075} ${h * 0.88}h${w * 0.85}" stroke="${a.fg}" stroke-opacity=".35" stroke-width="2"/>
  <text x="${w * 0.075}" y="${h * 0.93}" ${SANS} font-size="${w * 0.026}" fill="${a.fg}" fill-opacity=".8">SAT 14 NOV · 6PM · CAPE COAST</text>
  <text x="${w * 0.925}" y="${h * 0.93}" text-anchor="end" ${SANS} font-weight="700" font-size="${w * 0.026}" fill="${a.fg}">FREE ENTRY</text>`;
}

function logoMark(a, cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${a.accent}"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="none" stroke="${a.bg}" stroke-width="${r * 0.16}"/>
  <circle cx="${cx + r * 0.62}" cy="${cy - r * 0.62}" r="${r * 0.2}" fill="${a.fg}"/>`;
}

function social(a, x, y, s, i) {
  const fills = [a.bg, a.accent, a.alt || a.fg, a.fg];
  const bg = fills[i % 4];
  const fg = bg === a.fg ? a.bg : bg === a.accent ? a.bg : a.fg;
  const deco = [
    `<circle cx="${x + s * 0.7}" cy="${y + s * 0.32}" r="${s * 0.22}" fill="${a.accent === bg ? a.fg : a.accent}"/>`,
    `<rect x="${x + s * 0.12}" y="${y + s * 0.12}" width="${s * 0.5}" height="${s * 0.08}" rx="${s * 0.04}" fill="${fg}" opacity=".6"/>`,
    `<path d="M${x} ${y + s * 0.6}L${x + s} ${y + s * 0.25}V${y + s * 0.45}L${x} ${y + s * 0.8}Z" fill="${a.accent === bg ? a.fg : a.accent}"/>`
  ][i % 3];
  return `<g><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.06}" fill="${bg}" stroke="${a.fg}" stroke-opacity=".08"/>${deco}
  <text x="${x + s * 0.1}" y="${y + s * 0.82}" ${FONT} font-size="${s * 0.17}" fill="${fg}">${esc(i % 2 ? a.sub.split(' ')[0] : a.text)}</text>
  <rect x="${x + s * 0.1}" y="${y + s * 0.88}" width="${s * 0.3}" height="${s * 0.03}" fill="${fg}" opacity=".5"/></g>`;
}

const art = {
  // Poster on a tinted wall
  poster(a, w, h, v = 0) {
    const pw = h * 0.62, ph = h * 0.8;
    return `<rect width="${w}" height="${h}" fill="${a.bg}" opacity=".18"/><rect width="${w}" height="${h}" fill="#f2f0ec" opacity=".7"/>
    <g transform="translate(${(w - pw) / 2} ${h * 0.1})" filter="url(#sh)">${poster(a, pw, ph, v)}</g>`;
  },
  flyers(a, w, h, v = 0) {
    const pw = h * 0.55, ph = h * 0.7;
    const b = { ...a, bg: a.fg === '#FFFFFF' ? '#0B0B0C' : a.accent, accent: a.bg };
    return `<rect width="${w}" height="${h}" fill="#ECEAE5"/>
    <g transform="translate(${w * 0.5 - pw * 0.95} ${h * 0.17}) rotate(-7)" filter="url(#sh)">${poster(b, pw, ph, v + 1)}</g>
    <g transform="translate(${w * 0.5 - pw * 0.15} ${h * 0.12}) rotate(5)" filter="url(#sh)">${poster(a, pw, ph, v)}</g>`;
  },
  grid(a, w, h) {
    const s = h * 0.27, gap = s * 0.08, gw = s * 3 + gap * 2;
    let cells = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells += social(a, (w - gw) / 2 + c * (s + gap), (h - gw) / 2 + r * (s + gap), s, r * 3 + c);
    return `<rect width="${w}" height="${h}" fill="${a.bg === '#FFFFFF' || a.bg === '#F4F4F6' ? '#E9E7E2' : a.bg}"/>${cells}`;
  },
  brand(a, w, h) {
    const sw = [a.bg, a.accent, a.fg, '#0B0B0C'];
    return `<rect width="${w}" height="${h}" fill="${a.bg}"/>
    ${logoMark(a, w * 0.24, h * 0.42, h * 0.17)}
    <text x="${w * 0.4}" y="${h * 0.44}" ${FONT} font-size="${h * 0.14}" fill="${a.fg}" letter-spacing="-2">${esc(a.text)}</text>
    <text x="${w * 0.405}" y="${h * 0.53}" ${SANS} font-weight="700" font-size="${h * 0.045}" fill="${a.fg}" letter-spacing="8">${esc(a.sub)}</text>
    ${sw.map((c, i) => `<rect x="${w * 0.1 + i * w * 0.205}" y="${h * 0.72}" width="${w * 0.185}" height="${h * 0.16}" rx="10" fill="${c}" stroke="${a.fg}" stroke-opacity=".25"/><text x="${w * 0.115 + i * w * 0.205}" y="${h * 0.915}" ${SANS} font-size="${h * 0.026}" fill="${a.fg}" fill-opacity=".8">${c}</text>`).join('')}`;
  },
  logo(a, w, h) {
    return `<rect width="${w}" height="${h}" fill="${a.bg}"/>
    <circle cx="${w / 2}" cy="${h * 0.4}" r="${h * 0.2}" fill="none" stroke="${a.fg}" stroke-width="${h * 0.012}"/>
    <path d="M${w / 2 - h * 0.11} ${h * 0.46} q${h * 0.11} ${-h * 0.24} ${h * 0.22} 0" fill="none" stroke="${a.accent}" stroke-width="${h * 0.03}" stroke-linecap="round"/>
    <circle cx="${w / 2}" cy="${h * 0.33}" r="${h * 0.035}" fill="${a.accent}"/>
    <text x="${w / 2}" y="${h * 0.76}" text-anchor="middle" ${FONT} font-size="${h * 0.1}" fill="${a.fg}" letter-spacing="2">${esc(a.text)}</text>
    <text x="${w / 2}" y="${h * 0.84}" text-anchor="middle" ${SANS} font-weight="700" font-size="${h * 0.035}" fill="${a.accent}" letter-spacing="10">${esc(a.sub)}</text>`;
  },
  tee(a, w, h) {
    const cx = w / 2, s = h / 900;
    const tee = (fill, dx) => `<g transform="translate(${cx + dx} ${h * 0.12}) scale(${s})" filter="url(#sh)">
      <path d="M-120 0 C-90 40 90 40 120 0 L300 80 L250 230 L190 205 L190 650 L-190 650 L-190 205 L-250 230 L-300 80 Z" fill="${fill}"/>
      <path d="M-120 0 C-90 40 90 40 120 0" fill="none" stroke="#000" stroke-opacity=".15" stroke-width="10"/></g>`;
    return `<rect width="${w}" height="${h}" fill="${a.bg}"/>${tee('#1A1A1C', -w * 0.18)}${tee('#FFFFFF', w * 0.18)}
    <g transform="translate(${cx + w * 0.18} ${h * 0.42})">${logoMark({ ...a, bg: '#FFFFFF', fg: '#0B0B0C' }, 0, -h * 0.03, h * 0.07)}
    <text y="${h * 0.12}" text-anchor="middle" ${FONT} font-size="${h * 0.05}" fill="#0B0B0C">${esc(a.text)}</text></g>
    <g transform="translate(${cx - w * 0.18} ${h * 0.42})">${logoMark({ ...a, bg: '#1A1A1C', fg: '#FFFFFF' }, 0, -h * 0.03, h * 0.07)}
    <text y="${h * 0.12}" text-anchor="middle" ${FONT} font-size="${h * 0.05}" fill="#FFFFFF">${esc(a.text)}</text></g>`;
  },
  stationery(a, w, h) {
    return `<rect width="${w}" height="${h}" fill="${a.bg}"/>
    <g transform="translate(${w * 0.12} ${h * 0.1}) rotate(-4)" filter="url(#sh)"><rect width="${h * 0.56}" height="${h * 0.78}" fill="#FFFFFF"/>
      ${logoMark({ ...a, bg: '#FFFFFF' }, h * 0.08, h * 0.08, h * 0.035)}
      ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<rect x="${h * 0.05}" y="${h * (0.22 + i * 0.05)}" width="${h * (i % 3 ? 0.42 : 0.3)}" height="${h * 0.012}" fill="#D0CEC9"/>`).join('')}</g>
    <g transform="translate(${w * 0.55} ${h * 0.18}) rotate(6)" filter="url(#sh)"><rect width="${h * 0.5}" height="${h * 0.29}" rx="6" fill="${a.fg}"/>
      ${logoMark({ ...a, bg: a.fg, fg: '#FFFFFF' }, h * 0.1, h * 0.145, h * 0.05)}
      <text x="${h * 0.19}" y="${h * 0.16}" ${FONT} font-size="${h * 0.04}" fill="#FFFFFF">${esc(a.text)}</text></g>
    <g transform="translate(${w * 0.5} ${h * 0.56}) rotate(-3)" filter="url(#sh)"><rect width="${h * 0.5}" height="${h * 0.29}" rx="6" fill="#FFFFFF"/>
      <text x="${h * 0.04}" y="${h * 0.12}" ${FONT} font-size="${h * 0.032}" fill="#0B0B0C">Your Name</text>
      <text x="${h * 0.04}" y="${h * 0.17}" ${SANS} font-size="${h * 0.02}" fill="#555">Creative Director</text>
      <rect x="${h * 0.04}" y="${h * 0.22}" width="${h * 0.08}" height="${h * 0.012}" fill="${a.accent}"/></g>`;
  },
  bundle(a, w, h) {
    const pw = h * 0.46, ph = h * 0.6;
    const cards = [
      { ...a, bg: a.accent, fg: a.fg === a.accent ? '#FFFFFF' : a.fg, accent: a.bg },
      { ...a, bg: '#FFFFFF', fg: '#0B0B0C', accent: a.bg },
      a
    ];
    return `<rect width="${w}" height="${h}" fill="#ECEAE5"/>
    ${cards.map((c, i) => `<g transform="translate(${w / 2 - pw / 2 + (i - 1) * pw * 0.55} ${h * 0.18 + Math.abs(i - 1) * h * 0.04}) rotate(${(i - 1) * 8})" filter="url(#sh)">${poster(c, pw, ph, i)}</g>`).join('')}
    <g transform="translate(${w * 0.82} ${h * 0.16})"><circle r="${h * 0.09}" fill="${a.accent === '#0B0B0C' ? '#FFD400' : a.accent}"/><text y="${h * 0.015}" text-anchor="middle" ${FONT} font-size="${h * 0.04}" fill="#0B0B0C">SAVE</text></g>`;
  },
  // Photoshop layers-panel close-up, used as a product detail shot
  layers(a, w, h, title) {
    const rows = ['Headline', 'Sub headline', 'Date & venue', 'Photo (smart object)', 'Shape accent', 'Colour overlay', 'Background'];
    return `<rect width="${w}" height="${h}" fill="#2B2B2E"/>
    <rect x="${w * 0.08}" y="${h * 0.1}" width="${w * 0.4}" height="${h * 0.8}" rx="8" fill="#1F1F22" stroke="#3a3a3e"/>
    <text x="${w * 0.1}" y="${h * 0.16}" ${SANS} font-size="${h * 0.028}" font-weight="700" fill="#E6E6E6">Layers</text>
    ${rows.map((r, i) => `<g transform="translate(${w * 0.08} ${h * (0.2 + i * 0.095)})"><rect width="${w * 0.4}" height="${h * 0.085}" fill="${i === 0 ? '#3A5BD9' : 'transparent'}" opacity=".7"/>
      <rect x="${w * 0.02}" y="${h * 0.015}" width="${h * 0.055}" height="${h * 0.055}" fill="${[a.fg, a.fg, a.fg, '#888', a.accent, a.accent, a.bg][i]}" stroke="#555"/>
      <text x="${w * 0.02 + h * 0.08}" y="${h * 0.052}" ${SANS} font-size="${h * 0.026}" fill="#E6E6E6">${esc(r)}</text></g>`).join('')}
    <g transform="translate(${w * 0.56} ${h * 0.1})">${poster(a, h * 0.62, h * 0.8)}</g>
    <text x="${w * 0.56}" y="${h * 0.96}" ${SANS} font-size="${h * 0.024}" fill="#999">${esc(title)}.psd · fully layered</text>`;
  },
  // Rough pencil-style exploration, for case-study process sections
  sketch(a, w, h) {
    let g = '';
    for (let i = 0; i < 6; i++) {
      const x = w * (0.12 + (i % 3) * 0.3), y = h * (0.28 + Math.floor(i / 3) * 0.42), r = h * 0.12;
      g += `<g stroke="#2a2a2a" fill="none" stroke-width="2.2" stroke-linecap="round" opacity=".85">
        <circle cx="${x + 4}" cy="${y}" r="${r}"/><circle cx="${x}" cy="${y + 3}" r="${r * (0.5 + (i % 3) * 0.12)}"/>
        <path d="M${x - r * 0.7} ${y + r * 0.2} q${r * 0.7} ${-r * (0.6 + i * 0.1)} ${r * 1.4} 0"/></g>
        <text x="${x - r}" y="${y + r * 1.55}" ${SANS} font-size="${h * 0.03}" fill="#555" font-style="italic">option ${i + 1}${i === 4 ? ' ✓' : ''}</text>`;
    }
    return `<rect width="${w}" height="${h}" fill="#FAF8F3"/>${g}<circle cx="${w * 0.42}" cy="${h * 0.7}" r="${h * 0.17}" fill="none" stroke="${a.accent}" stroke-width="4"/>`;
  }
};

const write = (path, content) => writeFileSync(new URL(path, OUT), content);
const W = 1200, H = 900;

for (const p of projects) {
  const a = p.art;
  write(`work/${p.slug}-cover.svg`, svg(W, H, art[a.style](a, W, H, 0)));
  write(`work/${p.slug}-1.svg`, svg(1600, 1000, art[a.style](a, 1600, 1000, 1)));
  write(`work/${p.slug}-2.svg`, svg(1600, 1000, a.style === 'brand' ? art.stationery({ ...a, bg: '#D9D4CA', fg: a.bg }, 1600, 1000) : art.flyers(a, 1600, 1000, 2)));
  write(`work/${p.slug}-sketch.svg`, svg(1600, 1000, art.sketch(a, 1600, 1000)));
}

for (const p of products) {
  const a = p.art;
  write(`products/${p.slug}-1.svg`, svg(W, H, art[a.style](a, W, H, 0)));
  write(`products/${p.slug}-2.svg`, svg(W, H, a.style === 'tee' || a.style === 'stationery' ? art.brand(a, W, H) : art.poster(a, W, H, 1)));
  write(`products/${p.slug}-3.svg`, svg(W, H, art.layers(a, W, H, p.title)));
}

console.log(`Generated art for ${projects.length} projects and ${products.length} products.`);
