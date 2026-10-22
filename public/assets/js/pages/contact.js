import { $, params, isEmail } from '../ui.js';
import { addRecord } from '../firebase.js';

const form = $('[data-contact]');
const error = $('[data-error]');

// Pre-select a service from links like /contact?service=Logo%20design
const pre = params().get('service');
if (pre && [...form.service.options].some((o) => o.value === pre)) form.service.value = pre;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (form.company.value) return;
  const data = Object.fromEntries(new FormData(form));
  const invalid = [];
  if (!data.name.trim()) invalid.push(form.elements.namedItem('name'));
  if (!isEmail(data.email)) invalid.push(form.email);
  if (!data.service) invalid.push(form.service);
  if (data.message.trim().length < 10) invalid.push(form.message);
  [...form.elements].forEach((el) => el.removeAttribute?.('aria-invalid'));
  if (invalid.length) {
    invalid.forEach((el) => el.setAttribute('aria-invalid', 'true'));
    invalid[0].focus();
    error.textContent = 'Please fill in your name, a valid email, the service and a short message.';
    return error.classList.remove('hidden');
  }
  error.classList.add('hidden');
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    await addRecord('messages', {
      name: data.name.trim().slice(0, 120),
      email: data.email.trim().toLowerCase().slice(0, 200),
      service: data.service.slice(0, 80),
      budget: (data.budget || '').slice(0, 80),
      message: data.message.trim().slice(0, 5000)
    });
    form.hidden = true;
    $('[data-sent]').hidden = false;
  } catch (err) {
    console.error(err);
    error.textContent = 'Your message could not be sent. Please try WhatsApp or email instead.';
    error.classList.remove('hidden');
    btn.disabled = false;
    btn.innerHTML = 'Send message <span class="arrow">→</span>';
  }
});
