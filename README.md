# آپ‌سلامت · UP Iran

A Persian-localized take on Jawbone UP: a band plus an app for sleep, activity and nutrition, a premium plan, and a B2B dashboard for organizations.

- `backend/`: FastAPI with deterministic demo data and in-memory state
- `frontend/`: Next.js 16 + Tailwind 4, fa/en (RTL/LTR), light/dark/auto

> **Demo only.** There are no accounts: every visitor shares one in-memory user. Add authentication and per-user storage before any real health data goes in. See [`security/REPORT.md`](security/REPORT.md).

## Run

```bash
# Docker: web at http://localhost:3434. The API is not published; the web app reaches it on the compose network.
docker compose up --build

# Local dev (both bound to loopback)
cd backend && python3 -m venv .venv && .venv/bin/pip install --require-hashes -r requirements.txt \
  && .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8434
cd frontend && npm ci && npm run dev   # http://localhost:3434
```

Tests and scanners:

```bash
cd backend && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/python -m pytest -q && .venv/bin/bandit -q -r main.py
```

URL overrides: `?lang=en`, `?theme=dark|light|system`. Both are remembered.

## Configuration

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `ALLOWED_HOSTS` | frontend | `localhost,127.0.0.1` | Host names the web app answers to. Add your LAN IP or domain to open it from other devices. |
| `ALLOWED_HOSTS` | backend | `localhost,127.0.0.1,backend` | Host names the API answers to. |
| `ALLOWED_ORIGINS` | backend | empty (no CORS) | Origins allowed to call the API cross-origin, for `NEXT_PUBLIC_API_URL` builds. |
| `ENABLE_DOCS` | backend | unset | Set to `1` to serve `/docs` and `/openapi.json`. |
| `BACKEND_URL` | frontend build | `http://localhost:8434` | Where the `/api` rewrite points. |
| `NEXT_PUBLIC_API_URL` | frontend build | empty (same origin) | API origin for PWA or mobile builds. The `/api` rewrite only works while Next serves the app. |

Regenerate the pinned, hashed backend requirements with `uv pip compile requirements.in --generate-hashes --no-annotate -o requirements.txt`.
