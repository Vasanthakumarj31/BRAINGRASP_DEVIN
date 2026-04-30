# Commands to run BrainyGrasp (recorded run)

All commands executed from repository root: C:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN

1) Start Postgres and pgAdmin (docker-compose)

```bash
docker-compose -f "c:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN\docker-compose.yml" up -d
```

2) Install backend dependencies (use cmd to avoid PowerShell execution-policy issues)

```cmd
cmd /c "cd /d C:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN\backend && npm install"
```

3) Start backend server

```cmd
cmd /c "cd /d C:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN\backend && npm start"
```

4) Quick API check

```bash
curl http://localhost:3000/api/products
```

Useful helpers (stop, logs, open UI):

```bash
# Stop docker services
docker-compose -f "c:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN\docker-compose.yml" down

# View PostgreSQL logs
docker logs brainygras_postgres -f

# View pgAdmin UI: http://localhost:5050 (login admin@admin.com / admin)

# If you used npm start in a terminal, stop backend with Ctrl+C in that terminal.

# Serve frontend locally (optional):
# If you have npx http-server:
npx http-server "c:\Users\vasan\OneDrive\Desktop\G_GRASP\BRAINGRASP_DEVIN\frontend" -p 5500
```

Notes:
- Backend listens on http://localhost:3000 and connects to Postgres at localhost:5432 using user `postgres` / password `password`.
- The docker-compose file creates a volume `postgres_data` to persist DB data.
