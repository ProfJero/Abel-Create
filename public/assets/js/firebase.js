// Firebase is loaded on demand so pages that never touch it stay fast.
import { FIREBASE } from './config.js';

const V = '13.1.0';
// Local testing against the Firebase emulators: on localhost, run
// localStorage.setItem('ac:emulators', '1') in the console and reload.
const EMULATORS = (() => {
  try { return /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && localStorage.getItem('ac:emulators') === '1'; } catch { return false; }
})();
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
  fsPromise ??= Promise.all([app(), import(`${CDN}/firebase-firestore.js`)]).then(([a, fs]) => {
    const db = fs.getFirestore(a);
    if (EMULATORS) fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    return { db, fs };
  });
  return fsPromise;
}

let authPromise;
export function auth() {
  authPromise ??= Promise.all([app(), import(`${CDN}/firebase-auth.js`)]).then(([a, m]) => {
    const auth = m.getAuth(a);
    if (EMULATORS) m.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    return { auth, m };
  });
  return authPromise;
}

// Write-only collections (contact messages, newsletter sign-ups).
export async function addRecord(collectionName, data) {
  const { db, fs } = await firestore();
  return fs.addDoc(fs.collection(db, collectionName), { ...data, createdAt: fs.serverTimestamp() });
}
