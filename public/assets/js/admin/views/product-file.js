// "Download file" panel on the product editor: the ZIP/PSD customers receive.
import { get, uploadProductFile, toDate } from '../data.js';
import { $, esc, fmtDate, toast } from '../kit.js';

const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export async function mountProductFile(panel, slug) {
  panel.innerHTML = `<h2 class="font-display text-lg font-bold">Download file</h2>
    <p class="mt-0.5 text-sm text-mute">The file customers receive after paying. Zip your PSD/AI files, fonts list and guide into one .zip.</p>
    <div data-body class="mt-5"></div>`;
  const body = $('[data-body]', panel);
  if (!slug) {
    body.innerHTML = `<p class="rounded-xl bg-paper px-4 py-3 text-sm text-mute">Create the product first, then upload its file here.</p>`;
    return;
  }

  let record = null;
  try { record = await get('productFiles', slug); } catch {}

  const draw = () => {
    body.innerHTML = `
      ${record ? `<div class="flex items-center gap-4 rounded-xl border border-line px-4 py-3">
        <span class="grid size-11 shrink-0 place-items-center rounded-lg bg-ink text-xs font-bold text-white">${esc((record.filename.split('.').pop() || 'zip').toUpperCase().slice(0, 4))}</span>
        <div class="min-w-0 flex-1"><p class="truncate font-semibold">${esc(record.filename)}</p>
        <p class="text-xs text-mute">${record.size ? size(record.size) : ''}${record.uploadedAt ? ` · uploaded ${fmtDate(toDate(record.uploadedAt), true)}` : ''}</p></div>
        <span class="text-xs font-semibold text-emerald-700">✓ Ready</span></div>`
      : `<p class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No file yet. Customers can’t download this product until you upload one.</p>`}
      <label class="btn-ghost mt-3 cursor-pointer">
        <input type="file" hidden data-input>${record ? 'Replace file' : 'Upload file'}
      </label>
      <div data-progress hidden class="mt-3"><div class="h-2 overflow-hidden rounded-full bg-line"><div class="h-full w-0 rounded-full bg-accent transition-[width]"></div></div>
      <p data-label class="mt-1 text-xs text-mute"></p></div>`;
    $('[data-input]', body).onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const prog = $('[data-progress]', body);
      const fill = prog.querySelector('.bg-accent');
      prog.hidden = false;
      $('[data-label]', body).textContent = `Uploading ${file.name} (${size(file.size)})…`;
      try {
        record = await uploadProductFile(slug, file, (p) => {
          fill.style.width = `${p * 100}%`;
          $('[data-label]', body).textContent = `Uploading ${file.name}: ${Math.round(p * 100)}%`;
        });
        toast('File uploaded', 'ok');
        draw();
      } catch (err) {
        toast(err.message, 'error');
        prog.hidden = true;
      }
    };
  };
  draw();
}
