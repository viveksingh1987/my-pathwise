"""Aggregate API routers."""

from fastapi import APIRouter

from app.api.routes import home, legacy, plans

api_router = APIRouter()
api_router.include_router(home.router)
api_router.include_router(plans.router)
api_router.include_router(legacy.router)
