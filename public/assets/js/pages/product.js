import { $, $$, esc, params, reveal, productCard, emptyState, toast, isEmail } from '../ui.js';
import { getProducts, getReviews, priceFor, money, LICENSES } from '../store.js';
import { addToCart, getCart } from '../cart.js';
import { openCart } from '../main.js';
import { api } from '../api.js';

const root = $('[data-product]');
const slug = params().get('p');
const products = await getProducts();
const p = products.find((x) => x.slug === slug);

if (!p) {
  root.innerHTML = `<div class="wrap grid pt-16">${emptyState('File not found', 'It may have been removed or renamed.', '<a href="/shop" class="btn-dark mt-6">Back to the shop</a>')}</div>`;
} else {
  render();
}

function render() {
  document.title = `${p.title}: ${p.category} ${p.fileTypes?.[0] || ''} Template | Abel Create`;
  $('meta[name="description"]')?.setAttribute('content', `${p.summary} Instant download. ${p.free ? 'Free' : money(p.price)}.`);

  const inCartLicense = getCart().find((i) => i.slug === p.slug)?.license;
  const labels = ['Preview', 'Mockup', 'Layers close-up'];
  const bundle = products.find((b) => b.bundleOf?.includes(p.slug));
  const related = products
    .filter((x) => x.slug !== p.slug && !x.free)
    .sort((a, b) => (b.category === p.category) - (a.category === p.category) || (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 4);
  const usdFor = (lic) => (p.priceUSD ? `≈ $${Math.round((p.priceUSD * priceFor(p, lic)) / p.price)}` : '');

  const details = [
    ['File type', (p.fileTypes || []).join(', ')],
    ['File size', p.fileSize],
    ['Dimensions', p.dimensions],
    ['Fonts', (p.fonts || []).join(', ') || 'None needed'],
    ['Delivery', 'Instant download (ZIP)']
  ].filter(([, v]) => v);

  root.innerHTML = `
  <nav aria-label="Breadcrumb" class="wrap pt-6 text-sm text-mute sm:pt-8">
    <ol class="flex flex-wrap items-center gap-2"><li><a href="/shop" class="hover:text-ink">Shop</a></li><li aria-hidden="true">/</li>
    <li><a href="/shop?c=${encodeURIComponent(p.category)}" class="hover:text-ink">${esc(p.category)}</a></li><li aria-hidden="true">/</li>
    <li class="truncate text-ink" aria-current="page">${esc(p.title)}</li></ol>
  </nav>

  <div class="wrap mt-6 grid gap-10 lg:grid-cols-12 lg:gap-12">
    <!-- Gallery -->
    <div class="lg:col-span-7">
      <div class="relative overflow-hidden rounded-[1.5rem] bg-line">
        <img data-main src="${esc(p.images[0])}" alt="${esc(p.title)} ${labels[0].toLowerCase()}" width="1200" height="900" class="aspect-[4/3] w-full object-cover transition-opacity duration-300">
        ${p.badge ? `<span class="absolute top-4 left-4 rounded-full ${p.free ? 'bg-ink' : 'bg-accent'} px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">${esc(p.badge)}</span>` : ''}
      </div>
      <div class="mt-3 grid grid-cols-3 gap-3" role="tablist" aria-label="Product images">
        ${p.images.map((src, n) => `<button type="button" role="tab" data-thumb="${n}" aria-selected="${n === 0}" class="group text-left">
          <img src="${esc(src)}" alt="" loading="lazy" class="aspect-[4/3] w-full rounded-xl object-cover ring-2 ring-transparent ring-offset-2 ring-offset-paper transition group-aria-selected:ring-ink">
          <span class="mt-1.5 block text-xs text-mute group-aria-selected:text-ink">${labels[n] || `Image ${n + 1}`}</span></button>`).join('')}
      </div>
    </div>

    <!-- Buy box -->
    <div class="lg:col-span-5">
      <div class="lg:sticky lg:top-28">
        <p class="text-sm font-medium text-mute">${esc(p.category)} · ${esc((p.fileTypes || []).join(', '))}</p>
        <h1 class="mt-2 font-display text-4xl leading-[1.05] font-bold tracking-tight sm:text-5xl">${esc(p.title)}</h1>
        <p class="mt-4 text-lg text-ink/70">${esc(p.summary)}</p>

        ${p.free ? freeBox() : `
        <fieldset class="mt-8">
          <legend class="text-sm font-semibold">Choose a licence <a href="/legal/license" class="ml-1 font-normal text-mute underline underline-offset-2 hover:text-ink">What’s the difference?</a></legend>
          <div class="mt-3 grid gap-2">
            ${Object.entries(LICENSES).map(([key, l]) => `
            <label class="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-4 transition has-checked:border-ink has-checked:ring-4 has-checked:ring-ink/5">
              <input type="radio" name="license" value="${key}" ${key === (inCartLicense || 'personal') ? 'checked' : ''} class="mt-1 size-4 accent-ink">
              <span class="flex-1"><span class="flex items-baseline justify-between gap-3"><span class="font-semibold">${l.label} licence</span><span class="font-display text-lg font-bold">${money(priceFor(p, key))}</span></span>
              <span class="mt-0.5 block text-sm text-mute">${l.note}</span></span>
            </label>`).join('')}
          </div>
        </fieldset>

        <div class="mt-6 flex items-end justify-between gap-4">
          <div>
            <p class="flex items-baseline gap-2"><span data-price class="font-display text-4xl font-bold">${money(priceFor(p, inCartLicense))}</span>
            ${p.compareAt ? `<s class="text-lg text-mute">${money(p.compareAt)}</s>` : ''}</p>
            <p data-usd class="mt-1 text-sm text-mute">${usdFor(inCartLicense || 'personal')} for international buyers</p>
          </div>
        </div>
        <div class="mt-5 grid gap-2 sm:grid-cols-2">
          <button type="button" data-buy-add class="btn-dark py-4">Add to cart</button>
          <button type="button" data-buy-now class="btn-primary py-4">Buy now <span class="arrow">→</span></button>
        </div>`}

        <ul class="mt-6 grid gap-2.5 rounded-2xl border border-line bg-white p-5 text-sm">
          <li class="flex gap-3"><span class="text-accent">⚡</span><span><strong>Instant download</strong> after payment, plus a copy by email</span></li>
          <li class="flex gap-3"><span class="text-accent">🔒</span><span>Secure checkout with Paystack: Mobile Money and cards</span></li>
          <li class="flex gap-3"><span class="text-accent">↻</span><span>Re-download any time from <a href="/account" class="underline underline-offset-2">My account</a></span></li>
          <li class="flex gap-3"><span class="text-accent">✓</span><span>Covered by our <a href="/legal/refunds" class="underline underline-offset-2">refund policy</a></span></li>
        </ul>
      </div>
    </div>
  </div>

  <!-- Details -->
  <section class="wrap mt-20 grid gap-12 lg:grid-cols-12">
    <div class="lg:col-span-7">
      <h2 class="font-display text-3xl font-bold">About this file</h2>
      <p class="mt-4 text-lg leading-relaxed text-ink/80">${esc(p.description)}</p>
      ${p.includes?.length ? `<h3 class="mt-10 text-xs font-semibold uppercase tracking-[0.16em] text-mute">What’s included</h3>
      <ul class="mt-4 grid gap-3 sm:grid-cols-2">${p.includes.map((x) => `<li class="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3"><span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] text-white">✓</span>${esc(x)}</li>`).join('')}</ul>` : ''}
    </div>
    <div class="lg:col-span-5">
      <h2 class="text-xs font-semibold uppercase tracking-[0.16em] text-mute">File details</h2>
      <dl class="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
        ${details.map(([k, v]) => `<div class="flex justify-between gap-6 px-5 py-3.5 text-sm"><dt class="text-mute">${k}</dt><dd class="text-right font-medium">${esc(v)}</dd></div>`).join('')}
      </dl>
      ${p.free ? '' : `<h2 class="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-mute">Licence</h2>
      <div class="mt-4 grid gap-2 text-sm">${Object.values(LICENSES).map((l) => `<p class="rounded-2xl border border-line bg-white px-5 py-3.5"><strong>${l.label}:</strong> <span class="text-ink/70">${l.note}</span></p>`).join('')}
      <a href="/legal/license" class="link-u mt-1 text-sm">Read the full licence →</a></div>`}
    </div>
  </section>

  <section class="wrap mt-20" data-reviews hidden>
    <h2 class="font-display text-3xl font-bold">Reviews</h2>
    <div data-review-list class="mt-8 grid gap-4 md:grid-cols-2"></div>
  </section>

  ${bundle && bundle.slug !== p.slug ? `
  <section class="wrap mt-20">
    <a href="/product?p=${encodeURIComponent(bundle.slug)}" class="group grid items-center gap-6 overflow-hidden rounded-[1.5rem] bg-ink p-6 text-white sm:grid-cols-[auto_1fr_auto] sm:p-8">
      <img src="${esc(bundle.images[0])}" alt="" class="aspect-[4/3] w-full rounded-xl object-cover sm:w-48">
      <div><p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Bundle offer</p>
      <p class="mt-2 font-display text-2xl font-bold sm:text-3xl">Get this in the ${esc(bundle.title)}</p>
      <p class="mt-1 text-white/60">${esc(bundle.summary)} ${bundle.compareAt ? `Save ${money(bundle.compareAt - bundle.price)}.` : ''}</p></div>
      <span class="btn-light">View bundle <span class="arrow">→</span></span>
    </a>
  </section>` : ''}

  <section class="wrap mt-20">
    <div class="flex items-end justify-between gap-4">
      <h2 class="font-display text-3xl font-bold">You may also like</h2>
      <a href="/shop" class="link-u shrink-0 text-sm">All files →</a>
    </div>
    <div class="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">${related.map(productCard).join('')}</div>
  </section>

  ${p.free ? '' : `
  <div class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden" data-sticky-bar>
    <div class="flex items-center gap-3 pr-16">
      <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold">${esc(p.title)}</p><p data-price class="font-display font-bold">${money(priceFor(p, inCartLicense))}</p></div>
      <button type="button" data-buy-add class="btn-dark btn-sm h-11">Add to cart</button>
    </div>
  </div>`}`;

  wire();
  reveal(root);
  loadReviews();
  if (location.hash === '#free') setTimeout(() => $('#free-email')?.focus(), 300);
}

function freeBox() {
  return `
  <form id="free" data-free class="mt-8 scroll-mt-28 rounded-2xl border-2 border-ink bg-white p-5 sm:p-6" novalidate>
    <p class="font-display text-2xl font-bold">Free download</p>
    <p class="mt-1 text-sm text-mute">Enter your email and I’ll send the download link. You’ll also get new free files and design tips (unsubscribe anytime).</p>
    <label for="free-email" class="sr-only">Email address</label>
    <input id="free-email" name="email" type="email" required autocomplete="email" placeholder="you@email.com" class="input mt-4">
    <input type="text" name="company" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true">
    <button class="btn-primary mt-3 w-full py-4">Get it free <span class="arrow">→</span></button>
    <p data-msg class="mt-3 text-sm" role="status"></p>
  </form>`;
}

function wire() {
  const main = $('[data-main]');
  $$('[data-thumb]').forEach((b) =>
    b.addEventListener('click', () => {
      const n = +b.dataset.thumb;
      $$('[data-thumb]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      main.style.opacity = '0';
      setTimeout(() => { main.src = p.images[n]; main.style.opacity = '1'; }, 150);
    })
  );

  const license = () => $('input[name="license"]:checked')?.value || 'personal';
  $$('input[name="license"]').forEach((r) =>
    r.addEventListener('change', () => {
      $$('[data-price]').forEach((el) => (el.textContent = money(priceFor(p, license()))));
      const usd = $('[data-usd]');
      if (usd && p.priceUSD) usd.textContent = `≈ $${Math.round((p.priceUSD * priceFor(p, license())) / p.price)} for international buyers`;
    })
  );
  $$('[data-buy-add]').forEach((b) => b.addEventListener('click', () => { addToCart(p.slug, license()); openCart(); }));
  $('[data-buy-now]')?.addEventListener('click', () => { addToCart(p.slug, license()); location.href = '/cart'; });

  const form = $('[data-free]');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.company.value) return;
    const msg = $('[data-msg]', form);
    const email = form.email.value.trim();
    if (!isEmail(email)) {
      form.email.setAttribute('aria-invalid', 'true');
      msg.className = 'mt-3 text-sm text-accent';
      return (msg.textContent = 'Please enter a valid email address.');
    }
    form.email.removeAttribute('aria-invalid');
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Preparing your download…';
    try {
      const { downloads } = await api('/api/free', { body: { slug: p.slug, email } });
      form.innerHTML = `<p class="font-display text-2xl font-bold">It’s yours! 🎉</p>
        <p class="mt-1 text-sm text-mute">We’ve also emailed the link to ${esc(email)}.</p>
        ${downloads.map((d) => `<a href="${esc(d.url)}" class="btn-primary mt-4 w-full py-4">Download ${esc(d.title)}</a>`).join('')}`;
      toast('Download ready');
    } catch (err) {
      msg.className = 'mt-3 text-sm text-accent';
      msg.textContent = err.message || 'Something went wrong. Please try again.';
      btn.disabled = false;
      btn.innerHTML = 'Get it free <span class="arrow">→</span>';
    }
  });
}

async function loadReviews() {
  const reviews = await getReviews(p.slug);
  if (!reviews.length) return;
  $('[data-reviews]').hidden = false;
  $('[data-review-list]').innerHTML = reviews.map((r) => `
    <figure class="rounded-2xl border border-line bg-white p-6">
      <p class="text-accent" aria-label="${r.rating} out of 5">${'★'.repeat(r.rating || 5)}<span class="text-line">${'★'.repeat(5 - (r.rating || 5))}</span></p>
      <blockquote class="mt-3 leading-relaxed">${esc(r.text)}</blockquote>
      <figcaption class="mt-3 text-sm text-mute">${esc(r.name)}</figcaption>
    </figure>`).join('');
}
