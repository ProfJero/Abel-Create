import { $, $$, projectCard, skeletonCards, emptyState, reveal, params } from '../ui.js';
import { getProjects } from '../store.js';

const grid = $('[data-grid]');
const count = $('[data-count]');
const tabs = $$('[data-filter]');
grid.innerHTML = skeletonCards(6);

const projects = await getProjects();

function render(filter) {
  tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.filter === filter)));
  const list = filter === 'All' ? projects : projects.filter((p) => p.category === filter);
  count.textContent = `${list.length} project${list.length === 1 ? '' : 's'}`;
  grid.innerHTML = list.length
    ? list.map((p, i) => projectCard(p, i)).join('')
    : emptyState('Nothing here yet', 'New projects in this category are on the way.');
  reveal(grid);
}

tabs.forEach((t) =>
  t.addEventListener('click', () => {
    const f = t.dataset.filter;
    const url = new URL(location.href);
    f === 'All' ? url.searchParams.delete('c') : url.searchParams.set('c', f);
    history.replaceState(null, '', url);
    render(f);
  })
);

const initial = params().get('c');
render(tabs.some((t) => t.dataset.filter === initial) ? initial : 'All');
