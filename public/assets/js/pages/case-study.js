import { $, esc, params, reveal, emptyState } from '../ui.js';
import { getProjects } from '../store.js';

const root = $('[data-case]');
const slug = params().get('p');
const projects = await getProjects();
const i = projects.findIndex((p) => p.slug === slug);
const p = projects[i];

if (!p) {
  root.innerHTML = `<div class="wrap grid pt-16">${emptyState('Project not found', 'It may have been moved or renamed.', '<a href="/work" class="btn-dark mt-6">See all work</a>')}</div>`;
} else {
  const next = projects[(i + 1) % projects.length];
  document.title = `${p.title}: ${p.category} | Abel Create`;
  $('meta[name="description"]')?.setAttribute('content', `${p.title}: ${p.subtitle}. ${p.category} case study by Abel Create.`);

  const meta = [['Client', p.client], ['Year', p.year], ['Role', p.role], ['Category', p.category]].filter(([, v]) => v);
  const alt = (what) => `${p.title} ${what}, ${p.category.toLowerCase()} design by Abel Create`;
  const steps = Array.isArray(p.process) ? p.process : p.process ? [p.process] : [];

  root.innerHTML = `
  <header class="wrap pt-8 sm:pt-12">
    <a href="/work" class="reveal inline-flex items-center gap-2 text-sm font-medium text-mute hover:text-ink">← All work</a>
    <p class="eyebrow reveal mt-8">${esc(p.category)}</p>
    <h1 class="h-display reveal mt-4 text-[clamp(3rem,9vw,7.5rem)]">${esc(p.title)}</h1>
    <p class="reveal mt-4 max-w-2xl text-xl text-ink/70">${esc(p.subtitle || '')}</p>
    <dl class="reveal mt-10 grid grid-cols-2 gap-6 border-t border-line pt-6 md:grid-cols-4">
      ${meta.map(([k, v]) => `<div><dt class="text-xs font-semibold uppercase tracking-[0.16em] text-mute">${k}</dt><dd class="mt-1.5 font-medium">${esc(v)}</dd></div>`).join('')}
    </dl>
  </header>

  <div class="wrap mt-10 sm:mt-14">
    <img src="${esc(p.cover)}" alt="${esc(alt('cover'))}" width="1200" height="900" class="reveal aspect-[4/3] w-full rounded-[1.75rem] object-cover sm:aspect-[16/9]">
  </div>

  <section class="wrap section grid gap-8 lg:grid-cols-12">
    <h2 class="reveal font-display text-3xl font-bold lg:col-span-4">The brief</h2>
    <p class="reveal text-xl leading-relaxed text-ink/80 sm:text-2xl lg:col-span-8">${esc(p.brief || '')}</p>
  </section>

  ${steps.length ? `
  <section class="border-y border-line bg-white">
    <div class="wrap section grid gap-12 lg:grid-cols-12">
      <div class="lg:col-span-4">
        <h2 class="reveal font-display text-3xl font-bold">Process</h2>
        <p class="reveal mt-3 text-mute">From sketches to the final system.</p>
      </div>
      <div class="lg:col-span-8">
        <ol class="grid gap-6">
          ${steps.map((s, n) => `<li class="reveal flex gap-5" style="--d:${n * 80}ms"><span class="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-display text-sm font-bold text-white">${String(n + 1).padStart(2, '0')}</span><p class="pt-1.5 text-lg leading-relaxed text-ink/80">${esc(s)}</p></li>`).join('')}
        </ol>
        ${p.sketch ? `<img src="${esc(p.sketch)}" alt="${esc(alt('sketches and early concepts'))}" loading="lazy" class="reveal mt-12 w-full rounded-xl2 border border-line">` : ''}
        <div class="mt-12 grid gap-8 sm:grid-cols-2">
          ${p.palette?.length ? `<div class="reveal"><h3 class="text-xs font-semibold uppercase tracking-[0.16em] text-mute">Colour palette</h3>
            <div class="mt-4 grid grid-cols-4 gap-2">${p.palette.map((c) => `<div><div class="aspect-square rounded-xl border border-ink/10" style="background:${esc(c)}"></div><p class="mt-1.5 font-mono text-[11px] text-mute">${esc(c)}</p></div>`).join('')}</div></div>` : ''}
          ${p.fonts?.length ? `<div class="reveal"><h3 class="text-xs font-semibold uppercase tracking-[0.16em] text-mute">Typography</h3>
            <div class="mt-4 grid gap-3">${p.fonts.map((f, n) => `<div class="flex items-baseline justify-between rounded-xl border border-line px-4 py-3"><span class="${n ? 'font-sans' : 'font-display font-bold'} text-2xl">Aa</span><span class="text-sm text-mute">${esc(f)}</span></div>`).join('')}</div></div>` : ''}
        </div>
      </div>
    </div>
  </section>` : ''}

  <section class="wrap section">
    <h2 class="reveal font-display text-3xl font-bold">Final designs</h2>
    <div class="mt-10 grid gap-6">
      ${p.images.map((src, n) => `<img src="${esc(src)}" alt="${esc(alt(`final design ${n + 1}`))}" loading="lazy" class="reveal w-full rounded-[1.75rem] bg-line">`).join('')}
    </div>
  </section>

  ${p.result || p.testimonial ? `
  <section class="wrap">
    <div class="reveal grid gap-10 rounded-[1.75rem] bg-ink p-8 text-white sm:p-12 lg:grid-cols-2 lg:p-16">
      <div>
        <p class="eyebrow text-white/50">The result</p>
        <p class="mt-5 font-display text-3xl leading-tight font-bold sm:text-4xl">${esc(p.result || '')}</p>
      </div>
      ${p.testimonial ? `<figure class="self-end border-t border-white/15 pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
        <blockquote class="text-xl leading-relaxed text-white/85">“${esc(p.testimonial.quote)}”</blockquote>
        <figcaption class="mt-4 text-sm text-white/50">${esc(p.testimonial.name)}</figcaption></figure>` : ''}
    </div>
  </section>` : ''}

  <nav aria-label="Next project" class="wrap mt-20 grid gap-4 sm:mt-28 md:grid-cols-[1fr_auto]">
    <a href="/case-study?p=${encodeURIComponent(next.slug)}" class="group reveal flex min-w-0 items-center gap-4 rounded-xl2 border border-line bg-white p-3 pr-5 transition hover:border-ink/30 sm:gap-5 sm:p-4 sm:pr-6">
      <img src="${esc(next.cover)}" alt="" class="aspect-[4/3] w-24 shrink-0 rounded-xl object-cover sm:w-40">
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-mute">Next project</p>
        <p class="mt-1 truncate font-display text-xl font-bold sm:text-3xl">${esc(next.title)}</p>
      </div>
      <span class="text-2xl transition group-hover:translate-x-1">→</span>
    </a>
    <a href="/contact" class="btn-primary reveal md:h-full md:px-10">Start a project like this</a>
  </nav>`;
  reveal(root);
}
