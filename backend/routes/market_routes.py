from fastapi import APIRouter
from services.market_service import get_market_features_cached

router = APIRouter()

@router.get("/")
def get_market_data():
    df = get_market_features_cached()

    result = df.tail(5).reset_index()
    result["Date"] = result["Date"].astype(str)

    return result.to_dict(orient="list")
