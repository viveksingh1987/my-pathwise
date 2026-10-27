"""Learning tracker API and static SPA host."""

import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import STATIC_DIR
from app.services import database as db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Learning Tracker API", version="2.0.0")

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
def on_startup() -> None:
    """Initialize storage and seed plans."""
    logger.info("Starting learning tracker backend")
    db.init_schema()


static_path = Path(STATIC_DIR)
if static_path.is_dir() and any(static_path.iterdir()):
    app.mount("/", StaticFiles(directory=static_path, html=True), name="static")
    logger.info("Serving frontend from %s", static_path)
else:
    logger.warning(
        "No built frontend at %s — run `npm run build` in frontend/ or use Vite dev server",
        static_path,
    )
