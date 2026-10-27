import json, os, time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

STORAGE = os.getenv("STORAGE", "postgres")  # "postgres" or "file"
DATA_FILE = Path(os.getenv("DATA_FILE", "/data/plan.json"))
DSN = os.getenv("DATABASE_URL", "postgresql://roadmap:roadmap@db:5432/roadmap")
EMPTY = {"items": {}, "custom": []}
app = FastAPI()


def pg():
    import psycopg
    return psycopg.connect(DSN, autocommit=True)


@app.on_event("startup")
def init():
    if STORAGE == "file":
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        return
    for _ in range(30):
        try:
            with pg() as c:
                c.execute("CREATE TABLE IF NOT EXISTS state (id int PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz DEFAULT now())")
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError("database not reachable")


@app.get("/api/state")
def get_state():
    if STORAGE == "file":
        return JSONResponse(json.loads(DATA_FILE.read_text()) if DATA_FILE.exists() else EMPTY)
    with pg() as c:
        row = c.execute("SELECT data FROM state WHERE id = 1").fetchone()
    return JSONResponse(row[0] if row else EMPTY)


@app.put("/api/state")
async def put_state(req: Request):
    data = await req.json()
    if STORAGE == "file":
        tmp = DATA_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2))
        tmp.replace(DATA_FILE)
    else:
        with pg() as c:
            c.execute("INSERT INTO state (id, data) VALUES (1, %s::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()", (json.dumps(data),))
    return {"ok": True}


app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")
