// Admin-only endpoints used by the dashboard at /admin. Every handler here
// runs after requireAdmin() in index.js.
import { AwsClient } from 'aws4fetch';
import { firestore } from './firestore.js';
import { json, fail, isEmail, isSlug, HttpError } from './http.js';
import { links, sendDownloadEmail, createPaidOrder, hours } from './shop.js';

const IMAGE_TYPES = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' };
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_DIRECT_FILE = 95 * 1024 * 1024; // Workers request body limit is 100 MB (Free/Pro)

const safeName = (name) =>
  String(name || 'file').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').replace(/-+\./g, '.').replace(/^-+|-+$/g, '').slice(-120) || 'file';

// ---------- Images (public, served from /media/*) ----------

export async function uploadMedia(request, env, o) {
  const type = (request.headers.get('content-type') || '').split(';')[0];
  const ext = IMAGE_TYPES[type];
  if (!ext) return fail('Only image files can be uploaded here.');
  const size = Number(request.headers.get('content-length') || 0);
  if (size > MAX_IMAGE) return fail('Images must be under 15 MB.');

  const now = new Date();
  const base = safeName(decodeURIComponent(request.headers.get('x-filename') || 'image')).replace(/\.[^.]+$/, '');
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID().slice(0, 8)}-${base}.${ext}`;
  await env.MEDIA.put(key, request.body, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } });
  return json({ url: `${o.api}/media/${key}`, key });
}

export async function deleteMedia(url, env) {
  const key = url.searchParams.get('key') || '';
  if (!/^[\w/.-]{5,200}$/.test(key) || key.includes('..')) return fail('Invalid key.');
  await env.MEDIA.delete(key);
  return json({ ok: true });
}

export async function serveMedia(request, url, env) {
  const key = decodeURIComponent(url.pathname.slice('/media/'.length));
  if (!key || key.includes('..')) return new Response('Not found', { status: 404 });
  const obj = await env.MEDIA.get(key, { onlyIf: request.headers });
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('access-control-allow-origin', '*');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  if (!('body' in obj)) return new Response(null, { status: 304, headers });
  return new Response(request.method === 'HEAD' ? null : obj.body, { headers });
}

// ---------- Product files (private, R2 FILES bucket) ----------

const r2Configured = (env) => env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_FILES_BUCKET;

// Returns where the browser should PUT the file. With R2 API credentials the
// upload goes straight to R2 through a presigned URL (any size up to 5 GB);
// otherwise it streams through this Worker (up to ~95 MB).
export async function signFileUpload(request, env, o) {
  const { slug, filename } = await request.json().catch(() => ({}));
  if (!isSlug(slug)) return fail('Save the product before uploading its file.');
  const key = `products/${slug}/${safeName(filename)}`;

  if (r2Configured(env)) {
    const r2 = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
    const target = new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_FILES_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`);
    target.searchParams.set('X-Amz-Expires', '3600');
    const signed = await r2.sign(new Request(target, { method: 'PUT' }), { aws: { signQuery: true } });
    return json({ method: 'presigned', url: signed.url, key });
  }
  return json({ method: 'direct', url: `${o.api}/api/admin/files/upload?slug=${slug}&key=${encodeURIComponent(key)}`, key, maxBytes: MAX_DIRECT_FILE });
}

export async function directFileUpload(request, url, env) {
  const slug = url.searchParams.get('slug');
  const key = url.searchParams.get('key') || '';
  if (!isSlug(slug) || !key.startsWith(`products/${slug}/`) || key.includes('..')) return fail('Invalid upload.');
  if (Number(request.headers.get('content-length') || 0) > MAX_DIRECT_FILE) {
    return fail('This file is over 95 MB. Add R2 API credentials to the Worker to upload large files (see README).', 413);
  }
  await env.FILES.put(key, request.body, { httpMetadata: { contentType: request.headers.get('content-type') || 'application/octet-stream' } });
  return json({ ok: true, key });
}

// Records which R2 object a product delivers, after checking it exists.
export async function confirmFile(request, env) {
  const { slug, key, filename } = await request.json().catch(() => ({}));
  if (!isSlug(slug) || typeof key !== 'string' || !key.startsWith(`products/${slug}/`)) return fail('Invalid file.');
  const head = await env.FILES.head(key);
  if (!head) return fail('Upload not found. Please try again.', 404);
  const db = firestore(env);
  const previous = await db.get(`productFiles/${slug}`);
  const record = { key, filename: safeName(filename || key.split('/').pop()), size: head.size, contentType: head.httpMetadata?.contentType || '', uploadedAt: new Date() };
  await db.set(`productFiles/${slug}`, record, { merge: false });
  if (previous?.key && previous.key !== key) await env.FILES.delete(previous.key);
  return json({ ...record, uploadedAt: record.uploadedAt.toISOString() });
}

// ---------- Orders ----------

export async function orderLinks(url, env, o) {
  const order = await firestore(env).get(`orders/${url.searchParams.get('reference') || '-'}`);
  if (!order) return fail('Order not found.', 404);
  if (order.status !== 'paid') return fail('This order has not been paid.');
  return json({ hours: hours(env), downloads: await links(env, o, order) });
}

export async function resendOrder(request, env, o) {
  const { reference } = await request.json().catch(() => ({}));
  const order = await firestore(env).get(`orders/${reference || '-'}`);
  if (!order) return fail('Order not found.', 404);
  if (order.status !== 'paid') return fail('This order has not been paid.');
  if (!env.RESEND_API_KEY) return fail('Email is not set up. Copy the links and send them on WhatsApp instead.', 501);
  return json({ sent: await sendDownloadEmail(env, o, order) });
}

// Gives a customer access to files without Paystack, e.g. after a direct
// Mobile Money transfer, or as a gift. Creates a paid order and returns links.
export async function grantAccess(request, env, ctx, o) {
  const { email, slugs, amount = 0, note = '', notify = true } = await request.json().catch(() => ({}));
  if (!isEmail(email)) return fail('Enter the customer’s email address.');
  if (!Array.isArray(slugs) || !slugs.length || slugs.length > 30 || !slugs.every(isSlug)) return fail('Choose at least one product.');
  const db = firestore(env);
  const items = [];
  for (const slug of new Set(slugs)) {
    const p = await db.get(`products/${slug}`);
    if (!p) throw new HttpError(404, `Product “${slug}” not found.`);
    items.push({ slug, title: p.title, license: 'commercial', price: 0, image: p.images?.[0] || `/assets/img/products/${slug}-1.svg` });
  }
  const order = await createPaidOrder(env, {
    email, prefix: 'GIFT', source: 'admin', amount: Math.max(0, Number(amount) || 0), items, note: String(note).slice(0, 300)
  });
  if (notify) ctx.waitUntil(sendDownloadEmail(env, o, order));
  return json({ reference: order.reference, hours: hours(env), downloads: await links(env, o, order), emailed: Boolean(notify && env.RESEND_API_KEY) });
}
