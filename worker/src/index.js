// Abel Create API: a Cloudflare Worker deployed separately from the Pages site.
//
// Public
//   POST /api/checkout                 start a Paystack payment for the cart
//   GET  /api/order?reference=         confirm payment, return download links
//   POST /api/paystack/webhook         Paystack charge.success events
//   POST /api/free                     free file in exchange for an email address
//   GET  /api/my-orders                signed-in customer's purchases (Firebase ID token)
//   GET  /api/download?t=              signed, expiring file download from R2
//   GET  /media/<key>                  public images uploaded from the dashboard
// Admin (Firebase ID token of a user listed in admins/{uid})
//   GET    /api/admin/me
//   POST   /api/admin/media            upload an image (raw body)
//   DELETE /api/admin/media?key=
//   POST   /api/admin/files/sign       where to upload a product file
//   PUT    /api/admin/files/upload     direct upload fallback (≤ 95 MB)
//   POST   /api/admin/files/confirm    attach an uploaded file to a product
//   GET    /api/admin/orders/links?reference=
//   POST   /api/admin/orders/resend
//   POST   /api/admin/orders/grant     give a customer files without Paystack

import { json, fail, HttpError, allowedOrigin, withCors, preflight, siteOrigin, requireEnv, requireAdmin } from './http.js';
import { checkout, orderStatus, webhook, freeDownload, myOrders, download } from './shop.js';
import * as admin from './admin.js';

// The service account isn't needed when talking to the local Firestore emulator
const core = (env) => ['FIREBASE_PROJECT_ID', 'DOWNLOAD_SIGNING_KEY', ...(env.FIRESTORE_EMULATOR_HOST ? [] : ['FIREBASE_SERVICE_ACCOUNT'])];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request.headers.get('origin'), env);
    if (request.method === 'OPTIONS') return preflight(origin);

    const o = { api: url.origin, site: siteOrigin(request, env) };
    let res;
    try {
      res = await route(request, env, ctx, url, o);
    } catch (err) {
      if (err instanceof HttpError) res = fail(err.message, err.status);
      else {
        console.error(request.method, url.pathname, err.stack || err);
        res = fail('Something went wrong on our side. Please try again.', 500);
      }
    }
    return withCors(res, origin);
  }
};

async function route(request, env, ctx, url, o) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const m = request.method;

  if ((m === 'GET' || m === 'HEAD') && path.startsWith('/media/')) return admin.serveMedia(request, url, env);
  if (path === '/' || path === '/api') return json({ ok: true, service: 'abel-create-api' });

  if (path.startsWith('/api/admin/')) {
    requireEnv(env, ...core(env));
    const user = await requireAdmin(request, env);
    switch (`${m} ${path}`) {
      case 'GET /api/admin/me': return json({ uid: user.sub, email: user.email, admin: true, emailEnabled: Boolean(env.RESEND_API_KEY), largeUploads: Boolean(env.R2_ACCESS_KEY_ID) });
      case 'POST /api/admin/media': return admin.uploadMedia(request, env, o);
      case 'DELETE /api/admin/media': return admin.deleteMedia(url, env);
      case 'POST /api/admin/files/sign': return admin.signFileUpload(request, env, o);
      case 'PUT /api/admin/files/upload': return admin.directFileUpload(request, url, env);
      case 'POST /api/admin/files/confirm': return admin.confirmFile(request, env);
      case 'GET /api/admin/orders/links': return admin.orderLinks(url, env, o);
      case 'POST /api/admin/orders/resend': return admin.resendOrder(request, env, o);
      case 'POST /api/admin/orders/grant': return admin.grantAccess(request, env, ctx, o);
    }
    return fail('Not found', 404);
  }

  switch (`${m} ${path}`) {
    case 'POST /api/checkout':
      requireEnv(env, ...core(env), 'PAYSTACK_SECRET_KEY');
      return checkout(request, env, o);
    case 'GET /api/order':
      requireEnv(env, ...core(env), 'PAYSTACK_SECRET_KEY');
      return orderStatus(url, env, ctx, o);
    case 'POST /api/paystack/webhook':
      requireEnv(env, ...core(env), 'PAYSTACK_SECRET_KEY');
      return webhook(request, env, ctx, o);
    case 'POST /api/free':
      requireEnv(env, ...core(env));
      return freeDownload(request, env, ctx, o);
    case 'GET /api/my-orders':
      requireEnv(env, ...core(env));
      return myOrders(request, env, o);
    case 'GET /api/download':
      requireEnv(env, ...core(env));
      return download(url, env, o);
  }
  return fail('Not found', 404);
}
