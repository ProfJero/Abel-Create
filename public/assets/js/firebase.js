// Firebase is loaded on demand so pages that never touch it stay fast.
import { FIREBASE } from './config.js';

const V = '13.1.0';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;

let appPromise;
function app() {
  appPromise ??= import(`${CDN}/firebase-app.js`).then(({ initializeApp }) => {
    const a = initializeApp(FIREBASE);
    // Analytics is optional; ignore blockers and unsupported browsers
    import(`${CDN}/firebase-analytics.js`)
      .then(({ getAnalytics, isSupported }) => isSupported().then((ok) => ok && getAnalytics(a)))
      .catch(() => {});
    return a;
  });
  return appPromise;
}

let fsPromise;
export function firestore() {
  fsPromise ??= Promise.all([app(), import(`${CDN}/firebase-firestore.js`)]).then(([a, fs]) => ({ db: fs.getFirestore(a), fs }));
  return fsPromise;
}

let authPromise;
export function auth() {
  authPromise ??= Promise.all([app(), import(`${CDN}/firebase-auth.js`)]).then(([a, m]) => ({ auth: m.getAuth(a), m }));
  return authPromise;
}

// Write-only collections (contact messages, newsletter sign-ups).
export async function addRecord(collectionName, data) {
  const { db, fs } = await firestore();
  return fs.addDoc(fs.collection(db, collectionName), { ...data, createdAt: fs.serverTimestamp() });
}
