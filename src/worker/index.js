// Abel Create API (Cloudflare Worker). Static pages are served from /public by
// Workers Static Assets; only /api/* reaches this code.
//
//   POST /api/checkout          start a Paystack payment for the cart
//   GET  /api/order?reference=  confirm payment, return download links
//   POST /api/paystack/webhook  Paystack charge.success events
//   POST /api/free              free file in exchange for an email address
//   GET  /api/my-orders         a signed-in customer's purchases (Firebase ID token)
//   GET  /api/download?t=       signed, expiring file download from R2

import { firestore } from './firestore.js';
import { verifyIdToken } from './auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const fail = (error, status = 400) => json({ error }, status);
const isEmail = (v) => typeof v === 'string' && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const LICENSE_LABEL = { personal: 'Personal licence', commercial: 'Commercial licence' };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname.replace(/\/$/, '')}`;
    const missing = ['PAYSTACK_SECRET_KEY', 'FIREBASE_SERVICE_ACCOUNT', 'DOWNLOAD_SIGNING_KEY'].filter((k) => !env[k]);
    if (missing.length) {
      console.error('Missing secrets:', missing.join(', '));
      return fail('The shop is not set up yet. Please contact us to complete your order.', 503);
    }
    try {
      switch (route) {
        case 'POST /api/checkout': return await checkout(request, env, url);
        case 'GET /api/order': return await orderStatus(url, env, ctx);
        case 'POST /api/paystack/webhook': return await webhook(request, env, ctx, url);
        case 'POST /api/free': return await freeDownload(request, env, ctx, url);
        case 'GET /api/my-orders': return await myOrders(request, env, url);
        case 'GET /api/download': return await download(url, env);
        default: return fail('Not found', 404);
      }
    } catch (err) {
      console.error(route, err.stack || err);
      return fail('Something went wrong on our side. Please try again.', 500);
    }
  }
};

// ---------- Checkout ----------

async function checkout(request, env, url) {
  const { email, items } = await request.json().catch(() => ({}));
  if (!isEmail(email)) return fail('Please enter a valid email address.');
  if (!Array.isArray(items) || !items.length || items.length > 30) return fail('Your cart is empty.');

  const db = firestore(env);
  const lines = [];
  const seen = new Set();
  for (const { slug, license } of items) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    if (typeof slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(slug)) return fail('Invalid item in cart.');
    const lic = license === 'commercial' ? 'commercial' : 'personal';
    const p = await db.get(`products/${slug}`);
    if (!p || !p.published) return fail(`“${slug}” is no longer available. Please remove it from your cart.`);
    if (!p.price) continue; // free items are not sold through checkout
    const price = lic === 'commercial' ? p.commercialPrice ?? p.price * 2 : p.price;
    lines.push({ slug, title: p.title, license: lic, price, image: p.images?.[0] || `/assets/img/products/${slug}-1.svg` });
  }
  if (!lines.length) return fail('Your cart has no paid items.');

  const amount = Math.round(lines.reduce((s, l) => s + l.price, 0) * 100) / 100;
  const reference = `AC-${Date.now().toString(36)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`.toUpperCase();
  await db.set(`orders/${reference}`, {
    reference, email: email.toLowerCase(), items: lines, amount, currency: 'GHS', status: 'pending', createdAt: new Date()
  }, { merge: false });

  const res = await paystack(env, '/transaction/initialize', {
    email,
    amount: Math.round(amount * 100), // pesewas
    currency: 'GHS',
    reference,
    channels: ['card', 'mobile_money'],
    callback_url: `${url.origin}/success?reference=${reference}`,
    metadata: { items: lines.map((l) => `${l.title} (${l.license})`).join(', ') }
  });
  if (!res.status) return fail(res.message || 'Could not start payment.', 502);
  return json({ reference, accessCode: res.data.access_code, authorizationUrl: res.data.authorization_url });
}

async function paystack(env, path, body) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

// Marks an order paid exactly once, then emails the links.
async function markPaid(env, ctx, origin, order, tx) {
  const expected = Math.round(order.amount * 100);
  if (tx.status !== 'success') return order; // still pending, abandoned or failed
  if (tx.currency !== order.currency || tx.amount < expected) {
    console.warn('Payment mismatch', order.reference, tx.status, tx.amount, expected);
    return order;
  }
  const db = firestore(env);
  const won = await db.set(`orders/${order.reference}`, {
    status: 'paid', paidAt: new Date(), channel: tx.channel || '', paystackId: String(tx.id || '')
  }, { ifUpdateTime: order._updateTime });
  const paid = { ...order, status: 'paid', paidAt: new Date().toISOString() };
  if (won) ctx.waitUntil(sendDownloadEmail(env, origin, paid));
  return paid;
}

async function orderStatus(url, env, ctx) {
  const reference = url.searchParams.get('reference') || '';
  if (!/^[A-Z0-9-]{8,60}$/.test(reference)) return fail('Invalid order reference.');
  const db = firestore(env);
  let order = await db.get(`orders/${reference}`);
  if (!order) return fail('Order not found.', 404);

  if (order.status !== 'paid') {
    const v = await paystack(env, `/transaction/verify/${encodeURIComponent(reference)}`);
    if (v.status && v.data) order = await markPaid(env, ctx, url.origin, order, v.data);
  }
  if (order.status !== 'paid') return json({ status: order.status });
  return json({ status: 'paid', email: order.email, hours: hours(env), downloads: await links(env, url.origin, order) });
}

async function webhook(request, env, ctx, url) {
  const raw = await request.text();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.PAYSTACK_SECRET_KEY), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (!timingSafeEqual(sig, request.headers.get('x-paystack-signature') || '')) return fail('Bad signature', 401);

  const event = JSON.parse(raw);
  if (event.event === 'charge.success') {
    const order = await firestore(env).get(`orders/${event.data.reference}`);
    if (order && order.status !== 'paid') await markPaid(env, ctx, env.SITE_URL || url.origin, order, event.data);
  }
  return json({ ok: true });
}

// ---------- Free files ----------

async function freeDownload(request, env, ctx, url) {
  const { slug, email } = await request.json().catch(() => ({}));
  if (!isEmail(email)) return fail('Please enter a valid email address.');
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(slug)) return fail('Invalid file.');
  const db = firestore(env);
  const p = await db.get(`products/${slug}`);
  if (!p || !p.published || p.price) return fail('This file is not free.', 404);

  const reference = `FREE-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`.toUpperCase();
  const order = {
    reference, email: email.toLowerCase(), amount: 0, currency: 'GHS', status: 'paid', createdAt: new Date(), paidAt: new Date(),
    items: [{ slug, title: p.title, license: 'personal', price: 0, image: p.images?.[0] || `/assets/img/products/${slug}-1.svg` }]
  };
  await db.set(`orders/${reference}`, order, { merge: false });
  ctx.waitUntil(db.add('subscribers', { email: order.email, source: `free:${slug}`, createdAt: new Date() }));
  ctx.waitUntil(sendDownloadEmail(env, url.origin, order));
  return json({ downloads: await links(env, url.origin, order) });
}

// ---------- Customer account ----------

async function myOrders(request, env, url) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  let claims;
  try { claims = await verifyIdToken(token, env.FIREBASE_PROJECT_ID); } catch { return fail('Please sign in again.', 401); }
  if (!claims.email || !claims.email_verified) return fail('Please verify your email address.', 403);

  const orders = await firestore(env).where('orders', { email: claims.email.toLowerCase(), status: 'paid' });
  orders.sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)));
  return json({
    orders: await Promise.all(orders.map(async (o) => ({ reference: o.reference, amount: o.amount, paidAt: o.paidAt, downloads: await links(env, url.origin, o) })))
  });
}

// ---------- Signed downloads ----------

const hours = (env) => Number(env.DOWNLOAD_HOURS || 48);

async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.DOWNLOAD_SIGNING_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function links(env, origin, order) {
  const exp = Math.floor(Date.now() / 1000) + hours(env) * 3600;
  return Promise.all(order.items.map(async (it) => {
    const payload = `${order.reference}.${it.slug}.${exp}`;
    return {
      title: it.title,
      license: LICENSE_LABEL[it.license] || '',
      image: it.image,
      url: `${origin}/api/download?t=${encodeURIComponent(`${payload}.${await hmac(env, payload)}`)}`
    };
  }));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function download(url, env) {
  const parts = (url.searchParams.get('t') || '').split('.');
  if (parts.length !== 4) return fail('Invalid download link.', 403);
  const [reference, slug, exp, sig] = parts;
  if (!timingSafeEqual(sig, await hmac(env, `${reference}.${slug}.${exp}`))) return fail('Invalid download link.', 403);
  if (Number(exp) < Date.now() / 1000) {
    return new Response('This download link has expired. Sign in at /account to get a new one.', { status: 410 });
  }

  const db = firestore(env);
  const order = await db.get(`orders/${reference}`);
  if (!order || order.status !== 'paid' || !order.items.some((i) => i.slug === slug)) return fail('Download not available.', 403);

  // productFiles/{slug} is private (no client access); key defaults to <slug>.zip
  const file = await db.get(`productFiles/${slug}`);
  const key = file?.key || `${slug}.zip`;
  const obj = await env.FILES.get(key);
  if (!obj) return new Response('File is being prepared. Please contact support.', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('content-disposition', `attachment; filename="${(file?.filename || key.split('/').pop()).replace(/"/g, '')}"`);
  headers.set('content-length', String(obj.size));
  headers.set('cache-control', 'private, no-store');
  return new Response(obj.body, { headers });
}

// ---------- Email (optional, via Resend) ----------

async function sendDownloadEmail(env, origin, order) {
  if (!env.RESEND_API_KEY) return;
  const items = await links(env, origin, order);
  const rows = items.map((d) => `<tr><td style="padding:12px 0;border-bottom:1px solid #eee"><strong>${d.title}</strong><br><span style="color:#777;font-size:13px">${d.license}</span></td>
    <td style="padding:12px 0;border-bottom:1px solid #eee;text-align:right"><a href="${d.url}" style="background:#e5121b;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:600">Download</a></td></tr>`).join('');
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0b0b0c">
    <h1 style="font-size:24px">Your files are ready 🎉</h1>
    <p>Thank you for your order <strong>${order.reference}</strong>. Download your files below. Links expire in ${hours(env)} hours; get fresh ones any time at <a href="${origin}/account">${origin}/account</a>.</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="color:#777;font-size:13px;margin-top:24px">Questions? Just reply to this email.</p></div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: order.email, subject: 'Your Abel Create downloads', html })
  });
  if (!res.ok) console.error('Email failed', res.status, await res.text());
}
