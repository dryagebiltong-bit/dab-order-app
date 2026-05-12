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
