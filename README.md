# Abel Create: portfolio + shop + admin dashboard

Portfolio and digital-download shop for Abel Create (graphic designer, Ghana).

| Part | Tech | Hosted on |
|---|---|---|
| Website (`public/`) | HTML + Tailwind CSS v4 + vanilla JS | **Cloudflare Pages** → `abel-create.pages.dev` |
| API (`worker/`) | Cloudflare Worker | **Cloudflare Workers** → `abel-create-api.<you>.workers.dev` |
| Admin dashboard | `/admin` on the website | Cloudflare Pages (same site) |
| Content, orders, messages | Firestore | Firebase project `safetrace-247bd` |
| Logins | Firebase Authentication | |
| Payments | Paystack (MoMo + cards, GHS) | |
| Product files | R2 bucket `abel-create-files` (private) | |
| Uploaded images | R2 bucket `abel-create-media` (served at `/media/*` by the Worker) | |

```
public/                       built website (deployed to Pages as-is)
  _headers                    security headers for Pages
  admin/index.html            the dashboard (built from src/pages/admin)
  assets/js/config.js         ← site details + API_URL + Firebase config
  assets/js/admin/            dashboard code
  assets/js/data/seed.js      sample content (fallback + seed source)
src/pages, src/partials       page sources → built into public/
worker/                       the API Worker (deployed separately)
  wrangler.jsonc              ← SITE_URL, ALLOWED_ORIGINS, buckets
  src/                        index (routes), shop, admin, http, firestore, auth
  r2-cors.json                CORS rules for large uploads straight to R2
scripts/                      build, seed, make-admin, placeholder art
firestore.rules               security rules
```

---

## 1. Deploy the API Worker

```bash
npx wrangler login
npx wrangler r2 bucket create abel-create-files
npx wrangler r2 bucket create abel-create-media
npx wrangler secret put PAYSTACK_SECRET_KEY        -c worker/wrangler.jsonc
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   -c worker/wrangler.jsonc   # service-account JSON on one line
npx wrangler secret put DOWNLOAD_SIGNING_KEY       -c worker/wrangler.jsonc   # any long random string
npm run deploy:api
```

Wrangler prints the Worker URL, e.g. `https://abel-create-api.yourname.workers.dev`.

## 2. Deploy the website to Cloudflare Pages

1. Paste the Worker URL into `public/assets/js/config.js`:
   ```js
   const API_URL = 'https://abel-create-api.yourname.workers.dev';
   ```
2. Deploy, either:
   - **From your computer:** `npm run deploy:site` (creates the Pages project `abel-create` on first run), or
   - **From GitHub (auto-deploy on push):** Cloudflare dashboard → Workers & Pages → Create → Pages →
     connect `ProfJero/Abel-Create`. Build command `npm run build`, output directory `public`,
     environment variable `NODE_VERSION = 22`.

Your site is live at `https://abel-create.pages.dev` (the name depends on the project name you choose).

## 3. Connect the two

In `worker/wrangler.jsonc`, make sure these match your Pages address, then `npm run deploy:api` again:

```jsonc
"SITE_URL": "https://abel-create.pages.dev",
"ALLOWED_ORIGINS": "https://abel-create.pages.dev,https://*.abel-create.pages.dev"
```

- `ALLOWED_ORIGINS` is CORS: only these sites may call the API. The `*.` pattern allows Pages
  preview deployments (`abc123.abel-create.pages.dev`). Add your custom domain here when you get one.
- `SITE_URL` is where Paystack sends customers back after paying and what emails link to.
- Firebase → Authentication → Settings → **Authorized domains**: add `abel-create.pages.dev`
  (and your custom domain later), otherwise sign-in on `/admin` and `/account` fails.

Check: open `https://abel-create.pages.dev/admin`, sign in. The Overview's setup panel shows
"API Worker connected ✓".

## 4. Firebase

```bash
firebase deploy --only firestore:rules
```

Firebase console → Authentication → Sign-in method → enable **Email/Password** (with **Email link**
for customers) and **Google**.

## 5. Create your admin account

1. Firebase console → Project settings → Service accounts → **Generate new private key**.
   Save it in this folder as `service-account.json` (it's git-ignored; treat it like a password).
2. Run:
   ```bash
   npm run make-admin -- service-account.json you@email.com
   ```
   If the email has no login yet, you're asked to choose a password (10+ characters) and the
   account is created. Then it's marked as an admin.
3. Sign in at `https://abel-create.pages.dev/admin`.

Remove an admin: `npm run make-admin -- service-account.json them@email.com --remove`.

Without the terminal: create the user in Firebase → Authentication → Users → Add user, copy their
**User UID**, then in Firestore create a collection `admins` with a document whose ID is that UID
(add a field `email`). Signing in to `/admin` with a non-admin account shows the UID to copy.

Admins are stored in `admins/{uid}`. Nobody can add themselves: the rules block all client writes to
that collection, and the Worker checks the same list before any admin action.

## 6. Content

- Optional: load the sample content to start from: `npm run seed -- service-account.json`
  (placeholder projects, products and testimonials: replace them before launch).
- Then manage everything in the dashboard: projects, products (images + download file), testimonials,
  reviews, orders, messages, subscribers.

## Optional extras

**Download emails** (customers receive links by email): create a Resend account, verify your domain,
`npx wrangler secret put RESEND_API_KEY -c worker/wrangler.jsonc`, and set `MAIL_FROM` in
`worker/wrangler.jsonc`.

**Large product files (over 95 MB).** Smaller files upload through the Worker. For bigger bundles,
uploads go straight to R2 with a presigned URL:
1. Cloudflare → R2 → Manage API tokens → Create token with **Object Read & Write** on `abel-create-files`.
2. Add the values as secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
3. Allow the browser to upload: edit the origins in `worker/r2-cors.json`, then
   `npx wrangler r2 bucket cors set abel-create-files --file worker/r2-cors.json`.

**Paystack webhook:** Paystack dashboard → Settings → API Keys & Webhooks →
`https://abel-create-api.yourname.workers.dev/api/paystack/webhook`.

---

## Develop locally

```bash
npm install
cp worker/.dev.vars.example worker/.dev.vars   # fill in
npm run dev        # site on http://localhost:8788, API on http://localhost:8787
```

On localhost the site automatically calls the local API.

**Fully offline testing with Firebase emulators** (doesn't touch live data):

```bash
firebase emulators:start --only auth,firestore
```

In `worker/.dev.vars` set `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`. In the browser console on localhost run
`localStorage.setItem('ac:emulators','1')` and reload. Seed and create an admin against the emulators
by prefixing the commands with the same two variables. Never set these variables on the deployed Worker.

## How a purchase works

1. The cart sends product slugs + licence to `POST /api/checkout`. The Worker reads prices from
   Firestore (never trusts the browser), creates `orders/{reference}` and starts a Paystack payment.
2. The Paystack popup takes MoMo/card payment, then `/success` calls `GET /api/order`, which verifies
   with Paystack, checks the amount and currency, and marks the order paid exactly once. The webhook
   does the same in the background.
3. Download links are HMAC-signed, expire after `DOWNLOAD_HOURS`, and stream from the private R2
   bucket. Customers can get fresh links at `/account`; you can too, from Orders in the dashboard.
