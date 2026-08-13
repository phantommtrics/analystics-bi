# Deploy PrixBI on sandbox-prixbi.phantommetrics.gm

Serve the frontend SPA and API from **one nginx site**:

| URL | Served by |
|-----|-----------|
| `https://sandbox-prixbi.phantommetrics.gm/` | Frontend SPA (static files) |
| `https://sandbox-prixbi.phantommetrics.gm/login` | Frontend SPA |
| `https://sandbox-prixbi.phantommetrics.gm/api/*` | Node backend (port 4000) |
| `https://sandbox-prixbi.phantommetrics.gm/api/health` | Node backend |

The frontend calls `/api/...` with **relative URLs** (same-origin, no separate API host).

---

## 1. Server prerequisites

On the live server:

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx postgresql nodejs npm
sudo mkdir -p /var/www/web-prixbi /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot
sudo chown -R "$USER":www-data /var/www/web-prixbi
```

Ensure DNS: `sandbox-prixbi.phantommetrics.gm` A record → server IP.

---

## 2. Deploy the backend (on the server)

Clone or rsync the repo, then:

```bash
cd /path/to/biReports/backend
cp .env.example .env
# Edit .env for production (see section 4)
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run build
```

Start with PM2 (recommended):

```bash
npm install -g pm2
pm2 start dist/src/server.js --name prixbi-backend
pm2 save
pm2 startup   # follow the printed command to enable on boot
```

Verify:

```bash
curl -s http://127.0.0.1:4000/api/health
# {"ok":true}
```

---

## 3. Build and upload the frontend

**Prefer building on your laptop/CI**, then upload `dist/`. Small live servers often OOM-kill `npm ci && npm run build` (process exits with `Killed`, no Node stack trace).

From your **dev machine** (repo root):

```bash
bash backend/deployment/deploy-frontend.sh user@your-server
```

Or manually:

```bash
cd frontend
npm ci && npm run build    # uses frontend/.env.production; set VITE_API_BASE_URL=/api if needed
rsync -av --delete dist/ user@server:/var/www/web-prixbi/
```

On the server, fix permissions:

```bash
sudo chown -R www-data:www-data /var/www/web-prixbi
sudo find /var/www/web-prixbi -type d -exec chmod 755 {} \;
sudo find /var/www/web-prixbi -type f -exec chmod 644 {} \;
```

---

## 4. Backend environment (on the server)

In `backend/.env`:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/bireports?schema=public"
DATASOURCE_ENCRYPTION_KEY="your-base64-32-byte-key"
JWT_ACCESS_SECRET="your-long-random-secret"
JWT_REFRESH_SECRET="your-other-long-random-secret"

APP_PUBLIC_URL=https://sandbox-prixbi.phantommetrics.gm
CORS_ORIGIN=https://sandbox-prixbi.phantommetrics.gm,http://localhost:5173

# Optional: email, DirectPay, etc.
# RESEND_API_KEY=
# RESEND_FROM="PrixBI <onboarding@yourdomain.com>"
```

Restart backend after changes:

```bash
pm2 restart prixbi-backend --update-env
```

---

## 5. Install nginx config

Copy the combined frontend + API config:

```bash
sudo cp backend/deployment/nginx/sandbox-prixbi.conf /etc/nginx/sites-available/sandbox-prixbi.conf
sudo ln -sf /etc/nginx/sites-available/sandbox-prixbi.conf /etc/nginx/sites-enabled/
```

**If Certbot already added HTTPS**, open the live config and ensure the **443** `server` block uses the same `location` blocks — especially:

- `/api/` → `proxy_pass http://127.0.0.1:4000`
- `/` → `try_files $uri $uri/ /index.html` with `root /var/www/web-prixbi`

Remove any old catch-all like `location / { proxy_pass http://127.0.0.1:4000; }`.

Test and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Issue or renew SSL:

```bash
sudo certbot --nginx -d sandbox-prixbi.phantommetrics.gm
```

See [LETSENCRYPT-NGINX.md](./LETSENCRYPT-NGINX.md) for full SSL setup.

---

## 6. Verify

```bash
# Backend direct
curl -s http://127.0.0.1:4000/api/health

# Through nginx
curl -s -o /dev/null -w "health: %{http_code}\n" https://sandbox-prixbi.phantommetrics.gm/api/health
curl -s -o /dev/null -w "frontend html: %{http_code}\n" https://sandbox-prixbi.phantommetrics.gm/
curl -s -o /dev/null -w "login route: %{http_code}\n" https://sandbox-prixbi.phantommetrics.gm/login
```

Open `https://sandbox-prixbi.phantommetrics.gm/login` in a browser and sign in.

---

## Updating after code changes

**Frontend only:**

```bash
bash backend/deployment/deploy-frontend.sh user@your-server
```

**Backend only** (on server):

```bash
cd /path/to/biReports/backend
git pull   # or rsync updated files
npm ci
npm run prisma:deploy
npm run build
pm2 restart prixbi-backend --update-env
```

No nginx reload needed for static-only frontend updates.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `/login` returns JSON 404 | `location /` still proxies to Node — use SPA `try_files` |
| API calls fail (404/HTML) | Missing or wrong `location /api/` block |
| Blank page, 200 on `/` | Empty `/var/www/web-prixbi` — run build + rsync |
| Mixed content errors | Use HTTPS for both frontend and `APP_PUBLIC_URL` |
| 502 on `/api/` | Node not on 4000 — `pm2 restart prixbi-backend` |
| CORS errors | Add production URL to `CORS_ORIGIN` in backend `.env` |
| Login 500 / `column Role.organizationId does not exist` | Code was deployed without the Prisma migration — run `npm run prisma:deploy` then `pm2 restart prixbi-backend` |
| `npm ci` / `npm run build` exits with `Killed` | Linux OOM — see below |

### `npm …` gets `Killed` on the live server

That is the kernel **out-of-memory killer**, not a normal npm/TypeScript error. Vite + `tsc` + `npm ci` often need **>1–2 GB RAM**; many sandbox VPS have 1 GB or less.

**Confirm:**

```bash
free -h
dmesg -T | tail -50 | grep -i -E 'killed process|out of memory|oom'
```

**Fix (recommended):** build frontend on your machine and rsync (section 3 / `deploy-frontend.sh`). Only run backend `npm ci` / `npm run build` on the server if you have enough RAM or swap.

**If you must build on the server**, add swap first, then cap Node’s heap and skip the extra `tsc` pass for frontend:

```bash
# One-time: 2G swap (survives until reboot; make permanent via /etc/fstab if needed)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
free -h

# Frontend (lighter than npm run build)
cd /path/to/biReports/frontend
NODE_OPTIONS=--max-old-space-size=768 npm ci
NODE_OPTIONS=--max-old-space-size=768 npm run build:prod

# Backend
cd /path/to/biReports/backend
NODE_OPTIONS=--max-old-space-size=768 npm ci
NODE_OPTIONS=--max-old-space-size=768 npm run prisma:generate
NODE_OPTIONS=--max-old-space-size=768 npm run build
```

Also free RAM before building: stop heavy processes temporarily (`pm2 stop prixbi-backend`), then start them again after the build.
