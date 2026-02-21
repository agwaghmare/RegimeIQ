from fastapi import APIRouter
from services.market_service import compute_market_features

router = APIRouter()

@router.get("/")
def get_market_data():
    df = compute_market_features()

    result = df.tail(5).reset_index()
    result["Date"] = result["Date"].astype(str)

    return result.to_dict(orient="list")
