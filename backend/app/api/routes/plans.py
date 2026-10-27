"""Plan curriculum and progress endpoints."""

import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from app.services import database as db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["plans"])


@router.get("/api/plans")
def list_plans():
    """List available learning plans."""
    return JSONResponse(db.list_plans())


@router.post("/api/plans")
async def create_plan(req: Request):
    """Create a new learning domain."""
    body = await req.json()
    try:
        plan = db.create_plan(body)
    except ValueError as exc:
        logger.warning("Create plan rejected: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JSONResponse(plan, status_code=201)


@router.delete("/api/plans/{slug}")
def remove_plan(slug: str):
    """Delete a learning domain and its progress."""
    if not db.delete_plan(slug):
        raise HTTPException(status_code=404, detail="plan not found")
    logger.info("Deleted plan slug=%s", slug)
    return {"ok": True}


@router.get("/api/plans/{slug}")
def get_plan(slug: str):
    """Return full curriculum for a plan."""
    plan = db.get_plan(slug)
    if not plan:
        raise HTTPException(status_code=404, detail="plan not found")
    return JSONResponse(plan)


@router.get("/api/plans/{slug}/progress")
def get_progress(slug: str):
    """Return user progress for a plan."""
    if not db.get_plan(slug):
        raise HTTPException(status_code=404, detail="plan not found")
    return JSONResponse(db.get_progress(slug))


@router.put("/api/plans/{slug}/progress")
async def put_progress(slug: str, req: Request):
    """Save user progress for a plan."""
    if not db.get_plan(slug):
        raise HTTPException(status_code=404, detail="plan not found")
    data = await req.json()
    db.save_progress(slug, data)
    logger.info("Saved progress for plan slug=%s", slug)
    return {"ok": True}


@router.post("/api/plans/{slug}/modules")
async def create_module(slug: str, req: Request):
    """Add a section (module) to a plan."""
    body = await req.json()
    try:
        module = db.add_module(slug, body)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JSONResponse(module, status_code=201)


@router.post("/api/plans/{slug}/topics")
async def create_topic(slug: str, req: Request):
    """Add a topic to a module."""
    body = await req.json()
    module_id = body.get("module_id")
    if not module_id:
        raise HTTPException(status_code=400, detail="module_id is required")
    try:
        topic = db.add_topic(slug, module_id, body)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JSONResponse(topic, status_code=201)


@router.delete("/api/plans/{slug}/topics/{topic_id}")
def remove_topic(slug: str, topic_id: str):
    """Delete a topic from a plan."""
    if not db.delete_topic(slug, topic_id):
        raise HTTPException(status_code=404, detail="topic not found")
    logger.info("Deleted topic id=%s from slug=%s", topic_id, slug)
    return {"ok": True}
