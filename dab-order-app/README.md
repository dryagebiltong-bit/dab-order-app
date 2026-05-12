# Dry Age Biltong — Order App

## Deployment Steps

### Step 1 — Supabase (the database)
1. Go to supabase.com → Sign up (free)
2. Click "New Project" → give it a name, set a password, pick a region (Sydney)
3. Wait ~2 minutes for it to spin up
4. Go to SQL Editor (left sidebar) → paste the contents of supabase_setup.sql → click Run
5. Go to Project Settings → API
6. Copy "Project URL" — this is your VITE_SUPABASE_URL
7. Copy "anon public" key — this is your VITE_SUPABASE_ANON_KEY

### Step 2 — GitHub (file storage)
1. Go to github.com → Sign up (free)
2. Click "New repository" → name it "dab-order-app" → click Create
3. Upload all the files from this folder into the repo (drag and drop them in)
   - Make sure to upload the src/ folder with App.jsx and main.jsx inside it

### Step 3 — Vercel (hosting)
1. Go to vercel.com → Sign up with your GitHub account (free)
2. Click "Add New Project" → import your dab-order-app repo
3. Before deploying, click "Environment Variables" and add:
   - Name: VITE_SUPABASE_URL  →  Value: (paste your Supabase Project URL)
   - Name: VITE_SUPABASE_ANON_KEY  →  Value: (paste your Supabase anon key)
4. Click Deploy — Vercel builds and hosts it automatically
5. You'll get a URL like: https://dab-order-app.vercel.app

### Step 4 — WordPress (embed on /order page)
1. In WordPress admin → Pages → Add New
2. Set the slug to "order"
3. Add a Custom HTML block and paste:
   <iframe src="https://your-vercel-url.vercel.app" style="width:100%;height:100vh;border:none;"></iframe>
4. Publish

### Step 5 — Custom domain (optional)
In Vercel → your project → Settings → Domains
Add: order.dryagebiltong.com.au
Then in your DNS (SiteGround), add a CNAME record pointing order → cname.vercel-dns.com

## Staff Board
The staff kanban is at the same URL. Tap "Staff View" at the bottom of the order form.
Bookmark that view on the shop tablet/phone.
