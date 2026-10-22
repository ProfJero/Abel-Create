// Cart state in localStorage: [{ slug, license }]. One line per product.
const KEY = 'ac:cart';
const listeners = new Set();

export function getCart() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function save(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  listeners.forEach((fn) => fn(items));
}

export function addToCart(slug, license = 'personal') {
  save([...getCart().filter((i) => i.slug !== slug), { slug, license }]);
}

export const removeFromCart = (slug) => save(getCart().filter((i) => i.slug !== slug));
export const setLicense = (slug, license) => save(getCart().map((i) => (i.slug === slug ? { ...i, license } : i)));
export const clearCart = () => save([]);
export const inCart = (slug) => getCart().some((i) => i.slug === slug);

export function onCartChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Keep tabs in sync
window.addEventListener('storage', (e) => e.key === KEY && listeners.forEach((fn) => fn(getCart())));
