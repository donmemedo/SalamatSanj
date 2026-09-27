# آپ‌سلامت · UP Iran

A Persian-localized take on Jawbone UP: a band plus an app for sleep, activity and nutrition, a premium plan, and a B2B dashboard for organizations.

- `backend/`: FastAPI with deterministic demo data and in-memory state
- `frontend/`: Next.js 16 + Tailwind 4, fa/en (RTL/LTR), light/dark/auto

## Run

```bash
# Docker
docker compose up --build          # web: http://localhost:3434  api: http://localhost:8434/docs

# Local dev
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/uvicorn main:app --port 8434
cd frontend && npm install && npm run dev   # http://localhost:3434
```

Tests: `cd backend && .venv/bin/pip install pytest && .venv/bin/python -m pytest`

URL overrides: `?lang=en`, `?theme=dark|light|system`. Both are remembered.

For PWA or mobile builds, set `NEXT_PUBLIC_API_URL` to the API origin. The `/api` rewrite only works while Next is serving the app.
