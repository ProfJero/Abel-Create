// Site-wide settings. Edit these, then run `npm run build`.
// Also used by scripts/build-html.mjs to fill {{site.*}} placeholders.

export const SITE = {
  name: 'Abel Create',
  owner: 'Abel', // put your full name here: it helps people find you on Google
  title: 'Graphic Designer & Brand Identity Specialist',
  tagline: 'I design brands, flyers and social media graphics that help Ghanaian businesses stand out, win trust and sell more.',
  url: 'https://abelcreate.com',
  email: 'hello@abelcreate.com',
  phone: '+233 20 000 0000',
  whatsapp: '233200000000', // international format, digits only
  city: 'Cape Coast',
  country: 'Ghana',
  hours: 'Mon – Sat, 8am – 6pm GMT',
  responseTime: 'I reply within 24 hours',
  award: 'Graphic Designer of the Year · CCTU Eminence Awards 2026',
  cv: '/assets/files/abel-create-cv.pdf',
  socials: {
    instagram: 'https://instagram.com/abelcreate',
    behance: 'https://behance.net/abelcreate',
    linkedin: 'https://linkedin.com/in/abelcreate',
    x: 'https://x.com/abelcreate',
    facebook: 'https://facebook.com/abelcreate'
  }
};

export const SHOP = {
  currency: 'GHS',
  // Commercial licence price when a product has no `commercialPrice`
  commercialMultiplier: 2,
  // Download links expire after this many hours
  downloadHours: 48
};

// Payments: the Paystack secret key lives only in the Cloudflare Worker
// (`wrangler secret put PAYSTACK_SECRET_KEY`). The browser never needs a key.

// The API Worker (worker/). Paste its URL here after `npm run deploy:api`.
// Local development (npm run dev) automatically uses the local Worker.
const API_URL = 'https://abel-create-api.YOUR-SUBDOMAIN.workers.dev';
const isLocal = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const API_BASE = isLocal ? `http://${location.hostname}:8787` : API_URL;

export const FIREBASE = {
  apiKey: 'AIzaSyC_NAI-INDrZvSM1Ke4x_qnoai0PksdZus',
  authDomain: 'safetrace-247bd.firebaseapp.com',
  projectId: 'safetrace-247bd',
  storageBucket: 'safetrace-247bd.firebasestorage.app',
  messagingSenderId: '87303850861',
  appId: '1:87303850861:web:0f7b648b3bd584c211a864',
  measurementId: 'G-2W2LD3J17T'
};
