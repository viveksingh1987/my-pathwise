"""Deprecated compatibility endpoints."""

import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.core.config import DEFAULT_PLAN_SLUG
from app.services import database as db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["legacy"])


@router.get("/api/state")
def legacy_get_state():
    """Deprecated: returns default plan progress."""
    logger.debug("Legacy GET /api/state")
    return JSONResponse(db.get_progress(DEFAULT_PLAN_SLUG))


@router.put("/api/state")
async def legacy_put_state(req: Request):
    """Deprecated: saves default plan progress."""
    data = await req.json()
    db.save_progress(DEFAULT_PLAN_SLUG, data)
    return {"ok": True}
