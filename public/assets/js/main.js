// Runs on every page: header, menu, cart drawer, newsletter, scroll reveal.
import { $, $$, esc, overlay, reveal, toast, isEmail } from './ui.js';
import { getCart, addToCart, removeFromCart, onCartChange } from './cart.js';
import { getProducts, priceFor, money, LICENSES } from './store.js';

// Header background once the page scrolls
const header = $('#site-header');
const onScroll = () => header?.toggleAttribute('data-scrolled', scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Mobile menu
const menuRoot = $('[data-menu]');
if (menuRoot) {
  const menu = overlay(menuRoot, $('[data-menu-panel]'));
  const btn = $('[data-menu-open]');
  btn?.addEventListener('click', () => { btn.setAttribute('aria-expanded', 'true'); menu.open(); });
  $$('[data-menu-close]', menuRoot).forEach((b) => b.addEventListener('click', () => { btn?.setAttribute('aria-expanded', 'false'); menu.close(); }));
}

// Cart drawer
const cartRoot = $('[data-cart]');
const drawer = cartRoot && overlay(cartRoot, $('[data-cart-panel]'));
export const openCart = () => drawer?.open();
$$('[data-cart-open]').forEach((b) => b.addEventListener('click', openCart));
$$('[data-cart-close]', cartRoot).forEach((b) => b.addEventListener('click', () => drawer.close()));

async function renderCart(items = getCart()) {
  const n = items.length;
  $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.hidden = !n; });
  const countText = $('[data-cart-count-text]');
  if (countText) countText.textContent = n ? `(${n})` : '';
  const list = $('[data-cart-items]');
  if (!list) return;
  $('[data-cart-footer]').hidden = !n;
  if (!n) {
    list.innerHTML = `<div class="grid h-full place-items-center text-center"><div>
      <div class="mx-auto grid size-16 place-items-center rounded-full bg-white text-2xl">🛍️</div>
      <p class="mt-4 font-display text-xl font-bold">Your cart is empty</p>
      <p class="mt-1 text-sm text-mute">Templates you add will show up here.</p>
      <a href="/shop" class="btn-dark mt-6">Browse the shop</a></div></div>`;
    return;
  }
  const products = await getProducts();
  let total = 0;
  list.innerHTML = items.map(({ slug, license }) => {
    const p = products.find((x) => x.slug === slug);
    if (!p) return '';
    const price = priceFor(p, license);
    total += price;
    return `<div class="flex gap-4 border-b border-line py-4 first:pt-0">
      <a href="/product?p=${esc(slug)}" class="shrink-0"><img src="${esc(p.images[0])}" alt="" class="size-20 rounded-xl object-cover"></a>
      <div class="min-w-0 flex-1">
        <a href="/product?p=${esc(slug)}" class="line-clamp-2 font-semibold leading-snug">${esc(p.title)}</a>
        <p class="mt-1 text-xs text-mute">${LICENSES[license]?.label || 'Personal'} licence · ${esc((p.fileTypes || []).join(', '))}</p>
        <div class="mt-2 flex items-center justify-between">
          <span class="font-semibold">${money(price)}</span>
          <button type="button" data-remove="${esc(slug)}" class="text-xs font-medium text-mute underline-offset-2 hover:text-accent hover:underline">Remove</button>
        </div>
      </div>
    </div>`;
  }).join('');
  $('[data-cart-total]').textContent = money(total);
}

document.addEventListener('click', async (e) => {
  const rm = e.target.closest('[data-remove]');
  if (rm) return removeFromCart(rm.dataset.remove);

  const add = e.target.closest('[data-add]');
  if (!add) return;
  e.preventDefault();
  const slug = add.dataset.add;
  const p = (await getProducts()).find((x) => x.slug === slug);
  if (!p) return;
  // Free files are swapped for an email address on the product page
  if (p.free) return (location.href = `/product?p=${encodeURIComponent(slug)}#free`);
  addToCart(slug, add.dataset.license || 'personal');
  openCart();
});

onCartChange(renderCart);
renderCart();

// Newsletter (footer and anywhere else with [data-newsletter])
$$('[data-newsletter]').forEach((form) =>
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('[data-msg]', form);
    const email = form.email.value.trim();
    if (form.company?.value) return; // bot trap
    if (!isEmail(email)) {
      form.email.setAttribute('aria-invalid', 'true');
      msg.textContent = 'Please enter a valid email address.';
      return;
    }
    form.email.removeAttribute('aria-invalid');
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const { addRecord } = await import('./firebase.js');
      await addRecord('subscribers', { email: email.toLowerCase(), source: location.pathname });
      form.reset();
      msg.textContent = 'You’re in! Watch your inbox for free templates.';
      toast('Subscribed. Thank you!');
    } catch (err) {
      console.error(err);
      msg.textContent = 'Something went wrong. Please try again.';
    } finally {
      btn.disabled = false;
    }
  })
);

reveal();
