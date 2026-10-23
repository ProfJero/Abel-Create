// Orders: sales list, download links for support, and manual access grants.
import { list, api, toDate } from '../data.js';
import { $, $$, esc, h, money, fmtDate, toast, copy, modal, badge, pageHeader, empty, buildForm } from '../kit.js';

const statusBadge = (o) => (o.status === 'paid' ? badge('Paid', 'green') : badge(o.status || 'pending', 'amber'));
const sourceBadge = (o) => ({ free: badge('Free file', 'gray'), admin: badge('Given by you', 'blue') })[o.source] || '';

export default async function ({ el }) {
  const [orders, products] = await Promise.all([list('orders', { orderBy: 'createdAt', max: 1000 }), list('products')]);
  orders.forEach((o) => (o.date = toDate(o.paidAt || o.createdAt)));

  const paid = orders.filter((o) => o.status === 'paid');
  const now = new Date();
  const thisMonth = paid.filter((o) => o.date?.getMonth() === now.getMonth() && o.date?.getFullYear() === now.getFullYear());
  const sum = (arr) => arr.reduce((s, o) => s + (Number(o.amount) || 0), 0);

  el.innerHTML = pageHeader('Orders', 'Every purchase, free download and file you’ve given away.', '<button type="button" data-grant class="btn-primary">+ Give file access</button>') + `
    <div class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      ${[['Revenue this month', money(sum(thisMonth))], ['Revenue all time', money(sum(paid))], ['Paid orders', paid.filter((o) => o.amount > 0).length], ['Free downloads', paid.filter((o) => o.source === 'free').length]]
        .map(([k, v]) => `<div class="rounded-[1.25rem] border border-line bg-white p-4 sm:p-5"><p class="text-xs font-medium text-mute">${k}</p><p class="mt-1 font-display text-2xl font-bold sm:text-3xl">${v}</p></div>`).join('')}
    </div>`;

  $('[data-grant]', el).onclick = () => grantDialog(products);
  if (!orders.length) {
    el.insertAdjacentHTML('beforeend', empty('No orders yet', 'Orders appear here as soon as someone checks out or downloads a free file.'));
    return;
  }

  const filters = h(`<div class="mb-4 flex flex-col gap-2 sm:flex-row">
    <input type="search" placeholder="Search email or reference" class="input sm:max-w-xs">
    <div class="no-scrollbar flex gap-2 overflow-x-auto">
      ${[['all', 'All'], ['paid', 'Paid'], ['pending', 'Pending'], ['free', 'Free'], ['admin', 'Given']].map(([k, l], i) => `<button type="button" class="tab" data-f="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}
    </div></div>`);
  const box = h(`<div class="overflow-hidden rounded-[1.25rem] border border-line bg-white"></div>`);
  el.append(filters, box);
  let f = 'all';
  let q = '';
  const match = (o) =>
    (f === 'all' || (f === 'paid' && o.status === 'paid' && o.amount > 0) || (f === 'pending' && o.status !== 'paid') || o.source === f) &&
    (!q || `${o.email} ${o.reference}`.toLowerCase().includes(q));

  const draw = () => {
    const shown = orders.filter(match);
    box.innerHTML = shown.length ? `
      <div class="hidden grid-cols-[1.4fr_1.6fr_.8fr_.8fr_.9fr] gap-4 border-b border-line bg-paper/60 px-5 py-2.5 text-xs font-semibold text-mute md:grid">
        <span>Customer</span><span>Items</span><span>Amount</span><span>Status</span><span>Date</span></div>
      ${shown.slice(0, 300).map((o) => `
      <button type="button" data-ref="${esc(o.reference)}" class="grid w-full gap-1 border-b border-line px-4 py-3.5 text-left last:border-0 hover:bg-paper/60 md:grid-cols-[1.4fr_1.6fr_.8fr_.8fr_.9fr] md:items-center md:gap-4 md:px-5">
        <span class="min-w-0"><span class="block truncate font-semibold">${esc(o.email)}</span><span class="block truncate font-mono text-[11px] text-mute">${esc(o.reference)}</span></span>
        <span class="truncate text-sm text-ink/75">${esc((o.items || []).map((i) => i.title).join(', '))}</span>
        <span class="text-sm font-semibold">${o.amount ? money(o.amount) : '—'}</span>
        <span class="flex flex-wrap gap-1">${statusBadge(o)}${sourceBadge(o)}</span>
        <span class="text-xs text-mute">${fmtDate(o.date, true)}</span>
      </button>`).join('')}` : '<p class="p-8 text-center text-sm text-mute">No orders match.</p>';
  };
  draw();
  $('input', filters).oninput = (e) => { q = e.target.value.trim().toLowerCase(); draw(); };
  $$('[data-f]', filters).forEach((b) => (b.onclick = () => { f = b.dataset.f; $$('[data-f]', filters).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); }));
  box.addEventListener('click', (e) => {
    const row = e.target.closest('[data-ref]');
    if (row) orderDialog(orders.find((o) => o.reference === row.dataset.ref));
  });
}

function linksHtml(downloads, hours) {
  return `<div class="mt-4 rounded-xl border border-line">
    ${downloads.map((d) => `<div class="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
      <span class="min-w-0 flex-1 truncate text-sm font-medium">${esc(d.title)}</span>
      <button type="button" data-copy="${esc(d.url)}" class="btn-ghost btn-sm shrink-0">Copy link</button></div>`).join('')}
  </div>
  <p class="mt-2 text-xs text-mute">Links expire in ${hours} hours.</p>`;
}

function shareText(order, downloads) {
  return `Hi! Here ${downloads.length > 1 ? 'are your downloads' : 'is your download'} from Abel Create (order ${order.reference}):\n\n${downloads.map((d) => `${d.title}:\n${d.url}`).join('\n\n')}\n\nThe links expire in 48 hours. Thank you!`;
}

function wireLinks(root, order, downloads) {
  $$('[data-copy]', root).forEach((b) => (b.onclick = () => copy(b.dataset.copy, 'Link copied')));
  const text = shareText(order, downloads);
  $('[data-copy-all]', root).onclick = () => copy(text, 'Message copied');
  $('[data-wa]', root).href = `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function orderDialog(o) {
  const m = modal({
    title: `Order ${o.reference}`,
    wide: true,
    body: `
      <dl class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div><dt class="text-xs text-mute">Customer</dt><dd class="mt-0.5 break-all font-medium">${esc(o.email)}</dd></div>
        <div><dt class="text-xs text-mute">Amount</dt><dd class="mt-0.5 font-medium">${o.amount ? money(o.amount) : 'Free'}</dd></div>
        <div><dt class="text-xs text-mute">Status</dt><dd class="mt-0.5 flex flex-wrap gap-1">${statusBadge(o)}${sourceBadge(o)}</dd></div>
        <div><dt class="text-xs text-mute">Date</dt><dd class="mt-0.5 font-medium">${fmtDate(o.date, true)}</dd></div>
        ${o.channel ? `<div><dt class="text-xs text-mute">Paid with</dt><dd class="mt-0.5 font-medium">${esc(o.channel.replace('_', ' '))}</dd></div>` : ''}
        ${o.note ? `<div class="col-span-2 sm:col-span-3"><dt class="text-xs text-mute">Note</dt><dd class="mt-0.5">${esc(o.note)}</dd></div>` : ''}
      </dl>
      <h3 class="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-mute">Items</h3>
      <ul class="mt-2 divide-y divide-line rounded-xl border border-line">
        ${(o.items || []).map((i) => `<li class="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span><span class="font-medium">${esc(i.title)}</span><span class="block text-xs text-mute">${i.license === 'commercial' ? 'Commercial' : 'Personal'} licence</span></span><span>${i.price ? money(i.price) : '—'}</span></li>`).join('')}
      </ul>
      ${o.status === 'paid' ? `<div data-links class="mt-6">
        <div class="flex flex-wrap gap-2">
          <button type="button" data-get class="btn-dark btn-sm">Get download links</button>
          <button type="button" data-resend class="btn-ghost btn-sm">Email links to customer</button>
          <a href="mailto:${esc(o.email)}?subject=${encodeURIComponent(`Your Abel Create order ${o.reference}`)}" class="btn-ghost btn-sm">Write to customer</a>
        </div>
        <div data-out></div></div>` : `<p class="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">This payment hasn’t been confirmed. If the customer paid, it will turn “Paid” automatically when Paystack confirms it.</p>`}`
  });
  if (o.status !== 'paid') return;
  const out = $('[data-out]', m.el);
  $('[data-get]', m.el).onclick = async (e) => {
    e.target.disabled = true;
    try {
      const { downloads, hours } = await api(`/api/admin/orders/links?reference=${encodeURIComponent(o.reference)}`);
      out.innerHTML = linksHtml(downloads, hours) + `<div class="mt-3 flex flex-wrap gap-2"><button type="button" data-copy-all class="btn-ghost btn-sm">Copy message</button><a data-wa target="_blank" rel="noopener" class="btn btn-sm bg-[#25D366] text-white">Send on WhatsApp</a></div>`;
      wireLinks(out, o, downloads);
    } catch (err) { toast(err.message, 'error'); }
    e.target.disabled = false;
  };
  $('[data-resend]', m.el).onclick = async (e) => {
    e.target.disabled = true;
    try {
      const { sent } = await api('/api/admin/orders/resend', { method: 'POST', body: { reference: o.reference } });
      toast(sent ? `Links emailed to ${o.email}` : 'The email could not be sent', sent ? 'ok' : 'error');
    } catch (err) { toast(err.message, 'error'); }
    e.target.disabled = false;
  };
}

function grantDialog(products) {
  const form = buildForm([{ section: 'Give file access', hint: 'For customers who paid you directly (e.g. Mobile Money transfer), or as a gift. Creates a paid order they can re-download from My account.', fields: [
    { key: 'email', label: 'Customer email', required: true, span: 'full', validate: (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? 'Enter a valid email.' : '') },
    { key: 'slugs', label: 'Products', type: 'checklist', required: true, span: 'full', options: products.map((p) => ({ value: p.id, label: `${p.title}${p.price ? ` · ${money(p.price)}` : ''}` })) },
    { key: 'amount', label: 'Amount they paid you', type: 'number', prefix: 'GH₵', min: 0, hint: 'Counts toward revenue. Leave empty for a gift.' },
    { key: 'note', label: 'Note (only you see this)', placeholder: 'MoMo ref 12345' },
    { key: 'notify', label: 'Email the links', type: 'toggle', default: true, desc: 'Needs email set up on the Worker.' }
  ] }]);
  form.el.firstElementChild.classList.remove('border', 'p-5', 'sm:p-6');
  form.el.firstElementChild.classList.add('p-0');
  const m = modal({ title: 'Give file access', wide: true, body: form.el, actions: '<button type="button" data-x2 class="btn-ghost">Cancel</button><button type="button" data-go class="btn-primary">Create order</button>' });
  $('[data-x2]', m.el).onclick = () => m.close();
  $('[data-go]', m.el).onclick = async (e) => {
    if (!form.validate()) return;
    e.target.disabled = true;
    e.target.textContent = 'Creating…';
    try {
      const v = form.values();
      const r = await api('/api/admin/orders/grant', { method: 'POST', body: { ...v, email: v.email.toLowerCase() } });
      const order = { reference: r.reference };
      form.el.innerHTML = `<p class="font-display text-xl font-bold">Done ✓</p>
        <p class="mt-1 text-sm text-mute">${r.emailed ? `We emailed the links to ${esc(v.email)}.` : 'Send these links to the customer:'}</p>
        ${linksHtml(r.downloads, r.hours)}
        <div class="mt-3 flex flex-wrap gap-2"><button type="button" data-copy-all class="btn-ghost btn-sm">Copy message</button><a data-wa target="_blank" rel="noopener" class="btn btn-sm bg-[#25D366] text-white">Send on WhatsApp</a></div>`;
      wireLinks(form.el, order, r.downloads);
      e.target.remove();
      $('[data-x2]', m.el).textContent = 'Close';
      $('[data-x2]', m.el).onclick = () => { m.close(); window.dispatchEvent(new HashChangeEvent('hashchange')); };
    } catch (err) {
      toast(err.message, 'error');
      e.target.disabled = false;
      e.target.textContent = 'Create order';
    }
  };
}
