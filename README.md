# Dry Age Biltong — Order App v2

## What changed from v1
All database access is now server-side only. No credentials are exposed in the browser.
The staff board is protected by a PIN validated on every request server-side.

---

## Deployment Steps

### Step 1 — Supabase
1. supabase.com → sign up free → New Project (pick Sydney)
2. SQL Editor → paste supabase_setup.sql → Run
3. Project Settings → API → copy:
   - "Project URL" → SUPABASE_URL
   - "service_role" key (NOT anon) → SUPABASE_SERVICE_ROLE_KEY

### Step 2 — GitHub
1. github.com → sign up → New repository → "dab-order-app"
2. Upload all files keeping the folder structure:
   - api/ folder with all .js files
   - src/ folder with App.jsx and main.jsx
   - index.html, package.json, vite.config.js, vercel.json at root

### Step 3 — Vercel
1. vercel.com → sign up with GitHub → Add New Project → import dab-order-app
2. Framework Preset: Vite
3. Environment Variables — add all of these:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - STAFF_PIN  (pick any PIN for your staff)
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - TWILIO_PHONE_NUMBER
4. Deploy

### Step 4 — Twilio (SMS)
1. twilio.com → sign up free (~$15 credit included)
2. Get Account SID and Auth Token from dashboard
3. Get a phone number (Twilio gives you one)
4. Add to Vercel environment variables

### Step 5 — WordPress
Create an "Order" page, add Custom HTML block:
<iframe src="https://your-vercel-url.vercel.app" style="width:100%;height:100vh;border:none;"></iframe>

---

## Security model
- No database credentials in browser JavaScript
- Staff PIN validated server-side on every request
- Database uses Row Level Security with no public policies
- All sensitive operations go through Vercel serverless functions
# DAB Website Fix Log

## 2026-08-21 — Mobile checkout: missing email field (FIXED)

**Symptom:** On mobile (≤768px), the billing Email Address field did not appear at checkout, so orders failed validation ("required field"). Desktop was fine.

**Root cause:** A rule in WordPress Customizer → Additional CSS (stored in the database, not in theme files):

```css
@media (max-width: 768px) {
  main p:last-of-type { display: none !important; }
}
```

WooCommerce renders every checkout field as a `<p class="form-row">`. `p:last-of-type` matches the last `<p>` inside *each* container, so on mobile this hid: billing email, shipping phone, order notes, the coupon "Apply" row, the create-account checkbox, and the MailPoet opt-in.

**Fix applied (published live):** selector changed to exclude form rows:

```css
@media (max-width: 768px) {
  main p:last-of-type:not(.form-row) { display: none !important; }
}
```

Location: WP Admin → Appearance → Customize → Additional CSS (theme `dry-age-biltong`). SG cache purged after publishing. Verified on the live checkout page that `#billing_email_field` no longer matches the hiding selector.

**Note:** the local WEBSITE folder / Website.zip backup does not contain this CSS (Customizer CSS lives in the DB), so the backup did not need changing.

---

## 2026-08-24 — Order app: some WooCommerce orders silently never reached the app or sent a text (FIXED, needs redeploy)

**Symptom:** ~5% of orders (2 known cases) placed through the website never appeared in the order-management app and never triggered the customer/staff SMS. No error visible anywhere — WooCommerce showed the order as placed fine, but downstream nothing happened.

**Root cause:** `api/woo-order.js` (the Vercel function the WooCommerce "order.created" webhook calls) had an allow-list filter:

```js
const shippingMethod = (woo.shipping_lines?.[0]?.method_title || '').toLowerCase();
if (!shippingMethod.includes('standard')) {
  return res.status(200).json({ skipped: 'Not a standard shipping order' });
}
```

Any order whose shipping line title didn't contain the word "standard" was skipped *before* the Supabase insert, the customer SMS, or the staff SMS — but the function still returned HTTP 200 to WooCommerce, so WooCommerce logged it as a successful delivery with no retry and no failure flag. Confirmed cause: the missed order shipped "via Weight Based Shipping" instead of "via Standard Shipping" — any shipping method other than the one literally titled "Standard Shipping" was being silently dropped (e.g. Express, Weight Based, or a second shipping zone's flat-rate method that was never renamed).

**Fix (delivered to Chris as an updated `api/woo-order.js`, not yet deployed as of this writing):**
- Replaced the "must contain 'standard'" allow-list with a "must look like Local Pickup" deny-list (`method_id`/`method_title` containing "pickup" or "collect"). Every other shipping method — Standard, Weight Based, Express, or anything added later — is now treated as a normal delivery order.
- Added a safety net: if the Supabase insert itself ever fails, staff now gets a text alert ("came in but could NOT be saved automatically... add it manually") instead of the order failing completely silently.

**To deploy:** replace `api/woo-order.js` in the GitHub repo (`dab-order-app`) with the updated file and let Vercel auto-redeploy, or push directly if Chris has the repo locally.

**Outstanding:** the 2 known missed orders (including the Weight Based Shipping one) were never confirmed as manually re-added to the app — worth checking WooCommerce's order list against the app board to make sure nothing from that period is still missing.
