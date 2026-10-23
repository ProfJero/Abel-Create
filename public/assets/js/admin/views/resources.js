// List + editor for the catalogue collections (projects, products,
// testimonials, reviews). Each resource below describes its form and list row.
import { list, get, save, patch, remove, exists, toDate } from '../data.js';
import { $, $$, esc, h, slugify, money, fmtDate, toast, confirmDialog, badge, pageHeader, empty, buildForm } from '../kit.js';
import { state } from '../state.js';
import { mountProductFile } from './product-file.js';

const PROJECT_CATEGORIES = ['Branding', 'Logos', 'Flyers', 'Social Media', 'Posters'];
const PRODUCT_CATEGORIES = ['Flyers', 'Social Media', 'Mockups', 'Brand Kits', 'Bundles', 'Free'];
const fallbackImage = {
  projects: (p) => p.cover || `/assets/img/work/${p.id}-cover.svg`,
  products: (p) => p.images?.[0] || `/assets/img/products/${p.id}-1.svg`
};

const RESOURCES = {
  projects: {
    title: 'Projects', singular: 'project', idField: 'slug',
    intro: 'Portfolio pieces shown on Home and Work. Each one has its own case-study page.',
    sortList: (a, b) => (a.order ?? 99) - (b.order ?? 99),
    publicUrl: (id) => `/case-study?p=${encodeURIComponent(id)}`,
    defaults: () => ({ published: false, featured: false, order: 50, year: new Date().getFullYear(), category: 'Branding' }),
    row: (p) => ({
      image: fallbackImage.projects(p),
      title: p.title,
      sub: [p.category, p.client, p.year].filter(Boolean).join(' · '),
      tags: [p.featured ? badge('Featured', 'blue') : '', `<span class="text-xs text-mute">#${p.order ?? '–'}</span>`]
    }),
    schema: (isNew) => [
      { section: 'Basics', fields: [
        { key: 'title', label: 'Project title', required: true, max: 80 },
        { key: 'slug', label: 'Page address', type: 'slug', prefix: '/case-study?p=', required: true, readonly: !isNew, hint: isNew ? 'Created from the title. Can’t be changed later.' : 'The address can’t be changed after creation.' },
        { key: 'subtitle', label: 'One-line summary', span: 'full', placeholder: 'Brand identity for a cold-pressed juice startup' },
        { key: 'category', label: 'Category', type: 'select', options: PROJECT_CATEGORIES, required: true },
        { key: 'client', label: 'Client' },
        { key: 'year', label: 'Year', type: 'number', step: 1 },
        { key: 'role', label: 'Your role', placeholder: 'Logo, packaging, social launch' }
      ] },
      { section: 'Visibility', fields: [
        { key: 'published', label: 'Published', type: 'toggle', desc: 'Show this project on the website.' },
        { key: 'featured', label: 'Featured', type: 'toggle', desc: 'Show it in “Selected work” on the home page (up to 6).' },
        { key: 'order', label: 'Sort order', type: 'number', step: 1, hint: 'Lower numbers come first.' }
      ] },
      { section: 'Images', hint: 'Use landscape images (4:3 works best). Name your files with your name and the project for Google.', fields: [
        { key: 'cover', label: 'Cover image', type: 'image', required: true, span: 'full' },
        { key: 'images', label: 'Final designs', type: 'gallery', span: 'full', hint: 'Shown large on the case-study page. Drag to reorder.' },
        { key: 'sketch', label: 'Process image (sketches, drafts)', type: 'image', span: 'full' }
      ] },
      { section: 'Case study', fields: [
        { key: 'brief', label: 'The brief', type: 'textarea', span: 'full', placeholder: 'What did the client need?' },
        { key: 'process', label: 'Process steps', type: 'lines', span: 'full', rows: 5, hint: 'One step per line.' },
        { key: 'palette', label: 'Colour palette', type: 'colors', span: 'full' },
        { key: 'fonts', label: 'Fonts used', type: 'tags', span: 'full', placeholder: 'Bricolage Grotesque, Inter' },
        { key: 'result', label: 'The result', type: 'textarea', span: 'full', rows: 3 }
      ] },
      { section: 'Client feedback', fields: [
        { key: 'testimonial.quote', label: 'Quote', type: 'textarea', rows: 3, span: 'full' },
        { key: 'testimonial.name', label: 'Name and role', placeholder: 'Founder, Volta Fresh' }
      ] }
    ],
    beforeSave: (v) => ({ ...v, testimonial: v.testimonial?.quote ? v.testimonial : null })
  },

  products: {
    title: 'Products', singular: 'product', idField: 'slug',
    intro: 'Templates, mockups and kits sold in the shop. Upload the download file on each product.',
    sortList: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    publicUrl: (id) => `/product?p=${encodeURIComponent(id)}`,
    defaults: () => ({ published: false, category: 'Flyers', fileTypes: ['PSD'], popularity: 50, createdAt: new Date().toISOString().slice(0, 10) }),
    row: (p) => ({
      image: fallbackImage.products(p),
      title: p.title,
      sub: [p.category, (p.fileTypes || []).join(', ')].filter(Boolean).join(' · '),
      tags: [p.price ? `<span class="text-sm font-semibold">${money(p.price)}</span>` : badge('Free', 'dark'), p.badge && p.badge.toLowerCase() !== 'free' ? badge(p.badge, 'red') : '']
    }),
    schema: (isNew, ctx) => [
      { section: 'Basics', fields: [
        { key: 'title', label: 'Product name', required: true, max: 90 },
        { key: 'slug', label: 'Page address', type: 'slug', prefix: '/product?p=', required: true, readonly: !isNew, hint: isNew ? 'Created from the name. Can’t be changed later.' : 'The address can’t be changed after creation.' },
        { key: 'category', label: 'Category', type: 'select', options: PRODUCT_CATEGORIES, required: true },
        { key: 'badge', label: 'Badge (optional)', placeholder: 'New, Bestseller, Save 30%' },
        { key: 'summary', label: 'Short summary', type: 'textarea', rows: 2, span: 'full', required: true, hint: 'One sentence shown under the title.' },
        { key: 'description', label: 'Full description', type: 'textarea', rows: 5, span: 'full' }
      ] },
      { section: 'Pricing', hint: 'Prices are in Ghana cedis. Set the price to 0 to make the file free (customers get it for their email).', fields: [
        { key: 'price', label: 'Personal licence price', type: 'number', prefix: 'GH₵', min: 0, required: true },
        { key: 'commercialPrice', label: 'Commercial licence price', type: 'number', prefix: 'GH₵', min: 0, hint: 'Leave empty for 2× the personal price.' },
        { key: 'compareAt', label: 'Was price (optional)', type: 'number', prefix: 'GH₵', min: 0, hint: 'Shows a crossed-out price, e.g. for bundles.' },
        { key: 'priceUSD', label: 'Guide price in USD', type: 'number', prefix: 'US$', min: 0, hint: 'Shown as “≈ $5” for international buyers.' }
      ] },
      { section: 'Visibility', fields: [
        { key: 'published', label: 'Published', type: 'toggle', desc: 'Show it in the shop. Upload the download file first.' },
        { key: 'popularity', label: 'Popularity score', type: 'number', step: 1, hint: '0–100. Used by the “Popular” sort and the home page.' },
        { key: 'createdAt', label: 'Release date', placeholder: 'YYYY-MM-DD', hint: 'Used by the “Newest” sort.', validate: (v) => (v && !/^\d{4}-\d{2}-\d{2}$/.test(v) ? 'Use the format YYYY-MM-DD.' : '') }
      ] },
      { section: 'Images', hint: 'Recommended order: 1. preview, 2. mockup, 3. close-up of the layers.', fields: [
        { key: 'images', label: 'Product images', type: 'gallery', span: 'full', required: true }
      ] },
      { section: 'File details', fields: [
        { key: 'fileTypes', label: 'File types', type: 'tags', placeholder: 'PSD, AI' },
        { key: 'fileSize', label: 'File size', placeholder: '148 MB' },
        { key: 'dimensions', label: 'Dimensions', placeholder: '1080 × 1350 px', span: 'full' },
        { key: 'fonts', label: 'Fonts needed', type: 'tags', span: 'full', placeholder: 'Inter (free), Bricolage Grotesque (free)' },
        { key: 'includes', label: 'What’s included', type: 'lines', span: 'full', hint: 'One item per line.' }
      ] },
      { section: 'Bundle', hint: 'If this is a bundle, tick the products it contains. They’ll show a “Get this in the bundle” offer.', fields: [
        { key: 'bundleOf', label: 'Products in this bundle', type: 'checklist', span: 'full', options: ctx.products.filter((p) => p.id !== ctx.id).map((p) => ({ value: p.id, label: p.title })) }
      ] }
    ],
    beforeSave: (v) => ({ ...v, price: v.price || 0, commercialPrice: v.commercialPrice || null, compareAt: v.compareAt || null, priceUSD: v.priceUSD || 0, bundleOf: v.bundleOf?.length ? v.bundleOf : null })
  },

  testimonials: {
    title: 'Testimonials', singular: 'testimonial', idField: null,
    intro: 'Client quotes shown on the home page (the first three by sort order).',
    sortList: (a, b) => (a.order ?? 99) - (b.order ?? 99),
    defaults: () => ({ published: true, order: 10 }),
    row: (t) => ({ title: `“${t.quote?.slice(0, 90) || ''}${t.quote?.length > 90 ? '…' : ''}”`, sub: [t.name, t.company].filter(Boolean).join(' · '), tags: [`<span class="text-xs text-mute">#${t.order ?? '–'}</span>`] }),
    schema: () => [
      { section: 'Testimonial', fields: [
        { key: 'quote', label: 'Quote', type: 'textarea', rows: 4, span: 'full', required: true },
        { key: 'name', label: 'Name or role', required: true, placeholder: 'Founder' },
        { key: 'company', label: 'Company', placeholder: 'Volta Fresh' },
        { key: 'order', label: 'Sort order', type: 'number', step: 1 },
        { key: 'published', label: 'Published', type: 'toggle', desc: 'Show on the website.' }
      ] }
    ]
  },

  reviews: {
    title: 'Product reviews', singular: 'review', idField: null,
    intro: 'Customer reviews shown on product pages. Add the ones customers send you.',
    sortList: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
    defaults: () => ({ published: true, rating: 5, createdAt: new Date().toISOString().slice(0, 10) }),
    row: (r, ctx) => ({ title: `${'★'.repeat(r.rating || 5)} ${r.name || ''}`, sub: `${ctx.products.find((p) => p.id === r.product)?.title || r.product} · ${r.text?.slice(0, 70) || ''}` }),
    schema: (isNew, ctx) => [
      { section: 'Review', fields: [
        { key: 'product', label: 'Product', type: 'select', required: true, placeholder: 'Choose a product', options: ctx.products.map((p) => ({ value: p.id, label: p.title })) },
        { key: 'rating', label: 'Rating', type: 'select', numeric: true, options: [5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${'★'.repeat(n)} (${n})` })) },
        { key: 'name', label: 'Customer name', required: true },
        { key: 'createdAt', label: 'Date', placeholder: 'YYYY-MM-DD' },
        { key: 'text', label: 'Review', type: 'textarea', rows: 4, span: 'full', required: true },
        { key: 'published', label: 'Published', type: 'toggle', desc: 'Show on the product page.' }
      ] }
    ]
  }
};

export default async function ({ el, section, params }) {
  const res = RESOURCES[section];
  const [id] = params;
  const products = section === 'products' || section === 'reviews' ? await list('products') : [];
  const ctx = { products, id };
  if (id) return editor(el, section, res, id === 'new' ? null : id, ctx);
  return listView(el, section, res, ctx);
}

// ---------- List ----------

async function listView(el, name, res, ctx) {
  const items = (name === 'products' ? ctx.products : await list(name)).sort(res.sortList);
  el.innerHTML = pageHeader(res.title, res.intro, `<a href="#/${name}/new" class="btn-primary">+ New ${res.singular}</a>`);
  if (!items.length) {
    el.insertAdjacentHTML('beforeend', empty(`No ${res.title.toLowerCase()} yet`, `Add your first ${res.singular}${name === 'projects' || name === 'products' ? ', or load the sample content with npm run seed' : ''}.`, `<a href="#/${name}/new" class="btn-dark mt-6">+ New ${res.singular}</a>`));
    return;
  }

  const filters = h(`<div class="mb-4 flex flex-col gap-2 sm:flex-row">
    <input type="search" placeholder="Search ${res.title.toLowerCase()}" class="input sm:max-w-xs">
    <div class="flex gap-2" role="toolbar">
      <button type="button" class="tab" data-f="all" aria-pressed="true">All <span class="text-mute">${items.length}</span></button>
      <button type="button" class="tab" data-f="live" aria-pressed="false">Published</button>
      <button type="button" class="tab" data-f="draft" aria-pressed="false">Hidden</button>
    </div></div>`);
  const box = h(`<div class="overflow-hidden rounded-[1.25rem] border border-line bg-white"></div>`);
  el.append(filters, box);
  let filter = 'all';
  let q = '';

  const draw = () => {
    const shown = items.filter((it) => (filter === 'all' || (filter === 'live') === Boolean(it.published)) && (!q || JSON.stringify(it).toLowerCase().includes(q)));
    box.innerHTML = shown.length ? shown.map((it) => {
      const r = res.row(it, ctx);
      return `<div class="flex items-center gap-3 border-b border-line px-3 py-3 last:border-0 hover:bg-paper/60 sm:gap-4 sm:px-4" data-row="${esc(it.id)}">
        ${r.image ? `<img src="${esc(r.image)}" alt="" loading="lazy" class="aspect-[4/3] w-16 shrink-0 rounded-lg bg-paper object-cover sm:w-20">` : ''}
        <a href="#/${name}/${encodeURIComponent(it.id)}" class="min-w-0 flex-1">
          <p class="truncate font-semibold">${esc(r.title)}</p>
          <p class="truncate text-xs text-mute sm:text-sm">${esc(r.sub || '')}</p>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 sm:hidden">${(r.tags || []).join('')}</div>
        </a>
        <div class="hidden items-center gap-2 sm:flex">${(r.tags || []).join('')}</div>
        <button type="button" data-toggle title="${it.published ? 'Hide from website' : 'Publish'}" class="shrink-0">${it.published ? badge('Live', 'green') : badge('Hidden', 'gray')}</button>
        <details class="relative shrink-0">
          <summary class="grid size-9 cursor-pointer list-none place-items-center rounded-full text-mute hover:bg-white hover:text-ink" aria-label="More actions">⋯</summary>
          <div class="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-white p-1 text-sm shadow-xl">
            <a href="#/${name}/${encodeURIComponent(it.id)}" class="block rounded-lg px-3 py-2 hover:bg-paper">Edit</a>
            ${res.publicUrl ? `<a href="${res.publicUrl(it.id)}" target="_blank" class="block rounded-lg px-3 py-2 hover:bg-paper">View on site ↗</a>` : ''}
            <button type="button" data-delete class="block w-full rounded-lg px-3 py-2 text-left text-accent hover:bg-accent-50">Delete</button>
          </div>
        </details>
      </div>`;
    }).join('') : `<p class="p-8 text-center text-sm text-mute">Nothing matches.</p>`;
  };
  draw();

  $('input', filters).oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  $$('[data-f]', filters).forEach((b) => (b.onclick = () => { filter = b.dataset.f; $$('[data-f]', filters).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); }));
  box.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-row]');
    if (!row) return;
    const item = items.find((x) => x.id === row.dataset.row);
    if (e.target.closest('[data-toggle]')) {
      try {
        await patch(name, item.id, { published: !item.published });
        item.published = !item.published;
        toast(item.published ? 'Published' : 'Hidden from the website', 'ok');
        draw();
      } catch (err) { toast(err.message, 'error'); }
    }
    if (e.target.closest('[data-delete]')) {
      if (!(await confirmDialog(`Delete “${res.row(item, ctx).title}”? This can’t be undone.`))) return;
      try {
        await remove(name, item.id);
        items.splice(items.indexOf(item), 1);
        toast('Deleted', 'ok');
        draw();
      } catch (err) { toast(err.message, 'error'); }
    }
  });
}

// ---------- Editor ----------

async function editor(el, name, res, id, ctx) {
  const isNew = !id;
  const existing = isNew ? null : await get(name, id);
  if (!isNew && !existing) {
    el.innerHTML = empty('Not found', `This ${res.singular} doesn’t exist any more.`, `<a href="#/${name}" class="btn-dark mt-6">Back to ${res.title.toLowerCase()}</a>`);
    return;
  }
  const values = existing ? { ...existing, slug: existing.id } : res.defaults();
  const title = isNew ? `New ${res.singular}` : esc(res.row(existing, ctx).title);

  el.innerHTML = `
    <a href="#/${name}" class="text-sm font-medium text-mute hover:text-ink">← ${res.title}</a>
    <div class="mt-3">${pageHeader(title, isNew ? '' : `Last saved ${fmtDate(toDate(existing.updatedAt), true)}`, res.publicUrl && !isNew ? `<a href="${res.publicUrl(id)}" target="_blank" class="btn-ghost btn-sm">View on site ↗</a>` : '')}</div>`;

  const form = buildForm(res.schema(isNew, ctx), values);
  el.append(form.el);

  // Auto-fill the address from the title on new items until it's edited by hand
  const slugField = form.field('slug');
  const titleField = form.field('title');
  if (isNew && slugField && titleField) {
    const slugInput = $('input', slugField.node);
    let touched = false;
    slugInput.addEventListener('input', () => (touched = true));
    $('input', titleField.node).addEventListener('input', (e) => !touched && (slugInput.value = slugify(e.target.value)));
  }

  if (name === 'products') {
    const panel = h(`<section class="min-w-0 rounded-[1.25rem] border border-line bg-white p-5 sm:p-6"></section>`);
    form.el.insertBefore(panel, form.el.children[3]);
    mountProductFile(panel, isNew ? null : id);
  }

  const bar = h(`<div class="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-line bg-paper/90 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
    <div class="flex items-center justify-between gap-3">
      <p data-status class="hidden text-sm text-mute sm:block">${isNew ? 'Not saved yet' : 'All changes saved'}</p>
      <div class="flex flex-1 justify-end gap-2">
        ${isNew ? '' : '<button type="button" data-delete class="btn-ghost text-accent">Delete</button>'}
        <button type="button" data-save class="btn-dark min-w-32">${isNew ? `Create ${res.singular}` : 'Save changes'}</button>
      </div>
    </div></div>`);
  el.append(bar);
  const status = $('[data-status]', bar);
  form.el.addEventListener('input', () => (status.textContent = 'Unsaved changes'));
  state.leaveGuard = (silent) => !form.dirty || (!silent && confirm('You have unsaved changes. Leave without saving?'));

  async function doSave() {
    if (!form.validate()) return toast('Please fix the highlighted fields', 'error');
    const v = res.beforeSave ? res.beforeSave(form.values()) : form.values();
    const docId = res.idField ? v.slug : id || crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    delete v.slug;
    const btn = $('[data-save]', bar);
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      if (isNew && res.idField && (await exists(name, docId))) {
        throw new Error(`A ${res.singular} with the address “${docId}” already exists. Change the title or address.`);
      }
      await save(name, docId, { ...(existing || {}), ...v });
      form.dirty = false;
      toast(isNew ? `${res.singular[0].toUpperCase() + res.singular.slice(1)} created` : 'Saved', 'ok');
      if (isNew) {
        state.leaveGuard = null;
        location.hash = `#/${name}/${encodeURIComponent(docId)}`;
      } else {
        status.textContent = `Saved at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      }
    } catch (err) {
      toast(err.message.includes('permission') ? 'You don’t have permission to save. Are the Firestore rules deployed?' : err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = isNew ? `Create ${res.singular}` : 'Save changes';
    }
  }

  $('[data-save]', bar).onclick = doSave;
  form.el.addEventListener('submit', (e) => { e.preventDefault(); doSave(); });
  form.el.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(); }
  });
  $('[data-delete]', bar)?.addEventListener('click', async () => {
    if (!(await confirmDialog(`Delete this ${res.singular}? This can’t be undone.`))) return;
    try {
      await remove(name, id);
      state.leaveGuard = null;
      toast('Deleted', 'ok');
      location.hash = `#/${name}`;
    } catch (err) { toast(err.message, 'error'); }
  });
}
