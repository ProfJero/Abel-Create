import { $, $$, productCard, skeletonCards, emptyState, reveal, params } from '../ui.js';
import { getProducts, priceFor } from '../store.js';

const grid = $('[data-grid]');
const count = $('[data-count]');
const tabs = $$('[data-filter]');
const search = $('[data-search]');
const sort = $('[data-sort]');
grid.innerHTML = skeletonCards(8);

const products = await getProducts();
const state = { c: 'All', q: '', sort: 'popular' };

const sorters = {
  popular: (a, b) => (b.popularity || 0) - (a.popularity || 0),
  newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
  'price-asc': (a, b) => priceFor(a) - priceFor(b),
  'price-desc': (a, b) => priceFor(b) - priceFor(a)
};

function sync() {
  const url = new URL(location.href);
  for (const [k, def] of [['c', 'All'], ['q', ''], ['sort', 'popular']]) {
    state[k] && state[k] !== def ? url.searchParams.set(k, state[k]) : url.searchParams.delete(k);
  }
  history.replaceState(null, '', url);
}

function render() {
  tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.filter === state.c)));
  const q = state.q.toLowerCase();
  const list = products
    .filter((p) => state.c === 'All' || p.category === state.c)
    .filter((p) => !q || `${p.title} ${p.category} ${p.summary}`.toLowerCase().includes(q))
    .sort(sorters[state.sort]);
  count.textContent = `${list.length} file${list.length === 1 ? '' : 's'}`;
  grid.innerHTML = list.length
    ? list.map(productCard).join('')
    : emptyState('No files found', 'Try another category or search term.', '<button type="button" data-reset class="btn-dark mt-6">Clear filters</button>');
  reveal(grid);
}

tabs.forEach((t) => t.addEventListener('click', () => { state.c = t.dataset.filter; sync(); render(); }));
let timer;
search.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => { state.q = search.value.trim(); sync(); render(); }, 150);
});
sort.addEventListener('change', () => { state.sort = sort.value; sync(); render(); });
grid.addEventListener('click', (e) => {
  if (!e.target.closest('[data-reset]')) return;
  Object.assign(state, { c: 'All', q: '' });
  search.value = '';
  sync();
  render();
});

const p = params();
if (tabs.some((t) => t.dataset.filter === p.get('c'))) state.c = p.get('c');
if (p.get('q')) search.value = state.q = p.get('q');
if (sorters[p.get('sort')]) sort.value = state.sort = p.get('sort');
render();
