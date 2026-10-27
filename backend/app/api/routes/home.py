"""Home overview endpoints."""

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services import database as db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["home"])


@router.get("/api/home")
def home_overview():
    """Return all learning domains with progress summary for the home page."""
    logger.debug("Listing plans overview for home")
    return JSONResponse(db.list_plans_overview())
