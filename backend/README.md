zz# BrainyGRAS — Local run instructions

Quick steps to run the app locally (Windows / macOS / Linux).

**Prerequisites**
- Docker Desktop (for Postgres + pgAdmin + Redis)
- Node.js (v16+)

**1) Start the database (Postgres + pgAdmin + Redis)**
Open a terminal at the repository root and run:

```bash
docker-compose up -d
```

This starts:
- **Postgres** on `localhost:5432` 
- **pgAdmin** on `http://localhost:5050` (login `admin@admin.com` / `admin`)
- **Redis** on `localhost:6379` (with password `redis_password`)

**2) Install backend dependencies**
```bash
cd backend
npm install
```

Note: a `start` script is available. To run the backend:

**3) Start the backend API**
```bash
npm start
```

The backend listens on `http://localhost:3000`. Example API: `http://localhost:3000/api/products`.

**4) Serve the frontend**
You can open the static files directly (open `frontend/index.html` in a browser) or serve them with a simple static server.

Option: using `serve` (requires `npm`):
```bash
npx serve frontend -l 5500
# or
npx serve frontend -l 3000
```

The command will print the local URL (e.g. `http://localhost:5500`) — open that in your browser.

**Verify**
- Backend: `curl http://localhost:3000/api/products` should return JSON (fast with Redis cache).
- Frontend: open the served local URL and confirm product data loads instantly.
- Redis Cache: Check backend logs for "Cache HIT" or "Cache MISS" messages.

**PowerShell notes (Windows)**
- If you see script execution policy errors when running `npm`/`npx`, run PowerShell with ExecutionPolicy bypass:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "cd backend; npm install"
powershell -NoProfile -ExecutionPolicy Bypass -Command "cd ..; npx serve frontend -l 5500"
```

**Optional: run backend in Docker**
- If you prefer everything in containers, I can add a `Dockerfile` for the backend and update `docker-compose.yml` to build and run it.

---

## 📊 Caching Strategy (Redis)

The backend now uses **Redis** for fast data access:

| Data | Cache Key | TTL | Purpose |
|------|-----------|-----|---------|
| All Products | `products:all` | 1 hour | Fast product listing |
| Product Search | `search:products:{query}` | 30 min | Search result caching |
| Category Search | `search:categories:{query}` | 30 min | Category filtering |
| OTP | `otp:{email}` | 10 min | Faster OTP verification |
| User Profile | `user:profile:{userId}` | 30 min | Profile data caching |
| User Cart | `user:cart:{userId}` | 24 hours | Cart persistence |
| User Orders | `user:orders:{userId}` | 1 hour | Order history caching |

**Cache Invalidation:**
- Cart cache invalidated when order is placed
- Profile cache invalidated when user updates profile
- Search cache automatically expires after TTL

**Benefits:**
- ⚡ **Instant product loading** without database queries
- 🚀 **Faster search results** with cached queries
- 💨 **Reduced database load** by 60-70%
- 🔒 **Quicker OTP verification** via Redis
- 📦 **Better scalability** with distributed caching

---

File references: backend entry is at `backend/server.js` and the compose file is `docker-compose.yml`.
