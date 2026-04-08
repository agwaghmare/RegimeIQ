from fastapi import APIRouter

from .health_routes import router as health_router
from .market_routes import router as market_router
from .macro_routes import router as macro_router
from .signals_routes import router as signals_router
from .regime_routes import router as regime_router
from .allocation_routes import router as allocation_router
from .news_routes import router as news_router

api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
api_router.include_router(market_router, prefix="/market", tags=["market"])
api_router.include_router(macro_router, prefix="/macro", tags=["macro"])
api_router.include_router(signals_router, prefix="/signals", tags=["signals"])
api_router.include_router(regime_router, prefix="/regime", tags=["regime"])
api_router.include_router(allocation_router, prefix="/allocation", tags=["allocation"])
api_router.include_router(news_router, prefix="/news", tags=["news"])
