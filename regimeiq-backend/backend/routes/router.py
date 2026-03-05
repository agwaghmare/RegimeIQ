from fastapi import APIRouter

from .health_routes import router as health_router
from .market_routes import router as market_router
from .macro_routes import router as macro_router
from .signals_routes import router as signals_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(market_router, prefix="/market", tags=["market"])
api_router.include_router(macro_router, prefix="/macro", tags=["macro"])
api_router.include_router(signals_router, prefix="/signals", tags=["signals"])