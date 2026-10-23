// Plain-language help for running the site day to day.
import { pageHeader } from '../kit.js';

const card = (title, body) => `<section class="rounded-[1.25rem] border border-line bg-white p-5 sm:p-6">
  <h2 class="font-display text-lg font-bold">${title}</h2><div class="mt-3 grid gap-2 text-sm leading-relaxed text-ink/80 [&_code]:rounded [&_code]:bg-paper [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_li]:ml-4 [&_li]:list-disc">${body}</div></section>`;

export default function ({ el }) {
  el.innerHTML = pageHeader('Setup & guide', 'How to run the site day to day.') + `<div class="grid gap-4 lg:grid-cols-2">
    ${card('Add a portfolio project', `<ol class="grid gap-1.5"><li>Go to <strong>Projects → New project</strong>.</li><li>Fill in the title, category and a one-line summary.</li><li>Upload a cover image (landscape) and your final designs.</li><li>Write the brief, process and result. Add the client’s quote if you have one.</li><li>Switch on <strong>Published</strong> (and <strong>Featured</strong> for the home page), then <strong>Create</strong>.</li></ol>`)}
    ${card('Sell a new template', `<ol class="grid gap-1.5"><li><strong>Products → New product</strong>: name, category, summary and price.</li><li>Upload 3 images: preview, mockup, layers close-up.</li><li>Click <strong>Create product</strong>, then upload the <strong>download file</strong> (.zip) in the panel that appears.</li><li>Switch on <strong>Published</strong> and save. It’s live in the shop.</li></ol><p>Set the price to 0 for a free file: visitors get it in exchange for their email.</p>`)}
    ${card('Someone paid you on MoMo directly', `<p>Open <strong>Orders → Give file access</strong>, enter their email, tick the products and the amount they paid. They get download links (by email if it’s set up), and can re-download any time from <em>My account</em>.</p>`)}
    ${card('A customer lost their download', `<p>Find the order in <strong>Orders</strong> (search their email), click it, then <strong>Get download links</strong>. Copy them or send them straight on WhatsApp. Or tell the customer to sign in at <em>/account</em> with the same email.</p>`)}
    ${card('When do changes appear?', `<p>Immediately for you. Other visitors see updates within about 5 minutes (the site caches content for speed).</p><p>Contact details, social links and the About text live in the code (<code>config.js</code> and <code>src/pages</code>): change them there and redeploy.</p>`)}
    ${card('Add another admin', `<p>On your computer, in the project folder, run:</p><p><code>npm run make-admin -- service-account.json their@email.com</code></p><p>Remove access with <code>--remove</code> at the end.</p>`)}
    ${card('Large files (over 95 MB)', `<p>Uploads up to 95 MB go through the Worker. For bigger bundles, create an R2 API token in Cloudflare (R2 → Manage API tokens, “Object Read &amp; Write” on the files bucket), then add <code>R2_ACCOUNT_ID</code>, <code>R2_ACCESS_KEY_ID</code> and <code>R2_SECRET_ACCESS_KEY</code> as Worker secrets and apply <code>worker/r2-cors.json</code>. Full steps are in the README.</p>`)}
    ${card('Good habits', `<ul class="grid gap-1.5"><li>Name images with your name and the project (good for Google).</li><li>Add a new product every 2–4 weeks and keep 1–2 free files.</li><li>Reply to messages within 24 hours.</li><li>Export your subscribers now and then as a backup.</li></ul>`)}
  </div>`;
}
