// Dashboard home: key numbers, setup health, recent activity.
import { list, api, toDate } from '../data.js';
import { esc, money, fmtDate, badge } from '../kit.js';
import { state } from '../state.js';
import { API_BASE } from '../../config.js';

export default async function ({ el }) {
  const settle = (p) => p.then((v) => v, () => null);
  const [orders, messages, products, projects, files, subs, me] = await Promise.all([
    settle(list('orders', { orderBy: 'createdAt', max: 1000 })),
    settle(list('messages', { orderBy: 'createdAt', max: 100 })),
    settle(list('products')),
    settle(list('projects')),
    settle(list('productFiles')),
    settle(list('subscribers', { orderBy: 'createdAt', max: 5000 })),
    settle(api('/api/admin/me'))
  ]);

  const paid = (orders || []).filter((o) => o.status === 'paid');
  const now = new Date();
  const monthPaid = paid.filter((o) => { const d = toDate(o.paidAt); return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const revenue = (arr) => arr.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const newMsgs = (messages || []).filter((m) => !m.status || m.status === 'new');
  const fileSlugs = new Set((files || []).map((f) => f.id));
  const paidProducts = (products || []).filter((p) => p.published);
  const missingFiles = paidProducts.filter((p) => !fileSlugs.has(p.id));
  const hour = now.getHours();
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const checks = [
    [Boolean(me), 'API Worker connected', me ? 'Uploads and order tools work.' : `Can’t reach ${esc(API_BASE)}. Check API_URL in config.js, ALLOWED_ORIGINS and the Worker secrets.`],
    [(projects || []).some((p) => p.published), 'Portfolio has projects', 'Add projects under Content → Projects.'],
    [paidProducts.length > 0, 'Shop has published products', 'Publish products under Content → Products.'],
    [paidProducts.length > 0 && !missingFiles.length, 'Every published product has a download file', missingFiles.length ? `Missing: ${missingFiles.slice(0, 4).map((p) => esc(p.title)).join(', ')}${missingFiles.length > 4 ? '…' : ''}` : ''],
    [Boolean(me?.emailEnabled), 'Download emails switched on', 'Optional: add RESEND_API_KEY to the Worker so customers get links by email.'],
    [Boolean(me?.largeUploads), 'Large file uploads (over 95 MB)', 'Optional: add R2 API keys to the Worker (see Setup & guide).']
  ];
  const done = checks.filter((c) => c[0]).length;

  el.innerHTML = `
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p class="text-sm text-mute">${now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1 class="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">${hello} 👋</h1></div>
      <div class="flex flex-wrap gap-2"><a href="#/projects/new" class="btn-ghost btn-sm">+ Project</a><a href="#/products/new" class="btn-dark btn-sm">+ Product</a></div>
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      ${[
        ['Revenue this month', money(revenue(monthPaid)), plural(monthPaid.filter((o) => o.amount > 0).length, 'paid order'), '#/orders'],
        ['Revenue all time', money(revenue(paid)), plural(paid.filter((o) => o.amount > 0).length, 'paid order'), '#/orders'],
        ['New messages', newMsgs.length, `${(messages || []).length} total`, '#/messages'],
        ['Subscribers', new Set((subs || []).map((s) => s.email)).size, plural(paid.filter((o) => o.source === 'free').length, 'free download'), '#/subscribers']
      ].map(([k, v, s, href]) => `<a href="${href}" class="rounded-[1.25rem] border border-line bg-white p-4 transition hover:border-ink/30 sm:p-5">
        <p class="text-xs font-medium text-mute">${k}</p><p class="mt-1 font-display text-2xl font-bold sm:text-3xl">${v}</p><p class="mt-1 text-xs text-mute">${s}</p></a>`).join('')}
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-5">
      <section class="rounded-[1.25rem] border border-line bg-white p-5 sm:p-6 lg:col-span-3">
        <div class="flex items-center justify-between"><h2 class="font-display text-lg font-bold">Recent orders</h2><a href="#/orders" class="text-sm font-medium text-mute hover:text-ink">All →</a></div>
        <div class="mt-4 divide-y divide-line">
          ${(orders || []).slice(0, 6).map((o) => `<div class="flex items-center gap-3 py-3 text-sm">
            <span class="min-w-0 flex-1"><span class="block truncate font-medium">${esc(o.email)}</span><span class="block truncate text-xs text-mute">${esc((o.items || []).map((i) => i.title).join(', '))}</span></span>
            <span class="shrink-0 text-right"><span class="block font-semibold">${o.amount ? money(o.amount) : 'Free'}</span><span class="block text-xs text-mute">${fmtDate(toDate(o.createdAt))}</span></span>
            ${o.status === 'paid' ? '' : badge('Pending', 'amber')}</div>`).join('') || '<p class="py-6 text-center text-sm text-mute">No orders yet.</p>'}
        </div>
      </section>

      <section class="rounded-[1.25rem] border border-line bg-white p-5 sm:p-6 lg:col-span-2">
        <div class="flex items-center justify-between"><h2 class="font-display text-lg font-bold">Setup</h2><span class="text-sm font-semibold ${done === checks.length ? 'text-emerald-600' : 'text-mute'}">${done}/${checks.length}</span></div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-line"><div class="h-full rounded-full bg-emerald-500" style="width:${(done / checks.length) * 100}%"></div></div>
        <ul class="mt-4 grid gap-3">
          ${checks.map(([ok, label, help]) => `<li class="flex gap-3 text-sm">
            <span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${ok ? 'bg-emerald-500 text-white' : 'border border-line text-mute'}">${ok ? '✓' : ''}</span>
            <span><span class="font-medium ${ok ? 'text-ink/60' : ''}">${label}</span>${!ok && help ? `<span class="mt-0.5 block text-xs text-mute">${help}</span>` : ''}</span></li>`).join('')}
        </ul>
        <a href="#/guide" class="mt-5 inline-block text-sm font-semibold text-accent">Open the setup guide →</a>
      </section>
    </div>

    <section class="mt-6 rounded-[1.25rem] border border-line bg-white p-5 sm:p-6">
      <div class="flex items-center justify-between"><h2 class="font-display text-lg font-bold">Latest messages</h2><a href="#/messages" class="text-sm font-medium text-mute hover:text-ink">Inbox →</a></div>
      <div class="mt-4 grid gap-3 md:grid-cols-3">
        ${(messages || []).slice(0, 3).map((m) => `<a href="#/messages" class="rounded-xl border border-line p-4 transition hover:border-ink/30">
          <p class="flex items-center gap-2 text-sm font-semibold">${esc(m.name)} ${!m.status || m.status === 'new' ? badge('New', 'red') : ''}</p>
          <p class="mt-1 text-xs text-mute">${esc(m.service || '')} · ${fmtDate(toDate(m.createdAt))}</p>
          <p class="mt-2 line-clamp-3 text-sm text-ink/75">${esc(m.message)}</p></a>`).join('') || '<p class="text-sm text-mute md:col-span-3">No messages yet.</p>'}
      </div>
    </section>
    <p class="mt-8 text-center text-xs text-mute">Signed in as ${esc(state.user?.email || '')}</p>`;
}
