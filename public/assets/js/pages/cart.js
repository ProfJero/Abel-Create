import { $, $$, esc, emptyState, isEmail } from '../ui.js';
import { getCart, removeFromCart, setLicense, onCartChange } from '../cart.js';
import { getProducts, priceFor, money, LICENSES } from '../store.js';
import { api } from '../api.js';

const lines = $('[data-lines]');
const form = $('[data-pay]');
const error = $('[data-error]');
const submit = $('[data-submit]');
const products = await getProducts();

try { form.email.value = localStorage.getItem('ac:email') || ''; } catch {}

function render(items = getCart()) {
  const rows = items.map((i) => ({ ...i, p: products.find((p) => p.slug === i.slug) })).filter((r) => r.p);
  if (!rows.length) {
    $('[data-checkout]').innerHTML = `<div class="lg:col-span-12 grid">${emptyState('Your cart is empty', 'Find a template you love, then come back here to check out.', '<a href="/shop" class="btn-dark mt-6">Browse the shop</a>')}</div>`;
    return;
  }
  const total = rows.reduce((s, r) => s + priceFor(r.p, r.license), 0);
  lines.innerHTML = rows.map(({ p, license }) => `
    <div class="flex gap-4 py-5 sm:gap-5 sm:py-6">
      <a href="/product?p=${esc(p.slug)}" class="shrink-0"><img src="${esc(p.images[0])}" alt="" class="aspect-[4/3] w-24 rounded-xl object-cover sm:w-36"></a>
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <a href="/product?p=${esc(p.slug)}" class="font-display text-lg leading-snug font-bold">${esc(p.title)}</a>
            <p class="mt-0.5 text-xs text-mute">${esc(p.category)} · ${esc((p.fileTypes || []).join(', '))} · ${esc(p.fileSize || '')}</p>
          </div>
          <p class="shrink-0 font-semibold">${money(priceFor(p, license))}</p>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label class="relative min-w-0 max-w-full">
            <span class="sr-only">Licence for ${esc(p.title)}</span>
            <select data-license="${esc(p.slug)}" class="input w-auto max-w-full appearance-none truncate rounded-full py-2 pr-8 pl-3.5 text-xs font-medium">
              ${Object.entries(LICENSES).map(([k, l]) => `<option value="${k}" ${k === license ? 'selected' : ''}>${l.label} · ${money(priceFor(p, k))}</option>`).join('')}
            </select>
            <svg class="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-mute" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </label>
          <button type="button" data-remove="${esc(p.slug)}" class="text-sm font-medium text-mute hover:text-accent">Remove</button>
        </div>
      </div>
    </div>`).join('');
  $('[data-n]').textContent = rows.length;
  $('[data-total]').textContent = money(total);
  submit.textContent = `Pay ${money(total)} securely`;
  $$('[data-license]').forEach((s) => s.addEventListener('change', () => setLicense(s.dataset.license, s.value)));
}

onCartChange(render);
render();

const showError = (m) => { error.textContent = m; error.classList.toggle('hidden', !m); };

function loadPaystack() {
  if (window.PaystackPop) return Promise.resolve();
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v2/inline.js';
    s.onload = ok;
    s.onerror = () => fail(new Error('Could not load Paystack. Check your connection.'));
    document.head.append(s);
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  showError('');
  const email = form.email.value.trim();
  if (!isEmail(email)) { form.email.setAttribute('aria-invalid', 'true'); form.email.focus(); return showError('Please enter a valid email address.'); }
  form.email.removeAttribute('aria-invalid');
  if (!form.agree.checked) return showError('Please accept the terms to continue.');

  const label = submit.textContent;
  submit.disabled = true;
  submit.textContent = 'Starting secure checkout…';
  try {
    try { localStorage.setItem('ac:email', email); } catch {}
    // Prices are recalculated on the server from Firestore; the cart only sends slugs and licences
    const { reference, accessCode, authorizationUrl } = await api('/api/checkout', { body: { email, items: getCart() } });
    const done = () => (location.href = `/success?reference=${encodeURIComponent(reference)}`);
    try {
      await loadPaystack();
      new window.PaystackPop().resumeTransaction(accessCode, {
        onSuccess: done,
        onCancel: () => { submit.disabled = false; submit.textContent = label; },
        onError: (err) => { showError(err?.message || 'Payment failed. Please try again.'); submit.disabled = false; submit.textContent = label; }
      });
    } catch {
      location.href = authorizationUrl; // full-page Paystack checkout as a fallback
    }
  } catch (err) {
    showError(err.message);
    submit.disabled = false;
    submit.textContent = label;
  }
});
