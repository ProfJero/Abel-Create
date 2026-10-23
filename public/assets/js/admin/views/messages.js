// Contact-form inbox.
import { list, patch, remove, toDate } from '../data.js';
import { $, $$, esc, h, fmtDate, toast, confirmDialog, badge, pageHeader, empty } from '../kit.js';
import { setUnread } from '../state.js';
import { SITE } from '../../config.js';

export async function refreshUnread() {
  const msgs = await list('messages', { orderBy: 'createdAt', max: 300 });
  setUnread(msgs.filter((x) => !x.status || x.status === 'new').length);
}

export default async function ({ el }) {
  const messages = await list('messages', { orderBy: 'createdAt', max: 300 });
  messages.forEach((x) => { x.date = toDate(x.createdAt); x.status ||= 'new'; });
  const count = () => setUnread(messages.filter((x) => x.status === 'new').length);
  count();

  el.innerHTML = pageHeader('Messages', 'Project enquiries from the contact form.');
  if (!messages.length) {
    el.insertAdjacentHTML('beforeend', empty('No messages yet', 'When someone fills in the contact form, it lands here.'));
    return;
  }

  const filters = h(`<div class="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
    ${[['new', 'New'], ['read', 'Read'], ['archived', 'Archived'], ['all', 'All']].map(([k, l], i) => `<button type="button" class="tab" data-f="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>`);
  const listEl = h('<div class="grid grid-cols-1 gap-3"></div>');
  el.append(filters, listEl);
  let f = 'new';

  const draw = () => {
    const shown = messages.filter((x) => f === 'all' || x.status === f);
    listEl.innerHTML = shown.length ? shown.map((x) => `
      <details data-id="${esc(x.id)}" class="group min-w-0 rounded-[1.25rem] border border-line bg-white open:shadow-sm">
        <summary class="flex cursor-pointer list-none items-start gap-3 p-4 sm:gap-4 sm:p-5">
          <span class="grid size-10 shrink-0 place-items-center rounded-full ${x.status === 'new' ? 'bg-accent text-white' : 'bg-paper text-ink/70'} text-sm font-bold">${esc((x.name || '?')[0].toUpperCase())}</span>
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-x-2 gap-y-1"><span class="font-semibold">${esc(x.name)}</span>${x.status === 'new' ? badge('New', 'red') : ''}${x.service ? badge(x.service, 'gray') : ''}${x.budget ? badge(x.budget, 'blue') : ''}</span>
            <span class="mt-1 block truncate text-sm text-mute group-open:hidden">${esc(x.message)}</span>
          </span>
          <span class="hidden shrink-0 text-xs text-mute sm:block">${fmtDate(x.date, true)}</span>
        </summary>
        <div class="border-t border-line px-4 pt-4 pb-5 sm:px-5">
          <p class="text-sm text-mute">${fmtDate(x.date, true)} · <a href="mailto:${esc(x.email)}" class="font-medium text-ink underline-offset-2 hover:underline">${esc(x.email)}</a></p>
          <p class="mt-3 break-words whitespace-pre-wrap leading-relaxed">${esc(x.message)}</p>
          <div class="mt-5 flex flex-wrap gap-2">
            <a href="mailto:${esc(x.email)}?subject=${encodeURIComponent(`Re: ${x.service || 'your project'}`)}&body=${encodeURIComponent(`Hi ${x.name},\n\nThanks for reaching out about ${x.service || 'your project'}.\n\n\n— ${SITE.owner}, ${SITE.name}`)}" class="btn-dark btn-sm">Reply by email</a>
            ${x.status !== 'archived' ? '<button type="button" data-set="archived" class="btn-ghost btn-sm">Archive</button>' : '<button type="button" data-set="read" class="btn-ghost btn-sm">Move to inbox</button>'}
            ${x.status === 'read' ? '<button type="button" data-set="new" class="btn-ghost btn-sm">Mark unread</button>' : ''}
            <button type="button" data-del class="btn-ghost btn-sm text-accent">Delete</button>
          </div>
        </div>
      </details>`).join('') : `<p class="rounded-[1.25rem] border border-dashed border-line bg-white p-10 text-center text-sm text-mute">${f === 'new' ? 'You’re all caught up 🎉' : 'Nothing here.'}</p>`;
  };
  draw();

  $$('[data-f]', filters).forEach((b) => (b.onclick = () => { f = b.dataset.f; $$('[data-f]', filters).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); }));

  const setStatus = async (x, status, redraw = true) => {
    try {
      await patch('messages', x.id, { status });
      x.status = status;
      count();
      if (redraw) draw();
    } catch (err) { toast(err.message, 'error'); }
  };
  // Opening a new message marks it read (without collapsing it)
  listEl.addEventListener('toggle', (e) => {
    const x = messages.find((m) => m.id === e.target.dataset.id);
    if (e.target.open && x?.status === 'new') setStatus(x, 'read', false);
  }, true);
  listEl.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-id]');
    const x = card && messages.find((m) => m.id === card.dataset.id);
    if (!x) return;
    const set = e.target.closest('[data-set]');
    if (set) return setStatus(x, set.dataset.set);
    if (e.target.closest('[data-del]') && (await confirmDialog(`Delete the message from ${x.name}?`))) {
      try {
        await remove('messages', x.id);
        messages.splice(messages.indexOf(x), 1);
        count();
        draw();
        toast('Deleted', 'ok');
      } catch (err) { toast(err.message, 'error'); }
    }
  });
}
