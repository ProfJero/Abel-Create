// Read-side data access. Content comes from Firestore when available and
// falls back to the bundled seed data (first run, offline, or misconfigured).
import { products as seedProducts, projects as seedProjects, testimonials as seedTestimonials } from './data/seed.js';
import { SHOP } from './config.js';

const TTL = 5 * 60 * 1000;
const TIMEOUT = 4000;
const pending = {};

async function load(name, seed, sortField) {
  const key = `ac:${name}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
    // ac:content-version is bumped by the admin dashboard after each edit
    const version = Number(localStorage.getItem('ac:content-version') || 0);
    if (cached && Date.now() - cached.at < TTL && cached.at > version) return cached.data;
  } catch {}

  pending[name] ??= (async () => {
    let data = seed;
    try {
      const { firestore } = await import('./firebase.js');
      const run = firestore().then(async ({ db, fs }) => {
        const snap = await fs.getDocs(fs.query(fs.collection(db, name), fs.where('published', '==', true)));
        return snap.docs.map((d) => ({ slug: d.id, ...d.data() }));
      });
      const remote = await Promise.race([run, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT))]);
      if (remote.length) data = remote;
    } catch (err) {
      console.info(`[store] using bundled ${name}:`, err.message);
    }
    if (sortField) data = [...data].sort((a, b) => (a[sortField] ?? 99) - (b[sortField] ?? 99));
    try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch {}
    return data;
  })();
  return pending[name];
}

// Sample items (no image fields at all) use the generated placeholder art;
// items created in the dashboard use exactly the images uploaded there.
const PLACEHOLDER = '/assets/img/og-image.jpg';

const withProductDefaults = (p) => {
  const images = p.images === undefined ? [1, 2, 3].map((i) => `/assets/img/products/${p.slug}-${i}.svg`) : (p.images || []).filter(Boolean);
  return { ...p, images: images.length ? images : [PLACEHOLDER], free: !p.price };
};

const withProjectDefaults = (p) => {
  const sample = p.cover === undefined;
  return {
    ...p,
    cover: p.cover || (sample ? `/assets/img/work/${p.slug}-cover.svg` : PLACEHOLDER),
    images: sample ? [1, 2].map((i) => `/assets/img/work/${p.slug}-${i}.svg`) : (p.images || []).filter(Boolean),
    sketch: sample ? `/assets/img/work/${p.slug}-sketch.svg` : p.sketch || ''
  };
};

export const getProducts = async () => (await load('products', seedProducts)).map(withProductDefaults);
export const getProduct = async (slug) => (await getProducts()).find((p) => p.slug === slug);
export const getProjects = async () => (await load('projects', seedProjects, 'order')).map(withProjectDefaults);
export const getProject = async (slug) => (await getProjects()).find((p) => p.slug === slug);
export const getTestimonials = () => load('testimonials', seedTestimonials, 'order');
export const getReviews = async (slug) => (await load('reviews', [])).filter((r) => r.product === slug);

export const LICENSES = {
  personal: { label: 'Personal', note: 'For your own projects, church or school events and non-paid work.' },
  commercial: { label: 'Commercial', note: 'For client work and anything you sell or use to promote a business.' }
};

export function priceFor(product, license = 'personal') {
  if (!product.price) return 0;
  return license === 'commercial' ? product.commercialPrice ?? product.price * SHOP.commercialMultiplier : product.price;
}

export const money = (n) => (n ? `GH₵${Number(n).toLocaleString('en-GH', { maximumFractionDigits: 2 })}` : 'Free');
export const usd = (n) => (n ? `≈ $${n}` : '');
