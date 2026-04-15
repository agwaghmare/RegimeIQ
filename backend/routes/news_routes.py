from fastapi import APIRouter, HTTPException, Query

from schema.news import NewsResponse
from services.news_service import fetch_macro_news

router = APIRouter()

@router.get("/", response_model=NewsResponse)
async def get_news(
    days_back: int = 1,
    topics: str | None = Query(None, description="Comma-separated topics, e.g. ai,oil,crypto"),
):
    """Get macro news + black swan alerts."""
    try:
        parsed_topics = [t.strip() for t in (topics or "").split(",") if t.strip()]
        return await fetch_macro_news(days_back, topics=parsed_topics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"News fetch failed: {str(e)}")