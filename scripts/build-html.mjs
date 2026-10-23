// Builds static pages: src/pages/**/*.html are wrapped in src/layout.html
// with the shared header and footer, and written to public/.
//
// Each page starts with a front-matter comment:
//   <!--
//   title: Shop | Abel Create
//   description: PSD templates, mockups and brand kits.
//   nav: shop            (highlights the menu item)
//   script: shop         (loads /assets/js/pages/shop.js)
//   -->
//
//   node scripts/build-html.mjs [--watch]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, watch } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const out = join(root, 'public');

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : [];
  });

function parse(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^<!--([\s\S]*?)-->\s*/);
  const meta = {};
  if (m) for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m ? raw.slice(m[0].length) : raw };
}

async function build() {
  // Re-import config on each build so edits show up in watch mode
  const { SITE } = await import(pathToFileURL(join(out, 'assets/js/config.js')).href + '?t=' + Date.now());
  const flat = { ...SITE, ...Object.fromEntries(Object.entries(SITE.socials).map(([k, v]) => ['social_' + k, v])), year: new Date().getFullYear() };
  const layout = readFileSync(join(src, 'layout.html'), 'utf8');
  const partials = Object.fromEntries(
    readdirSync(join(src, 'partials')).map((f) => [f.replace('.html', ''), readFileSync(join(src, 'partials', f), 'utf8')])
  );
  const pages = walk(join(src, 'pages'));
  for (const file of pages) {
    const rel = relative(join(src, 'pages'), file).replace(/\\/g, '/');
    const { meta, body } = parse(file);
    const path = '/' + rel.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');
    const header = partials.header.replace(`data-nav="${meta.nav}"`, `data-nav="${meta.nav}" aria-current="page"`);
    const vars = {
      title: meta.title || 'Abel Create | Graphic Designer in Ghana',
      description: meta.description || '',
      canonical: SITE.url + path,
      image: SITE.url + (meta.image || '/assets/img/og-image.jpg'),
      robots: meta.noindex ? 'noindex' : 'index, follow',
      header,
      footer: partials.footer,
      overlays: partials.overlays,
      content: body,
      schema: meta.schema === 'person' ? partials['schema-person'] : '',
      script: meta.script ? `<script type="module" src="/assets/js/pages/${meta.script}.js"></script>` : ''
    };
    // `layout: none` pages (the admin dashboard) are complete documents
    const html = (meta.layout === 'none' ? body : layout)
      .replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? '')
      .replace(/{{\s*site\.(\w+)\s*}}/g, (_, k) => flat[k] ?? '');
    const dest = join(out, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, html);
  }
  console.log(`[html] built ${pages.length} pages`);
}

await build();
if (process.argv.includes('--watch')) {
  let t;
  watch(src, { recursive: true }, (_, f) => {
    if (!f?.endsWith('.html')) return;
    clearTimeout(t);
    t = setTimeout(() => { build().catch((e) => console.error(e.message)); }, 80);
  });
}
