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
sudo mkdir -p /var/www/prixbi /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot
sudo chown -R "$USER":www-data /var/www/prixbi
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

From your dev machine (repo root):

```bash
bash backend/deployment/deploy-frontend.sh user@your-server
```

Or manually:

```bash
cd frontend
npm ci
npm run build    # uses frontend/.env.production → VITE_API_BASE_URL=/api
rsync -av --delete dist/ user@server:/var/www/prixbi/
```

On the server, fix permissions:

```bash
sudo chown -R www-data:www-data /var/www/prixbi
sudo find /var/www/prixbi -type d -exec chmod 755 {} \;
sudo find /var/www/prixbi -type f -exec chmod 644 {} \;
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
- `/` → `try_files $uri $uri/ /index.html` with `root /var/www/prixbi`

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
| Blank page, 200 on `/` | Empty `/var/www/prixbi` — run build + rsync |
| Mixed content errors | Use HTTPS for both frontend and `APP_PUBLIC_URL` |
| 502 on `/api/` | Node not on 4000 — `pm2 restart prixbi-backend` |
| CORS errors | Add production URL to `CORS_ORIGIN` in backend `.env` |
