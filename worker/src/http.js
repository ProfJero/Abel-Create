// Shared HTTP helpers: JSON responses, CORS for the Pages site, auth.
import { verifyIdToken } from './auth.js';
import { firestore } from './firestore.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
export const fail = (error, status = 400) => json({ error }, status);

export const isEmail = (v) => typeof v === 'string' && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
export const isSlug = (v) => typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v);
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ALLOWED_ORIGINS is a comma-separated list. A "*." segment matches one
// subdomain level, e.g. https://*.abel-create.pages.dev for preview deploys.
export function allowedOrigin(origin, env) {
  if (!origin) return null;
  const list = String(env.ALLOWED_ORIGINS || env.SITE_URL || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const ok = list.some((pattern) =>
    new RegExp('^' + pattern.split('*').map(escape).join('[a-z0-9-]+') + '$', 'i').test(origin)
  );
  return ok ? origin : null;
}

export function withCors(response, origin) {
  if (!origin) return response;
  const res = new Response(response.body, response);
  res.headers.set('access-control-allow-origin', origin);
  res.headers.append('vary', 'Origin');
  res.headers.set('access-control-expose-headers', 'content-disposition');
  return res;
}

export const preflight = (origin) =>
  new Response(null, {
    status: 204,
    headers: origin ? {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type, x-filename',
      'access-control-max-age': '86400',
      vary: 'Origin'
    } : {}
  });

// The public site's origin: the caller's Origin when it is allowed, else SITE_URL.
export const siteOrigin = (request, env) =>
  allowedOrigin(request.headers.get('origin'), env) || String(env.SITE_URL || '').replace(/\/$/, '');

export function requireEnv(env, ...names) {
  const missing = names.filter((k) => !env[k]);
  if (missing.length) {
    console.error('Missing configuration:', missing.join(', '));
    throw new HttpError(503, 'This feature is not set up yet. Please contact us.');
  }
}

export async function requireUser(request, env) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  try {
    return await verifyIdToken(token, env.FIREBASE_PROJECT_ID, { emulator: Boolean(env.FIREBASE_AUTH_EMULATOR_HOST) });
  } catch {
    throw new HttpError(401, 'Please sign in again.');
  }
}

// Admins are users with a document at admins/{uid} (see scripts/make-admin.mjs).
export async function requireAdmin(request, env) {
  const user = await requireUser(request, env);
  const admin = await firestore(env).get(`admins/${user.sub}`);
  if (!admin) throw new HttpError(403, 'This account is not an admin.');
  return user;
}
