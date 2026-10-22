# Abel Create: portfolio + shop

Portfolio and digital-download shop for Abel Create (graphic designer, Ghana).

- **Frontend:** static HTML pages + Tailwind CSS v4 + vanilla JS modules (no framework)
- **Data:** Firestore (projects, products, testimonials, contact messages, subscribers, orders)
- **Server code:** one Cloudflare Worker (`src/worker`) for checkout, Paystack, downloads
- **Payments:** Paystack (MTN MoMo, Telecel Cash, AT Money, Visa, Mastercard) in GHS
- **Files:** private Cloudflare R2 bucket, served only through signed links that expire
- **Hosting:** the same Worker serves the static site (Workers Static Assets)

```
public/                 built site (deployed as-is)
  assets/js/config.js   ← site details, contact info, socials, Firebase config
  assets/js/data/seed.js← sample projects/products (fallback + seed source)
  assets/img/           photos, logos, generated placeholder art
src/pages/              page sources (built into public/ with header/footer)
src/partials/           header, footer, overlays (menu, cart drawer)
src/styles/app.css      Tailwind theme and components
src/worker/             Cloudflare Worker API
scripts/                build, placeholder art, Firestore seeding
firestore.rules         security rules
```

## Develop

```bash
npm install
npm run dev        # builds, watches HTML + CSS, runs wrangler dev on :8787
```

Edit pages in `src/pages`, never in `public/*.html` (those are generated).

## Pages

Home · Work (filters) · Case study · Shop (filters, sort, search) · Product (licence
choice, gallery, related, bundle offer) · Cart/checkout · Thank-you/downloads ·
My account (passwordless email link or Google) · About · Services · Contact ·
Privacy · Terms · Licence · Refunds · 404.

## Before launch

1. **Your details** in `public/assets/js/config.js`: full name (`owner`), email, phone,
   WhatsApp, socials, domain. Also `SITE_URL` in `wrangler.jsonc`, and the domain in
   `public/robots.txt` and `public/sitemap.xml`. Then `npm run build`.
2. **Firebase project.** The config you provided points to the project
   `safetrace-247bd`. If that belongs to another app, create a new Firebase project
   for this site and paste its config into `config.js` and `FIREBASE_PROJECT_ID` in
   `wrangler.jsonc`.
   - Enable **Firestore** and deploy the rules: `npx firebase-tools deploy --only firestore`
   - Enable **Authentication → Email link (passwordless)** and **Google**; add your
     domain under *Authorized domains*.
3. **Real content.** Replace the sample projects, products and testimonials in
   `seed.js` (they are placeholders, including the client names, results and
   quotes), put real images in `public/assets/img/work` and `/products`, then seed:
   ```bash
   node scripts/seed-firestore.mjs path/to/service-account.json
   ```
   After that, edit content directly in the Firestore console (set `published: true`).
4. **CV:** add `public/assets/files/abel-create-cv.pdf`. On the About page, fill in the
   education entry and check the experience entries.
5. **Prices** on the Services page are suggestions; edit `src/pages/services.html`.
6. **Cloudflare:**
   ```bash
   npx wrangler login
   npx wrangler r2 bucket create abel-create-files
   npx wrangler r2 object put abel-create-files/church-flyer-pack.zip --file=./files/church-flyer-pack.zip --remote
   npx wrangler secret put PAYSTACK_SECRET_KEY
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   # paste the JSON on one line
   npx wrangler secret put DOWNLOAD_SIGNING_KEY       # any long random string
   npx wrangler secret put RESEND_API_KEY             # optional: emails download links
   npm run deploy
   ```
   Each product's file lives in R2 as `<slug>.zip` (or set `key` in `productFiles/<slug>`).
7. **Paystack dashboard → Settings → API Keys & Webhooks:** webhook URL
   `https://YOUR-DOMAIN/api/paystack/webhook`. Test with `sk_test_…`, then switch to live.
8. Make a real test purchase on phone and laptop, then submit the sitemap in Google
   Search Console.

## How a purchase works

1. Cart sends product slugs + licence to `POST /api/checkout`. The Worker reads prices
   from Firestore (never trusts the browser), creates `orders/{reference}` and starts a
   Paystack transaction.
2. Paystack popup (or redirect) takes MoMo/card payment.
3. `/success` calls `GET /api/order`, which verifies with Paystack, checks the amount
   and currency, marks the order paid once, and returns download links. The webhook
   does the same in the background, so payment is recorded even if the tab closes.
4. Links are HMAC-signed and expire after `DOWNLOAD_HOURS`. Customers sign in at
   `/account` with the same email to get fresh links.
