import { $, $$, params, downloadRow } from '../ui.js';
import { api } from '../api.js';
import { clearCart } from '../cart.js';

const ref = params().get('reference') || params().get('trxref');
const show = (s) => $$('[data-state]').forEach((el) => (el.hidden = el.dataset.state !== s));

async function check(attempt = 0) {
  if (!ref) {
    $('[data-error-msg]').textContent = 'No order reference was found in the link.';
    return show('error');
  }
  show('loading');
  try {
    const order = await api(`/api/order?reference=${encodeURIComponent(ref)}`, { method: 'GET' });
    if (order.status !== 'paid') {
      // Mobile Money approvals can take a little while
      if (attempt < 10) return setTimeout(() => check(attempt + 1), 3000);
      throw new Error('Your payment is still pending. If you approved it on your phone, wait a minute and check again.');
    }
    clearCart();
    $('[data-email]').textContent = order.email;
    $('[data-ref]').textContent = ref;
    $('[data-hours]').textContent = order.hours;
    $('[data-downloads]').innerHTML = order.downloads.map(downloadRow).join('');
    show('paid');
  } catch (err) {
    $('[data-error-msg]').textContent = `${err.message} Your reference is ${ref}.`;
    show('error');
  }
}

$('[data-retry]').addEventListener('click', () => check());
check();
