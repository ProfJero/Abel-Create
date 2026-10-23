// Small UI kit for the dashboard: toasts, modals, confirm, and a
// schema-driven form builder with image and gallery uploads.
import { uploadImage } from './data.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s = '') =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
export const slugify = (s) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
export const money = (n) => `GH₵${Number(n || 0).toLocaleString('en-GH', { maximumFractionDigits: 2 })}`;
export const fmtDate = (d, withTime = false) =>
  d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '—';

export function toast(message, tone = 'dark') {
  const box = $('[data-toasts]');
  const el = h(`<div class="pointer-events-auto flex max-w-sm items-center gap-3 rounded-full px-5 py-3 text-sm font-medium text-white shadow-xl transition duration-300 translate-y-3 opacity-0 ${tone === 'error' ? 'bg-accent' : tone === 'ok' ? 'bg-emerald-600' : 'bg-ink'}">${esc(message)}</div>`);
  box.append(el);
  requestAnimationFrame(() => el.classList.remove('translate-y-3', 'opacity-0'));
  setTimeout(() => { el.classList.add('opacity-0'); setTimeout(() => el.remove(), 300); }, tone === 'error' ? 5000 : 2800);
}

export async function copy(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(label, 'ok'); } catch { prompt('Copy this:', text); }
}

// Modal dialog. Returns { el, close }. `body` can be a string or element.
export function modal({ title, body, actions = '', wide = false, onClose }) {
  const root = h(`<div class="fixed inset-0 z-[80] grid items-end sm:place-items-center sm:p-4">
    <div data-x class="absolute inset-0 bg-ink/40 opacity-0 backdrop-blur-sm transition-opacity duration-200"></div>
    <div role="dialog" aria-modal="true" aria-label="${esc(title)}" class="relative flex max-h-[92dvh] w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} translate-y-6 flex-col rounded-t-[1.5rem] bg-white opacity-0 shadow-2xl transition duration-300 ease-out-expo sm:rounded-[1.5rem]">
      <div class="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6"><h2 class="font-display text-xl font-bold">${esc(title)}</h2>
        <button type="button" data-x class="grid size-10 place-items-center rounded-full hover:bg-paper" aria-label="Close">✕</button></div>
      <div data-body class="overflow-y-auto px-5 py-5 sm:px-6"></div>
      ${actions ? `<div class="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">${actions}</div>` : ''}
    </div></div>`);
  const body$ = $('[data-body]', root);
  typeof body === 'string' ? (body$.innerHTML = body) : body$.append(body);
  $('[data-modal-root]').append(root);
  document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    root.firstElementChild.classList.remove('opacity-0');
    root.lastElementChild.classList.remove('translate-y-6', 'opacity-0');
  });
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  function close() {
    document.removeEventListener('keydown', onKey);
    root.firstElementChild.classList.add('opacity-0');
    root.lastElementChild.classList.add('translate-y-6', 'opacity-0');
    setTimeout(() => { root.remove(); if (!$('[data-modal-root]').children.length) document.documentElement.style.overflow = ''; }, 200);
    onClose?.();
  }
  $$('[data-x]', root).forEach((b) => b.addEventListener('click', close));
  setTimeout(() => root.querySelector('input, textarea, select')?.focus(), 80);
  return { el: root, close };
}

export function confirmDialog(message, { title = 'Are you sure?', confirm = 'Delete', tone = 'danger' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal({
      title,
      body: `<p class="text-ink/75">${esc(message)}</p>`,
      actions: `<button type="button" data-no class="btn-ghost">Cancel</button><button type="button" data-yes class="${tone === 'danger' ? 'btn-primary' : 'btn-dark'}">${esc(confirm)}</button>`,
      onClose: () => !answered && resolve(false)
    });
    $('[data-no]', m.el).onclick = () => m.close();
    $('[data-yes]', m.el).onclick = () => { answered = true; resolve(true); m.close(); };
  });
}

export const badge = (text, tone = 'gray') => {
  const tones = {
    gray: 'bg-paper text-ink/70 ring-line', green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', red: 'bg-accent-50 text-accent-600 ring-accent/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200', blue: 'bg-sky-50 text-sky-700 ring-sky-200', dark: 'bg-ink text-white ring-ink'
  };
  return `<span class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tones[tone]}">${esc(text)}</span>`;
};

export const pageHeader = (title, sub = '', actions = '') => `
  <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div><h1 class="font-display text-3xl font-bold tracking-tight sm:text-4xl">${title}</h1>${sub ? `<p class="mt-1.5 text-mute">${sub}</p>` : ''}</div>
    ${actions ? `<div class="flex flex-wrap gap-2">${actions}</div>` : ''}
  </div>`;

export const empty = (title, body, cta = '') => `
  <div class="grid place-items-center rounded-[1.25rem] border border-dashed border-line bg-white px-6 py-16 text-center">
    <p class="font-display text-xl font-bold">${title}</p><p class="mt-1 max-w-sm text-sm text-mute">${body}</p>${cta}</div>`;

export const spinner = '<div class="grid place-items-center py-24"><div class="size-9 animate-spin rounded-full border-4 border-line border-t-accent"></div></div>';

// ---------- Form builder ----------

const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  target[last] = value;
}

const fieldShell = (f, control) => `
  <div class="field min-w-0 ${f.span === 'full' ? 'sm:col-span-2' : ''}" data-field="${f.key}">
    ${f.type === 'toggle' ? '' : `<label class="label" for="f-${f.key}">${esc(f.label)}${f.required ? ' <span class="text-accent">*</span>' : ''}</label>`}
    ${control}
    ${f.hint ? `<p class="text-xs text-mute">${f.hint}</p>` : ''}
    <p data-err class="hidden text-xs font-medium text-accent"></p>
  </div>`;

const renderers = {
  text: (f) => ({
    html: `<input id="f-${f.key}" class="input" ${f.readonly ? 'readonly' : ''} placeholder="${esc(f.placeholder || '')}" ${f.max ? `maxlength="${f.max}"` : ''}>`,
    get: (el) => $('input', el).value.trim(),
    set: (el, v) => ($('input', el).value = v ?? '')
  }),
  textarea: (f) => ({
    html: `<textarea id="f-${f.key}" rows="${f.rows || 4}" class="input resize-y" placeholder="${esc(f.placeholder || '')}"></textarea>`,
    get: (el) => $('textarea', el).value.trim(),
    set: (el, v) => ($('textarea', el).value = v ?? '')
  }),
  number: (f) => ({
    html: `<div class="relative">${f.prefix ? `<span class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-mute">${f.prefix}</span>` : ''}
      <input id="f-${f.key}" type="number" inputmode="decimal" step="${f.step || 'any'}" min="${f.min ?? ''}" class="input ${f.prefix ? 'pl-14' : ''}" placeholder="${esc(f.placeholder || '')}"></div>`,
    get: (el) => { const v = $('input', el).value; return v === '' ? null : Number(v); },
    set: (el, v) => ($('input', el).value = v ?? '')
  }),
  select: (f) => ({
    html: `<select id="f-${f.key}" class="input">${f.placeholder ? `<option value="">${esc(f.placeholder)}</option>` : ''}${(f.options || []).map((o) => {
      const [value, label] = typeof o === 'object' ? [o.value, o.label] : [o, o];
      return `<option value="${esc(value)}">${esc(label)}</option>`;
    }).join('')}</select>`,
    get: (el) => { const v = $('select', el).value; return f.numeric ? Number(v) : v; },
    set: (el, v) => ($('select', el).value = v ?? '')
  }),
  toggle: (f) => ({
    html: `<label class="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3">
      <span><span class="block text-sm font-semibold">${esc(f.label)}</span>${f.desc ? `<span class="block text-xs text-mute">${f.desc}</span>` : ''}</span>
      <input id="f-${f.key}" type="checkbox" class="peer sr-only">
      <span class="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-line transition peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-ink after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"></span></label>`,
    get: (el) => $('input', el).checked,
    set: (el, v) => ($('input', el).checked = Boolean(v))
  }),
  tags: (f) => ({
    html: `<input id="f-${f.key}" class="input" placeholder="${esc(f.placeholder || 'Separate with commas')}">`,
    get: (el) => $('input', el).value.split(',').map((s) => s.trim()).filter(Boolean),
    set: (el, v) => ($('input', el).value = (v || []).join(', '))
  }),
  lines: (f) => ({
    html: `<textarea id="f-${f.key}" rows="${f.rows || 4}" class="input resize-y" placeholder="${esc(f.placeholder || 'One per line')}"></textarea>`,
    get: (el) => $('textarea', el).value.split('\n').map((s) => s.trim()).filter(Boolean),
    set: (el, v) => ($('textarea', el).value = Array.isArray(v) ? v.join('\n') : v || '')
  }),
  slug: (f) => ({
    html: `<div class="flex items-center rounded-xl border border-line bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/5">
      <span class="shrink-0 pl-4 text-sm whitespace-nowrap text-mute">${esc(f.prefix || '')}</span>
      <input id="f-${f.key}" class="w-full min-w-0 bg-transparent py-3 pr-4 text-[15px] outline-none read-only:text-mute" spellcheck="false"></div>`,
    get: (el) => slugify($('input', el).value),
    set: (el, v) => ($('input', el).value = v ?? '')
  }),
  colors: (f) => ({
    html: `<div data-colors class="flex flex-wrap items-center gap-2"></div>`,
    get: (el) => $$('[data-color] input[type=text]', el).map((i) => i.value.trim()).filter((v) => /^#[0-9a-f]{3,8}$/i.test(v)),
    set: (el, v) => {
      const box = $('[data-colors]', el);
      const add = (c = '#000000') => {
        const chip = h(`<div data-color class="flex items-center gap-1.5 rounded-xl border border-line bg-white p-1.5 pr-2">
          <input type="color" value="${esc(c.length === 7 ? c : '#000000')}" class="size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0">
          <input type="text" value="${esc(c)}" class="w-20 bg-transparent font-mono text-xs outline-none" aria-label="Hex colour">
          <button type="button" class="text-mute hover:text-accent" aria-label="Remove colour">✕</button></div>`);
        const [picker, text, del] = chip.querySelectorAll('input, input, button');
        picker.oninput = () => { text.value = picker.value; el.dispatchEvent(new Event('input', { bubbles: true })); };
        text.oninput = () => /^#[0-9a-f]{6}$/i.test(text.value) && (picker.value = text.value);
        del.onclick = () => { chip.remove(); el.dispatchEvent(new Event('input', { bubbles: true })); };
        box.insertBefore(chip, $('[data-add-color]', box));
      };
      box.innerHTML = '<button type="button" data-add-color class="rounded-xl border border-dashed border-line px-3 py-3 text-xs font-semibold text-mute hover:border-ink hover:text-ink">+ Add colour</button>';
      $('[data-add-color]', box).onclick = () => add();
      (v || []).forEach(add);
    }
  }),
  checklist: (f) => ({
    html: `<div class="rounded-xl border border-line bg-white"><input type="search" placeholder="Search" class="w-full border-b border-line bg-transparent px-4 py-2.5 text-sm outline-none">
      <div data-list class="max-h-56 overflow-y-auto p-2"></div></div>`,
    get: (el) => $$('input[type=checkbox]:checked', el).map((i) => i.value),
    set: (el, v) => {
      const chosen = new Set(v || []);
      $('[data-list]', el).innerHTML = (f.options || []).map((o) => `<label class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-paper" data-label="${esc(o.label.toLowerCase())}">
        <input type="checkbox" value="${esc(o.value)}" ${chosen.has(o.value) ? 'checked' : ''} class="size-4 shrink-0 accent-ink"><span class="min-w-0 truncate">${esc(o.label)}</span></label>`).join('') || '<p class="p-2 text-sm text-mute">Nothing to choose yet.</p>';
      $('input[type=search]', el).oninput = (e) => $$('[data-label]', el).forEach((l) => (l.hidden = !l.dataset.label.includes(e.target.value.toLowerCase())));
    }
  }),
  image: (f) => imageField(f, false),
  gallery: (f) => imageField(f, true)
};

// Single image or ordered gallery, uploaded to the Worker's media bucket.
function imageField(f, multi) {
  let urls = [];
  let el;
  const changed = () => el.dispatchEvent(new Event('input', { bubbles: true }));
  const draw = () => {
    const grid = $('[data-images]', el);
    grid.innerHTML = urls.map((u, i) => `
      <figure draggable="${multi}" data-i="${i}" class="group relative overflow-hidden rounded-xl border border-line bg-paper ${multi ? 'cursor-grab active:cursor-grabbing' : ''}">
        <img src="${esc(u)}" alt="" class="${f.aspect || 'aspect-[4/3]'} w-full object-cover">
        ${multi && i === 0 ? '<span class="absolute top-2 left-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-white">COVER</span>' : ''}
        <div class="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-ink/60 to-transparent p-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          ${multi ? `<button type="button" data-move="-1" class="grid size-8 place-items-center rounded-full bg-white text-xs" aria-label="Move left">←</button><button type="button" data-move="1" class="grid size-8 place-items-center rounded-full bg-white text-xs" aria-label="Move right">→</button>` : ''}
          <button type="button" data-del class="grid size-8 place-items-center rounded-full bg-white text-xs text-accent" aria-label="Remove image">✕</button>
        </div>
      </figure>`).join('');
    $('[data-drop]', el).hidden = !multi && urls.length > 0;
    $$('figure', grid).forEach((fig) => {
      const i = +fig.dataset.i;
      $('[data-del]', fig).onclick = () => { urls.splice(i, 1); draw(); changed(); };
      $$('[data-move]', fig).forEach((b) => (b.onclick = () => {
        const j = i + +b.dataset.move;
        if (j < 0 || j >= urls.length) return;
        [urls[i], urls[j]] = [urls[j], urls[i]];
        draw(); changed();
      }));
      if (multi) {
        fig.ondragstart = (e) => e.dataTransfer.setData('text/plain', String(i));
        fig.ondragover = (e) => e.preventDefault();
        fig.ondrop = (e) => {
          e.preventDefault();
          const from = +e.dataTransfer.getData('text/plain');
          if (Number.isNaN(from) || from === i) return;
          urls.splice(i, 0, urls.splice(from, 1)[0]);
          draw(); changed();
        };
      }
    });
  };
  async function addFiles(files) {
    const list = [...files].filter((x) => x.type.startsWith('image/'));
    if (!list.length) return;
    const bar = $('[data-progress]', el);
    for (const [n, file] of (multi ? list : list.slice(0, 1)).entries()) {
      bar.hidden = false;
      bar.firstElementChild.style.width = '4%';
      $('[data-progress-label]', el).textContent = `Uploading ${n + 1} of ${multi ? list.length : 1}…`;
      try {
        const { url } = await uploadImage(file, (p) => (bar.firstElementChild.style.width = `${Math.max(4, p * 100)}%`));
        multi ? urls.push(url) : (urls = [url]);
        draw(); changed();
      } catch (err) {
        toast(err.message, 'error');
      }
    }
    bar.hidden = true;
    $('[data-progress-label]', el).textContent = '';
  }
  return {
    html: `<div>
      <div data-images class="grid ${multi ? 'grid-cols-2 sm:grid-cols-3' : 'max-w-xs'} gap-3"></div>
      <div data-drop class="mt-3 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-white px-4 py-6 text-center transition data-[over]:border-ink data-[over]:bg-paper">
        <p class="text-sm"><button type="button" data-pick class="font-semibold text-accent underline-offset-2 hover:underline">Upload ${multi ? 'images' : 'an image'}</button> or drag ${multi ? 'them' : 'it'} here</p>
        <p class="text-xs text-mute">JPG, PNG or WebP. Large photos are resized automatically.</p>
        <button type="button" data-url class="text-xs text-mute underline-offset-2 hover:text-ink hover:underline">or paste an image URL</button>
        <input type="file" accept="image/*" ${multi ? 'multiple' : ''} hidden>
      </div>
      <div data-progress hidden class="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full w-0 rounded-full bg-accent transition-[width]"></div></div>
      <p data-progress-label class="mt-1 text-xs text-mute"></p></div>`,
    mount(node) {
      el = node;
      const input = $('input[type=file]', el);
      const drop = $('[data-drop]', el);
      $('[data-pick]', el).onclick = () => input.click();
      input.onchange = () => { addFiles(input.files); input.value = ''; };
      drop.ondragover = (e) => { e.preventDefault(); drop.dataset.over = ''; };
      drop.ondragleave = () => delete drop.dataset.over;
      drop.ondrop = (e) => { e.preventDefault(); delete drop.dataset.over; addFiles(e.dataTransfer.files); };
      $('[data-url]', el).onclick = () => {
        const u = prompt('Image URL (https://… or /assets/…)');
        if (u?.trim()) { multi ? urls.push(u.trim()) : (urls = [u.trim()]); draw(); changed(); }
      };
    },
    get: () => (multi ? [...urls] : urls[0] || ''),
    set: (_, v) => { urls = multi ? [...(v || [])] : v ? [v] : []; draw(); }
  };
}

// schema: [{ section, hint?, fields: [field…] }]
export function buildForm(schema, values = {}) {
  const fields = [];
  const form = h(`<form class="grid min-w-0 grid-cols-1 gap-6" novalidate></form>`);
  for (const sec of schema) {
    const card = h(`<section class="min-w-0 rounded-[1.25rem] border border-line bg-white p-5 sm:p-6">
      <h2 class="font-display text-lg font-bold">${esc(sec.section)}</h2>${sec.hint ? `<p class="mt-0.5 text-sm text-mute">${sec.hint}</p>` : ''}
      <div class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2"></div></section>`);
    const grid = card.lastElementChild;
    for (const f of sec.fields) {
      const r = renderers[f.type || 'text'](f);
      const node = h(fieldShell(f, r.html));
      grid.append(node);
      r.mount?.(node);
      r.set(node, getPath(values, f.key) ?? f.default);
      fields.push({ f, r, node });
    }
    form.append(card);
  }
  let dirty = false;
  form.addEventListener('input', () => (dirty = true));
  form.addEventListener('change', () => (dirty = true));

  return {
    el: form,
    field: (key) => fields.find((x) => x.f.key === key),
    get dirty() { return dirty; },
    set dirty(v) { dirty = v; },
    values() {
      const out = {};
      for (const { f, r, node } of fields) if (!f.virtual) setPath(out, f.key, r.get(node));
      return out;
    },
    validate() {
      let first = null;
      for (const { f, r, node } of fields) {
        const v = r.get(node);
        const msg = f.required && (v === '' || v == null || (Array.isArray(v) && !v.length)) ? `${f.label} is required.` : f.validate?.(v) || '';
        const err = $('[data-err]', node);
        err.textContent = msg;
        err.classList.toggle('hidden', !msg);
        $('input, textarea, select', node)?.toggleAttribute('aria-invalid', Boolean(msg));
        if (msg && !first) first = node;
      }
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return !first;
    }
  };
}
