# My Pathwise

Track modules, topics, dates, notes, and study time for any learning plan (AI, DevOps, etc.).

**Stack:** React (Vite + TypeScript) frontend · FastAPI + PostgreSQL backend

## Quick start (Docker)

```bash
docker compose up --build
```

Open http://localhost:8000 — home lists domains; open a plan at `/plan/ai-engineer` (legacy `?plan=ai-engineer` redirects).

## Project layout

```
backend/
  app/
    main.py              # FastAPI app, CORS, static SPA
    api/routes/          # HTTP routes by resource
    core/config.py
    services/database.py # Postgres or file storage
    seed/*.json          # Default curricula
frontend/
  src/
    api/                 # Typed API client
    components/          # UI (home, plan, shared)
    hooks/               # Plan session, theme, toast
    lib/                 # Pure helpers (progress, filters, stats)
    pages/               # Route-level views
    styles/global.css    # Glass UI theme
legacy/                  # Previous single-file HTML (reference)
```

## Local development

**Backend** (port 8000):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql://roadmap:roadmap@127.0.0.1:5432/roadmap
export STORAGE=postgres
uvicorn app.main:app --reload
```

Run Postgres via `docker compose up db` from the repo root.

**Frontend** (port 5173, proxies `/api` to backend):

```bash
cd frontend
npm install
npm run dev
```

## Data model

| Layer | Where |
|--------|--------|
| **Curriculum** | PostgreSQL or `./data/plans/<slug>.json`, seeded from `backend/app/seed/*.json` |
| **Progress** | `plan_progress` or `./data/progress/<slug>.json` |

## API

- `GET /api/home` — domains with progress
- `GET/POST /api/plans` — list / create domain
- `GET /api/plans/{slug}` — curriculum
- `GET/PUT /api/plans/{slug}/progress` — user progress
- `POST /api/plans/{slug}/modules` · `POST/DELETE .../topics`

## File storage mode

Set `STORAGE: file` in `docker-compose.yml`. Data under `./data/`.

## Stop

```bash
docker compose down
```

Add `-v` to remove the Postgres volume.
