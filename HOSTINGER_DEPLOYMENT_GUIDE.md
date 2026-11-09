# Hostinger Business Web Hosting — Production Deployment Guide
**Application**: Awesome Adventure Tours / Mahmoud CRM  
**Target Canonical Production Domain**: `https://awesomeadventure.tours`  
**Authoritative Supabase Project**: `cyifhjqqvtiguitrziqs` (`https://cyifhjqqvtiguitrziqs.supabase.co`)  
**Production Runtime**: Node.js 20.x+ LTS (ESM Full-Stack Express + Vite SPA)

---

## 1. Architectural Summary & Fix for "Entry File Not Found"

### Why the Previous Build Failed on Hostinger
1. **Missing Production Server Bundle**: Vite only builds frontend static assets into `dist/`. The backend server `server.ts` was in TypeScript. Node cannot execute TypeScript files natively without transpilation.
2. **Missing Startup File**: Hostinger's Node.js Application Manager looks for a compiled entry file (`server.js` or `app.js`). Because `package.json` had `"start": "node server.ts"` and `"clean": "rm -rf dist server.js"` without a server compilation step, Hostinger halted with `"Entry file not found"`.
3. **The Solution Implemented**:
   - `package.json` build script now compiles both client and server:  
     `"build": "vite build && esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=server.js"`
   - `package.json` start script now points directly to the compiled entry file:  
     `"start": "node server.js"`
   - Production entry file `server.js` serves `dist/` static files, handles `/api/*` endpoints, and routes all SPA navigation to `dist/index.html`.
   - `server.js` listens dynamically on `process.env.PORT || 3000` with graceful SIGTERM/SIGINT shutdown.

---

## 2. Hostinger hPanel Step-by-Step Setup

### Step 2.1: Create / Select the Node.js Application
1. Log in to **Hostinger hPanel** (`hpanel.hostinger.com`).
2. Navigate to **Websites** > select or create domain **`awesomeadventure.tours`**.
3. Under **Advanced** / **Hosting**, open **Node.js** (or search "Node.js" in the top bar).
4. Configure the application runtime:
   - **Node.js version**: Select **Node.js 20.x LTS** (or **Node.js 22.x LTS**).
   - **Application mode**: `Production`.
   - **Application root**: `/` (or `public_html`, matching your repository clone directory).
   - **Application startup file**: `server.js` *(Crucial: must be exactly `server.js`)*.
5. Click **Save Changes**.

---

### Step 2.2: Connect Git Repository or Upload Files
#### Option A: Automatic Git Deployment (Recommended)
1. In hPanel, go to **Advanced** > **Git**.
2. Set Repository URL: `https://github.com/sardeeena/Mahmoud-crm`.
3. Branch: `main`.
4. Install directory: `/` (or root of your website directory).
5. Click **Create** / **Deploy**.

#### Option B: Manual Upload / Deployment
If uploading manually via FTP or File Manager:
1. Ensure all project files are uploaded to the application root.
2. Ensure `.env` is uploaded with production values (see Section 3).

---

### Step 2.3: Install Dependencies & Run Production Build
In Hostinger hPanel via the **Node.js** control screen or **SSH / Terminal**:
1. Run the package installation:
   ```bash
   npm install
   ```
2. Run the unified production build:
   ```bash
   npm run build
   ```
   *Verification*: Check that both `dist/` (client assets) and `server.js` (66 kB Node.js production server) are present in the project directory.

3. Start or Restart the application in hPanel:
   - Click the green **Restart** or **Start** button in the Node.js Application Manager.

---

## 3. Environment Variables Configuration (Hostinger hPanel)

In Hostinger hPanel > **Node.js** > **Environment Variables** (or create a `.env` file in the root):

| Variable Name | Production Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production static asset caching and disables Vite dev middleware |
| `PORT` | `3000` | Port for Express server (Hostinger sets this dynamically if left blank) |
| `APP_URL` | `https://awesomeadventure.tours` | Canonical production domain |
| `VITE_SUPABASE_URL` | `https://cyifhjqqvtiguitrziqs.supabase.co` | Authoritative production Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | *(Your Supabase anon/publishable key)* | Public API key (from Supabase Project Settings > API) |
| `GEMINI_API_KEY` | *(Your Google AI Studio Gemini API key)* | Powers the AI Concierge assistant (`gemini-3.8-flash`) |

> **Security Note**:  
> `SUPABASE_SERVICE_ROLE_KEY` must **NEVER** be added to client environment variables (`VITE_...`) and is never committed to Git. If running administrative CLI scripts like `scripts/setup-admin.ts` via SSH, export `SUPABASE_SERVICE_ROLE_KEY` solely in that terminal session.

---

## 4. Supabase Auth & Redirect URL Configuration

To ensure seamless Google/email authentication and password reset flows on the new domain:

1. Open the [Supabase Dashboard](https://supabase.com/dashboard/project/cyifhjqqvtiguitrziqs).
2. Go to **Authentication** > **URL Configuration**.
3. Set **Site URL**:
   ```
   https://awesomeadventure.tours
   ```
4. In **Redirect URLs**, add:
   ```
   https://awesomeadventure.tours/**
   https://www.awesomeadventure.tours/**
   https://mahmoud-crm-eosin.vercel.app/**
   http://localhost:3000/**
   ```
5. Click **Save**.

---

## 5. Domain DNS & SSL Activation

1. In your domain registrar (Hostinger DNS Zone / Cloudflare / Namecheap):
   - **A Record**: `@` points to your Hostinger server IP address.
   - **CNAME Record**: `www` points to `awesomeadventure.tours`.
2. In Hostinger hPanel:
   - Go to **Security** > **SSL**.
   - Issue a free Let's Encrypt SSL certificate for `awesomeadventure.tours` and `www.awesomeadventure.tours`.
   - Enable **Force HTTPS**.

---

## 6. Verification & Health Check Checklist

After starting the server on Hostinger, verify the live deployment:

- [ ] **Health Endpoint**: Visit `https://awesomeadventure.tours/api/health`  
  *Expected response*: `{"status":"ok","version":"2.4.0","environment":"production",...}`
- [ ] **Frontend Homepage**: Visit `https://awesomeadventure.tours/`  
  *Expected*: Fast load, Hero section, Why Choose Us, Featured Tours, Footer with Egyptian marine licensing details.
- [ ] **Excursion Catalog**: Visit `https://awesomeadventure.tours/excursions`  
  *Expected*: Tour cards display real dynamic prices and destinations.
- [ ] **Booking Flow**: Visit `https://awesomeadventure.tours/booking`  
  *Expected*: Authoritative pricing calculator, guest selector, and pickup selector.
- [ ] **Voucher Lookup**: Visit `https://awesomeadventure.tours/my-booking`  
  *Expected*: Two-factor booking reference + email verification.
- [ ] **Admin Portal**: Visit `https://awesomeadventure.tours/admin`  
  *Expected*: Secure login screen leading to 15 CRM and Operations back-office modules.
- [ ] **AI Concierge**: Click the chat widget on the bottom right and ask: *"Recommend a snorkeling trip for families"*.  
  *Expected*: Live streaming advice powered by Gemini with tour cards.
