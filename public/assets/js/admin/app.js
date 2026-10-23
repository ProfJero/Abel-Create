// Admin dashboard entry: sign-in gate, sidebar, hash router.
import { auth } from '../firebase.js';
import { get } from './data.js';
import { $, $$, esc, toast, copy, spinner } from './kit.js';
import { state } from './state.js';

const screens = (name) => $$('[data-screen]').forEach((s) => (s.hidden = s.dataset.screen !== name));
const view = $('[data-view]');

const NAV = [
  { path: '', label: 'Overview', icon: '<path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z"/>' },
  { group: 'Content' },
  { path: 'projects', label: 'Projects', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/>' },
  { path: 'products', label: 'Products', icon: '<path d="M5 7h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 7Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>' },
  { path: 'testimonials', label: 'Testimonials', icon: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>' },
  { path: 'reviews', label: 'Product reviews', icon: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>' },
  { group: 'Business' },
  { path: 'orders', label: 'Orders', icon: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>' },
  { path: 'messages', label: 'Messages', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', badge: 'messages' },
  { path: 'subscribers', label: 'Subscribers', icon: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 11h6M20 8v6"/>' },
  { group: 'Help' },
  { path: 'guide', label: 'Setup & guide', icon: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>' }
];

const VIEWS = {
  '': () => import('./views/overview.js'),
  projects: () => import('./views/resources.js'),
  products: () => import('./views/resources.js'),
  testimonials: () => import('./views/resources.js'),
  reviews: () => import('./views/resources.js'),
  orders: () => import('./views/orders.js'),
  messages: () => import('./views/messages.js'),
  subscribers: () => import('./views/subscribers.js'),
  guide: () => import('./views/guide.js')
};

// ---------- Sidebar ----------

function renderNav(active) {
  $('[data-nav]').innerHTML = NAV.map((n) => n.group
    ? `<p class="mt-5 mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-mute/80">${n.group}</p>`
    : `<a href="#/${n.path}" class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${active === n.path ? 'bg-ink text-white' : 'text-ink/75 hover:bg-paper hover:text-ink'}" ${active === n.path ? 'aria-current="page"' : ''}>
        <svg class="size-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${n.icon}</svg>
        <span class="flex-1">${n.label}</span>
        ${n.badge === 'messages' && state.unread ? `<span class="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">${state.unread}</span>` : ''}
      </a>`).join('');
  $('[data-mobile-title]').textContent = NAV.find((n) => n.path === active)?.label || 'Dashboard';
}

addEventListener('admin:unread', () => renderNav(currentSection()));

const sidebar = $('[data-sidebar]');
const backdrop = $('[data-backdrop]');
const openNav = () => { sidebar.setAttribute('data-open', ''); backdrop.hidden = false; };
const closeNav = () => { sidebar.removeAttribute('data-open'); backdrop.hidden = true; };
$('[data-nav-open]').onclick = openNav;
$('[data-nav-close]').onclick = closeNav;
backdrop.onclick = closeNav;

// ---------- Router ----------

const parts = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
const currentSection = () => parts()[0] || '';
let renderId = 0;
let lastHash = location.hash;

async function render() {
  const [section = '', ...rest] = parts();
  const id = ++renderId;
  closeNav();
  renderNav(section);
  if (!VIEWS[section]) return (location.hash = '#/');
  view.innerHTML = spinner;
  window.scrollTo(0, 0);
  try {
    const mod = await VIEWS[section]();
    if (id !== renderId) return;
    view.innerHTML = '';
    await mod.default({ el: view, section, params: rest });
  } catch (err) {
    console.error(err);
    if (id === renderId) view.innerHTML = `<div class="rounded-[1.25rem] border border-accent/20 bg-accent-50 p-6 text-accent-600"><p class="font-semibold">Something went wrong</p><p class="mt-1 text-sm">${esc(err.message)}</p></div>`;
  }
}

addEventListener('hashchange', () => {
  if (state.leaveGuard && !state.leaveGuard()) {
    history.replaceState(null, '', lastHash); // stay on the unsaved form
    return;
  }
  state.leaveGuard = null;
  lastHash = location.hash;
  render();
});
addEventListener('beforeunload', (e) => {
  if (state.leaveGuard && !state.leaveGuard(true)) e.preventDefault();
});

// ---------- Auth ----------

const { auth: a, m } = await auth();
const loginForm = $('[data-login]');
const loginError = $('[data-login-error]');
const showLoginError = (msg) => { loginError.textContent = msg; loginError.classList.toggle('hidden', !msg); };
const friendly = (code) => ({
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes or reset your password.',
  'auth/network-request-failed': 'No connection. Check your internet and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase Authentication.'
})[code] || 'Could not sign in. Please try again.';

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoginError('');
  const btn = loginForm.querySelector('button:not([type=button])');
  btn.disabled = true;
  try {
    await m.signInWithEmailAndPassword(a, loginForm.email.value.trim(), loginForm.password.value);
  } catch (err) {
    showLoginError(friendly(err.code));
  } finally {
    btn.disabled = false;
  }
});
$('[data-forgot]').onclick = async () => {
  const email = loginForm.email.value.trim();
  if (!email) return showLoginError('Enter your email above, then click “Forgot password?” again.');
  try {
    await m.sendPasswordResetEmail(a, email);
    toast('Password reset email sent', 'ok');
  } catch (err) {
    showLoginError(friendly(err.code));
  }
};
$('[data-google]').onclick = () => m.signInWithPopup(a, new m.GoogleAuthProvider()).catch((err) => err.code !== 'auth/popup-closed-by-user' && showLoginError(friendly(err.code)));
$$('[data-signout]').forEach((b) => (b.onclick = () => m.signOut(a)));
$('[data-copy-uid]').onclick = (e) => copy(e.currentTarget.textContent, 'User ID copied');

m.onAuthStateChanged(a, async (user) => {
  state.user = user;
  if (!user) return screens('login');
  screens('boot');
  let isAdmin = false;
  try { isAdmin = Boolean(await get('admins', user.uid)); } catch { isAdmin = false; }
  if (!isAdmin) {
    $('[data-denied-email]').textContent = user.email || user.uid;
    $('[data-copy-uid]').textContent = user.uid;
    return screens('denied');
  }
  $('[data-user-email]').textContent = user.email;
  $('[data-avatar]').textContent = (user.email || '?')[0].toUpperCase();
  screens('app');
  render();
  import('./views/messages.js').then((mod) => mod.refreshUnread()).catch(() => {});
});
