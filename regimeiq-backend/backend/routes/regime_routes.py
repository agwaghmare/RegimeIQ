from fastapi import APIRouter, HTTPException
from services.regime_service import get_regime_snapshot

router = APIRouter()


@router.get("/")
def get_regime():
    try:
        return get_regime_snapshot()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=f"Cached data not found: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
