# EcoQuest Auth Server (Cookie Session)

Minimal deployable backend for EcoQuest: Express + MySQL (e.g. Aiven) + HttpOnly cookie sessions.

## Layout
- `src/index.js` — server entry and HTTP routes
- `db/schema.sql` — DDL for `users` and `user_sessions`
- `scripts/init-db.js` — database bootstrap script

## Environment variables
Copy `.env.example` to `.env` and set:
- `MYSQL_URL` — MySQL URI (**required**; `DATABASE_URL` is also accepted)
- `SESSION_SECRET` — session signing secret (**required**; must be strong in production)
- `FRONTEND_ORIGINS` — comma-separated browser origins allowed by CORS (recommended)
- `FRONTEND_ORIGIN` — single-origin fallback for backward compatibility

## Run locally (recommended)
1. Install dependencies

```bash
cd server
npm install
```

2. Create tables

```bash
cd server
npm run db:init
```

3. Start the API

```bash
cd server
npm run dev
```

## Frontend integration
In `front.html` you will see something like:
- `apiBase: 'http://localhost:8080'`

Do not open the frontend via `file://` (origin becomes `null` and CORS is awkward). Serve the frontend with a static server (e.g. VS Code Live Server, often `http://localhost:5500`) and set `FRONTEND_ORIGINS` (or `FRONTEND_ORIGIN`) on the server to include that exact origin.

## HTTP API (legacy snippet)
- `POST /api/auth/register` `{ email, password, displayName? }`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/logout` `{}`
- `GET /api/auth/me` → `{ user: {...} | null }`

*(The live ClimateQuest app may expose additional routes in `src/index.js`.)*

## Production notes
### Cookies
- Production defaults to `secure=true` (HTTPS required)
- If **frontend and backend use different domains**, you typically need:
  - `COOKIE_SAMESITE=none`
  - HTTPS (browsers reject `SameSite=None` without secure cookies)
  - CORS: `credentials: true` and frontend origin must be included in `FRONTEND_ORIGINS` (or match `FRONTEND_ORIGIN`)

### Session store
The app prefers MySQL (`user_sessions` via `express-mysql-session`), which suits multi-instance deployments.

## Vercel + Render/Railway + Aiven (example)
### 1) Frontend (Vercel)
Deploy the frontend and note the URL, e.g. `https://your-app.vercel.app`

### 2) Database (Aiven MySQL)
Create a MySQL service and build `MYSQL_URL`, for example:

```text
mysql://USER:PASSWORD@HOST:PORT/DB?ssl={"rejectUnauthorized":true}
```

### 3) Backend (Render or Railway)
Set environment variables such as:
- `NODE_ENV=production`
- `PORT=8080` (many platforms inject `PORT` automatically)
- `FRONTEND_ORIGINS=https://your-app.vercel.app,https://tp26.me,https://www.tp26.me`
- `MYSQL_URL=...` (from Aiven)
- `SESSION_SECRET=...` (long random)
- `COOKIE_SAMESITE=none` (when frontend and backend differ)

After the first deploy, run migrations once in the service shell:
- `npm run db:init`

### Ops: set coins for a user (cloud)
Set **`ADMIN_SECRET`** in Render (long random string; never commit it to the frontend repo). Then call over HTTPS, for example:

```bash
curl.exe -sS -X POST "https://fit5120-climatequest.onrender.com/api/admin/set-coins" -H "Content-Type: application/json" -H "X-Admin-Secret: YOUR_SECRET_HERE" -d "{\"username\":\"edq\",\"coins\":99999000}"
```

On Windows PowerShell, prefer `curl.exe` so it is not aliased to `Invoke-WebRequest`.

Without `ADMIN_SECRET`, the server **does not register** this route. Alternatively use `npm run db:grant-coins` locally with `MYSQL_URL` configured.

### Ops: auto-adjust coins on boot
To force a user's balance every time the service starts (handy after deploys), set:

- `STARTUP_SET_COINS_USERNAME=edq`
- `STARTUP_SET_COINS_VALUE=999999`

On startup the server looks up that user and sets `user_state.coins` to the value (idempotent). Omit both variables to disable.
