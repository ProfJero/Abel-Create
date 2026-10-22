// Shared UI helpers and card templates.
import { money, usd, priceFor } from './store.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const params = () => new URLSearchParams(location.search);

export function toast(message, { tone = 'dark', action } = {}) {
  const box = $('[data-toasts]');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `pointer-events-auto flex max-w-sm items-center gap-3 rounded-full px-5 py-3 text-sm font-medium shadow-xl transition duration-500 ease-out-expo translate-y-4 opacity-0 ${tone === 'error' ? 'bg-accent text-white' : 'bg-ink text-white'}`;
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<a href="${action.href}" class="font-semibold text-white underline underline-offset-2">${esc(action.label)}</a>` : ''}`;
  box.append(el);
  requestAnimationFrame(() => el.classList.remove('translate-y-4', 'opacity-0'));
  setTimeout(() => {
    el.classList.add('opacity-0');
    setTimeout(() => el.remove(), 500);
  }, 3200);
}

// Opens a [hidden] overlay with an enter transition and focus handling.
export function overlay(root, panel) {
  let lastFocus;
  const parts = () => $$('[data-anim]', root);
  const onKey = (e) => e.key === 'Escape' && close();
  function open() {
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => requestAnimationFrame(() => parts().forEach((n) => n.setAttribute('data-open', ''))));
    document.addEventListener('keydown', onKey);
    setTimeout(() => panel.querySelector('a, button, input')?.focus({ preventScroll: true }), 50);
  }
  function close() {
    parts().forEach((n) => n.removeAttribute('data-open'));
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      root.hidden = true;
      document.documentElement.style.overflow = '';
      lastFocus?.focus?.({ preventScroll: true });
    }, 350);
  }
  return { open, close };
}

export function reveal(scope = document) {
  const els = $$('.reveal:not(.is-in)', scope);
  if (!('IntersectionObserver' in window)) return els.forEach((e) => e.classList.add('is-in'));
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  els.forEach((e) => io.observe(e));
}

export const arrow = '<span class="arrow" aria-hidden="true">→</span>';

export function projectCard(p, i = 0, { size = '' } = {}) {
  return `
  <a href="/case-study?p=${encodeURIComponent(p.slug)}" class="group reveal block ${size}" style="--d:${(i % 3) * 90}ms">
    <div class="relative overflow-hidden rounded-xl2 bg-line">
      <img src="${esc(p.cover)}" alt="${esc(p.title)}: ${esc(p.category)} design by Abel Create" loading="lazy" decoding="async" width="1200" height="900"
        class="aspect-[4/3] w-full object-cover transition duration-700 ease-out-expo group-hover:scale-[1.04]">
      <span class="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold backdrop-blur">${esc(p.category)}</span>
      <span class="absolute right-3 bottom-3 grid size-11 translate-y-2 place-items-center rounded-full bg-white text-lg opacity-0 shadow-lg transition duration-500 ease-out-expo group-hover:translate-y-0 group-hover:opacity-100" aria-hidden="true">↗</span>
    </div>
    <div class="mt-4 flex items-start justify-between gap-4">
      <div>
        <h3 class="font-display text-xl font-bold tracking-tight">${esc(p.title)}</h3>
        <p class="mt-1 text-sm text-mute">${esc(p.subtitle || p.category)}</p>
      </div>
      <span class="shrink-0 pt-1 text-sm text-mute">${esc(p.year || '')}</span>
    </div>
  </a>`;
}

export function productCard(p, i = 0) {
  const price = priceFor(p);
  return `
  <article class="group reveal relative flex min-w-0 flex-col" style="--d:${(i % 4) * 70}ms">
    <a href="/product?p=${encodeURIComponent(p.slug)}" class="relative block overflow-hidden rounded-xl2 bg-line">
      <img src="${esc(p.images[0])}" alt="${esc(p.title)}: ${esc(p.category)} template preview" loading="lazy" decoding="async" width="1200" height="900"
        class="aspect-[4/3] w-full object-cover transition duration-700 ease-out-expo group-hover:scale-[1.04]">
      ${p.badge ? `<span class="absolute top-3 left-3 rounded-full ${p.free ? 'bg-ink text-white' : 'bg-accent text-white'} px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">${esc(p.badge)}</span>` : ''}
    </a>
    <div class="mt-3 flex flex-1 flex-col">
      <p class="text-xs font-medium text-mute">${esc(p.category)} · ${esc((p.fileTypes || []).join(', '))}</p>
      <h3 class="mt-1 font-display text-lg leading-snug font-bold tracking-tight"><a href="/product?p=${encodeURIComponent(p.slug)}" class="after:absolute after:inset-0">${esc(p.title)}</a></h3>
      <div class="mt-auto flex items-center justify-between gap-2 pt-3">
        <p class="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span class="font-display text-lg font-bold">${money(price)}</span>
          ${p.compareAt ? `<s class="text-sm text-mute">${money(p.compareAt)}</s>` : `<span class="text-xs text-mute">${usd(p.priceUSD)}</span>`}
        </p>
        <button type="button" data-add="${esc(p.slug)}" aria-label="${p.free ? 'Get' : 'Add'} ${esc(p.title)}${p.free ? ' free' : ' to cart'}" class="relative z-10 inline-flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-ink text-xs font-semibold text-white transition hover:bg-accent active:scale-95 sm:w-auto sm:px-4">
          ${p.free ? '<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg><span class="hidden sm:inline">Get free</span>' : '<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span class="hidden sm:inline">Add</span>'}
        </button>
      </div>
    </div>
  </article>`;
}

export const skeletonCards = (n, cls = 'aspect-[4/3]') =>
  Array.from({ length: n }, () => `<div><div class="skeleton ${cls}"></div><div class="skeleton mt-4 h-4 w-2/3"></div><div class="skeleton mt-2 h-3 w-1/3"></div></div>`).join('');

export const emptyState = (title, body, cta = '') => `
  <div class="col-span-full grid place-items-center rounded-xl2 border border-dashed border-line bg-white/50 px-6 py-16 text-center">
    <p class="font-display text-2xl font-bold">${title}</p>
    <p class="mt-2 max-w-sm text-mute">${body}</p>${cta}
  </div>`;

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

export const downloadRow = (d) => `
  <li class="flex items-center gap-4 rounded-2xl border border-line p-3 pr-4">
    ${d.image ? `<img src="${esc(d.image)}" alt="" class="aspect-[4/3] w-20 shrink-0 rounded-lg object-cover">` : ''}
    <div class="min-w-0 flex-1"><p class="truncate font-semibold">${esc(d.title)}</p><p class="text-xs text-mute">${esc(d.license || '')}</p></div>
    <a href="${esc(d.url)}" class="btn-primary btn-sm shrink-0">Download</a>
  </li>`;
