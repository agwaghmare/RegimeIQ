from fastapi import APIRouter, HTTPException

from schema.news import NewsResponse
from services.news_service import fetch_macro_news

router = APIRouter()

@router.get("/", response_model=NewsResponse)
async def get_news(days_back: int = 1):
    """Get macro news + black swan alerts."""
    try:
        return await fetch_macro_news(days_back)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"News fetch failed: {str(e)}")