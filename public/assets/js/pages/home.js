import { $, esc, projectCard, productCard, skeletonCards, reveal } from '../ui.js';
import { getProjects, getProducts, getTestimonials } from '../store.js';

const featured = $('[data-featured]');
const shop = $('[data-shop-preview]');
const quotes = $('[data-testimonials]');

featured.innerHTML = skeletonCards(6);
shop.innerHTML = skeletonCards(4);

getProjects().then((all) => {
  const list = all.filter((p) => p.featured).slice(0, 6);
  featured.innerHTML = (list.length ? list : all.slice(0, 6)).map((p, i) => projectCard(p, i)).join('');
  reveal(featured);
});

getProducts().then((all) => {
  const list = all.filter((p) => !p.free).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 4);
  shop.innerHTML = list.map(productCard).join('');
  reveal(shop);
});

getTestimonials().then((list) => {
  if (!list.length) return quotes.closest('section').remove();
  quotes.innerHTML = list.slice(0, 3).map((t, i) => `
    <figure class="reveal flex flex-col justify-between rounded-xl2 border border-line bg-white p-7" style="--d:${i * 90}ms">
      <svg class="size-8 text-accent" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.6 6C6.5 7.3 4.5 10 4.5 13.6V18h6v-6h-3c0-2 1.2-3.6 3.2-4.4L9.6 6Zm9 0c-3.1 1.3-5.1 4-5.1 7.6V18h6v-6h-3c0-2 1.2-3.6 3.2-4.4L18.6 6Z"/></svg>
      <blockquote class="mt-5 text-lg leading-relaxed">${esc(t.quote)}</blockquote>
      <figcaption class="mt-6 border-t border-line pt-4 text-sm"><span class="font-semibold">${esc(t.name)}</span><span class="text-mute"> · ${esc(t.company || '')}</span></figcaption>
    </figure>`).join('');
  reveal(quotes);
});
