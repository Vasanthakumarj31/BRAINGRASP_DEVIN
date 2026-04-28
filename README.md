# BrainyGRAS — Local run instructions

Quick steps to run the app locally (Windows / macOS / Linux).

**Prerequisites**
- Docker Desktop (for Postgres + pgAdmin)
- Node.js (v16+)

**1) Start the database (Postgres + pgAdmin)**
Open a terminal at the repository root and run:

```bash
docker-compose up -d
```

This starts Postgres on `localhost:5432` and pgAdmin on `http://localhost:5050` (login `admin@admin.com` / `admin`).

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
- Backend: `curl http://localhost:3000/api/products` should return JSON.
- Frontend: open the served local URL and confirm product data loads.

**PowerShell notes (Windows)**
- If you see script execution policy errors when running `npm`/`npx`, run PowerShell with ExecutionPolicy bypass:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "cd backend; npm install"
powershell -NoProfile -ExecutionPolicy Bypass -Command "cd ..; npx serve frontend -l 5500"
```

**Optional: run backend in Docker**
- If you prefer everything in containers, I can add a `Dockerfile` for the backend and update `docker-compose.yml` to build and run it.

---
File references: backend entry is at `backend/server.js` and the compose file is `docker-compose.yml`.
