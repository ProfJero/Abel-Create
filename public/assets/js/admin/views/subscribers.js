// Newsletter subscribers: search, export to CSV, remove.
import { list, remove, toDate } from '../data.js';
import { $, esc, h, fmtDate, toast, confirmDialog, badge, pageHeader, empty } from '../kit.js';

export default async function ({ el }) {
  const rows = await list('subscribers', { orderBy: 'createdAt', max: 5000 });
  // Keep the first sign-up per email
  const seen = new Set();
  const subs = rows.filter((s) => { const k = (s.email || '').toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  subs.forEach((s) => (s.date = toDate(s.createdAt)));

  el.innerHTML = pageHeader('Subscribers', `${subs.length} people joined your list from the newsletter form and free downloads.`, subs.length ? '<button type="button" data-csv class="btn-dark">Export CSV</button>' : '');
  if (!subs.length) {
    el.insertAdjacentHTML('beforeend', empty('No subscribers yet', 'People who sign up in the footer or download a free file appear here.'));
    return;
  }
  $('[data-csv]', el).onclick = () => {
    const csv = ['email,source,date', ...subs.map((s) => [s.email, s.source || '', s.date ? s.date.toISOString() : ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `subscribers-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const search = h('<input type="search" placeholder="Search emails" class="input mb-4 sm:max-w-xs">');
  const box = h('<div class="overflow-hidden rounded-[1.25rem] border border-line bg-white"></div>');
  el.append(search, box);
  let q = '';
  const source = (s) => (s.source?.startsWith('free:') ? badge(`Free: ${s.source.slice(5)}`, 'blue') : badge('Newsletter', 'gray'));
  const draw = () => {
    const shown = subs.filter((s) => !q || s.email.toLowerCase().includes(q));
    box.innerHTML = shown.slice(0, 500).map((s) => `
      <div class="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 sm:px-5">
        <div class="min-w-0 flex-1"><p class="truncate font-medium">${esc(s.email)}</p><div class="mt-1 sm:hidden">${source(s)}</div></div>
        <div class="hidden sm:block">${source(s)}</div>
        <span class="hidden w-28 text-right text-xs text-mute sm:block">${fmtDate(s.date)}</span>
        <button type="button" data-del="${esc(s.id)}" class="grid size-9 place-items-center rounded-full text-mute hover:bg-accent-50 hover:text-accent" aria-label="Remove ${esc(s.email)}">✕</button>
      </div>`).join('') || '<p class="p-8 text-center text-sm text-mute">No matches.</p>';
  };
  draw();
  search.oninput = () => { q = search.value.trim().toLowerCase(); draw(); };
  box.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    const s = subs.find((x) => x.id === b.dataset.del);
    if (!(await confirmDialog(`Remove ${s.email} from your list?`, { confirm: 'Remove' }))) return;
    try {
      // Remove every sign-up for this email
      await Promise.all(rows.filter((r) => r.email?.toLowerCase() === s.email.toLowerCase()).map((r) => remove('subscribers', r.id)));
      subs.splice(subs.indexOf(s), 1);
      draw();
      toast('Removed', 'ok');
    } catch (err) { toast(err.message, 'error'); }
  });
}
