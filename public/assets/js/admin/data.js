// Data access for the dashboard: Firestore (as the signed-in admin) and the
// API Worker (uploads, order tools).
import { firestore, auth } from '../firebase.js';
import { API_BASE } from '../config.js';

export const COLLECTIONS = {
  projects: { label: 'Projects', sort: 'order' },
  products: { label: 'Products', sort: 'title' },
  testimonials: { label: 'Testimonials', sort: 'order' },
  reviews: { label: 'Reviews', sort: 'createdAt' }
};

export async function list(name, { orderBy, direction = 'desc', max = 500 } = {}) {
  const { db, fs } = await firestore();
  const parts = [fs.collection(db, name)];
  if (orderBy) parts.push(fs.orderBy(orderBy, direction));
  parts.push(fs.limit(max));
  const snap = await fs.getDocs(fs.query(...parts));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function get(name, id) {
  const { db, fs } = await firestore();
  const snap = await fs.getDoc(fs.doc(db, name, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function exists(name, id) {
  return Boolean(await get(name, id));
}

// Saves a whole document (replaces it), stamping updatedAt.
export async function save(name, id, data) {
  const { db, fs } = await firestore();
  const clean = JSON.parse(JSON.stringify(data, (k, v) => (v === undefined ? null : v)));
  delete clean.id;
  await fs.setDoc(fs.doc(db, name, id), { ...clean, updatedAt: fs.serverTimestamp() });
  bumpContentVersion();
}

export async function patch(name, id, data) {
  const { db, fs } = await firestore();
  await fs.updateDoc(fs.doc(db, name, id), data);
  bumpContentVersion();
}

export async function remove(name, id) {
  const { db, fs } = await firestore();
  await fs.deleteDoc(fs.doc(db, name, id));
  bumpContentVersion();
}

// The public site caches content for 5 minutes; this tells it (in this
// browser) that content changed so you see your edits straight away.
function bumpContentVersion() {
  try { localStorage.setItem('ac:content-version', String(Date.now())); } catch {}
}

export const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

// ---------- Worker API ----------

async function token() {
  const { auth: a } = await auth();
  return a.currentUser.getIdToken();
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { authorization: `Bearer ${await token()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// PUT/POST a file with upload progress (fetch can't report it).
export function sendFile(url, file, { method = 'PUT', headers = {}, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
      xhr.status < 300 ? resolve(data) : reject(new Error(data.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection (and R2 CORS for large files).'));
    xhr.send(file);
  });
}

// Shrinks photos to WebP before upload (max 2400px) to keep the site fast.
async function optimise(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 150 * 1024) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.86));
  return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' }) : file;
}

export async function uploadImage(file, onProgress) {
  const ready = await optimise(file);
  return sendFile(`${API_BASE}/api/admin/media`, ready, {
    method: 'POST',
    headers: { authorization: `Bearer ${await token()}`, 'content-type': ready.type, 'x-filename': encodeURIComponent(ready.name) },
    onProgress
  });
}

export async function uploadProductFile(slug, file, onProgress) {
  const target = await api('/api/admin/files/sign', { method: 'POST', body: { slug, filename: file.name } });
  if (target.method === 'direct') {
    if (file.size > target.maxBytes) {
      throw new Error(`This file is ${(file.size / 1048576).toFixed(0)} MB. Files over 95 MB need R2 API keys on the Worker (see README → Large files).`);
    }
    await sendFile(target.url, file, { headers: { authorization: `Bearer ${await token()}`, 'content-type': file.type || 'application/octet-stream' }, onProgress });
  } else {
    await sendFile(target.url, file, { headers: { 'content-type': file.type || 'application/octet-stream' }, onProgress });
  }
  return api('/api/admin/files/confirm', { method: 'POST', body: { slug, key: target.key, filename: file.name } });
}
