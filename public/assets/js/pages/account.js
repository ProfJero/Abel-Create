import { $, $$, esc, isEmail, emptyState, downloadRow, toast } from '../ui.js';
import { auth as loadAuth } from '../firebase.js';
import { api } from '../api.js';
import { money } from '../store.js';

const show = (v) => $$('[data-view]').forEach((el) => (el.hidden = el.dataset.view !== v));
const form = $('[data-link-form]');
const msg = $('[data-msg]', form);
const EMAIL_KEY = 'ac:signin-email';

let auth, m;
try {
  ({ auth, m } = await loadAuth());
} catch (err) {
  console.error(err);
  show('signed-out');
  msg.className = 'mt-3 text-sm text-accent';
  msg.textContent = 'Sign-in is unavailable right now. Please try again later.';
}

if (auth) {
  // Finish an email-link sign-in
  if (m.isSignInWithEmailLink(auth, location.href)) {
    let email = localStorage.getItem(EMAIL_KEY) || prompt('Please confirm your email address');
    try {
      await m.signInWithEmailLink(auth, email, location.href);
      localStorage.removeItem(EMAIL_KEY);
      history.replaceState(null, '', '/account');
    } catch (err) {
      toast('That sign-in link has expired. Please request a new one.', { tone: 'error' });
    }
  }

  m.onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try { form.email.value ||= localStorage.getItem('ac:email') || ''; } catch {}
      return show('signed-out');
    }
    $('[data-user]').textContent = user.email;
    show('signed-in');
    const box = $('[data-orders]');
    box.innerHTML = '<div class="skeleton h-40"></div>';
    try {
      const { orders } = await api('/api/my-orders', { method: 'GET', token: await user.getIdToken() });
      box.innerHTML = orders.length
        ? orders.map((o) => `
          <section class="rounded-[1.5rem] border border-line bg-white p-5 sm:p-6">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <h2 class="font-semibold">${new Date(o.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
              <p class="text-xs text-mute"><span class="font-mono">${esc(o.reference)}</span> · ${money(o.amount)}</p>
            </div>
            <ul class="mt-4 grid gap-3">${o.downloads.map(downloadRow).join('')}</ul>
          </section>`).join('')
        : emptyState('No purchases yet', `We couldn’t find any orders for ${esc(user.email)}. If you used a different email at checkout, sign in with that one.`, '<a href="/shop" class="btn-dark mt-6">Browse the shop</a>');
    } catch (err) {
      box.innerHTML = emptyState('Couldn’t load your downloads', esc(err.message), '<button type="button" onclick="location.reload()" class="btn-dark mt-6">Try again</button>');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!isEmail(email)) {
      form.email.setAttribute('aria-invalid', 'true');
      msg.className = 'mt-3 text-sm text-accent';
      return (msg.textContent = 'Please enter a valid email address.');
    }
    form.email.removeAttribute('aria-invalid');
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      await m.sendSignInLinkToEmail(auth, email, { url: `${location.origin}/account`, handleCodeInApp: true });
      localStorage.setItem(EMAIL_KEY, email);
      msg.className = 'mt-3 text-sm text-emerald-700';
      msg.textContent = `Check ${email} for your sign-in link.`;
    } catch (err) {
      msg.className = 'mt-3 text-sm text-accent';
      msg.textContent = 'Could not send the link. Please try again.';
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });

  $('[data-google]').addEventListener('click', async () => {
    try {
      await m.signInWithPopup(auth, new m.GoogleAuthProvider());
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') toast('Google sign-in failed. Please try again.', { tone: 'error' });
    }
  });

  $('[data-signout]').addEventListener('click', () => m.signOut(auth));
}
