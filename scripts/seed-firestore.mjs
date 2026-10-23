// Uploads the content in public/assets/js/data/seed.js to Firestore.
// Safe to re-run: documents are overwritten by slug.
//
//   node scripts/seed-firestore.mjs path/to/service-account.json
//
// Get the key from Firebase console → Project settings → Service accounts →
// Generate new private key. Keep it out of git.

import { readFileSync } from 'node:fs';
import { firestore } from '../worker/src/firestore.js';
import { projects, products, testimonials } from '../public/assets/js/data/seed.js';

const keyPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) {
  console.error('Usage: node scripts/seed-firestore.mjs path/to/service-account.json');
  process.exit(1);
}
const raw = readFileSync(keyPath, 'utf8');
const db = firestore({
  FIREBASE_SERVICE_ACCOUNT: raw,
  FIREBASE_PROJECT_ID: JSON.parse(raw).project_id,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST // local testing only
});

const strip = ({ art, ...rest }) => rest; // `art` only drives the placeholder generator

// Image paths are saved explicitly so they show up (and can be replaced) in the dashboard
for (const p of projects) {
  await db.set(`projects/${p.slug}`, {
    ...strip(p),
    cover: `/assets/img/work/${p.slug}-cover.svg`,
    images: [1, 2].map((i) => `/assets/img/work/${p.slug}-${i}.svg`),
    sketch: `/assets/img/work/${p.slug}-sketch.svg`,
    published: true
  }, { merge: false });
}
console.log(`projects: ${projects.length}`);

for (const p of products) {
  await db.set(`products/${p.slug}`, { ...strip(p), images: [1, 2, 3].map((i) => `/assets/img/products/${p.slug}-${i}.svg`), published: true }, { merge: false });
}
console.log(`products: ${products.length}`);

for (const [i, t] of testimonials.entries()) await db.set(`testimonials/t${i + 1}`, { ...t, order: i + 1, published: true }, { merge: false });
console.log(`testimonials: ${testimonials.length}`);
console.log('Done. Upload each product’s download file from the dashboard (Products → product → Download file).');
