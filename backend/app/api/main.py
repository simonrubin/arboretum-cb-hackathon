"""
Main API router for Arboretum backend
"""
from fastapi import APIRouter

from app.api import websocket, users, trades, opportunities, balances, cdp, unlocks

api_router = APIRouter()

# Include all API routes
api_router.include_router(websocket.router, tags=["websocket"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(trades.router, prefix="/trades", tags=["trades"])
api_router.include_router(opportunities.router, prefix="/opportunities", tags=["opportunities"])
api_router.include_router(balances.router, prefix="/balances", tags=["balances"])
api_router.include_router(cdp.router, prefix="/cdp", tags=["cdp"])
api_router.include_router(unlocks.router, prefix="/unlocks", tags=["unlocks"])