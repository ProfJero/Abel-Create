// Uploads the content in public/assets/js/data/seed.js to Firestore.
// Safe to re-run: documents are overwritten by slug.
//
//   node scripts/seed-firestore.mjs path/to/service-account.json
//
// Get the key from Firebase console → Project settings → Service accounts →
// Generate new private key. Keep it out of git.

import { readFileSync } from 'node:fs';
import { firestore } from '../src/worker/firestore.js';
import { projects, products, testimonials } from '../public/assets/js/data/seed.js';

const keyPath = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath) {
  console.error('Usage: node scripts/seed-firestore.mjs path/to/service-account.json');
  process.exit(1);
}
const raw = readFileSync(keyPath, 'utf8');
const db = firestore({ FIREBASE_SERVICE_ACCOUNT: raw, FIREBASE_PROJECT_ID: JSON.parse(raw).project_id });

const strip = ({ art, ...rest }) => rest; // `art` only drives the placeholder generator

for (const p of projects) await db.set(`projects/${p.slug}`, { ...strip(p), published: true }, { merge: false });
console.log(`projects: ${projects.length}`);

for (const p of products) {
  await db.set(`products/${p.slug}`, { ...strip(p), published: true }, { merge: false });
  // Private record telling the Worker which R2 object to serve
  await db.set(`productFiles/${p.slug}`, { key: `${p.slug}.zip`, filename: `${p.slug}.zip` });
}
console.log(`products: ${products.length}`);

for (const [i, t] of testimonials.entries()) await db.set(`testimonials/t${i + 1}`, { ...t, order: i + 1, published: true }, { merge: false });
console.log(`testimonials: ${testimonials.length}`);
console.log('Done. Upload each product file to R2 as <slug>.zip:  npx wrangler r2 object put abel-create-files/<slug>.zip --file=<path> --remote');
