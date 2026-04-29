"""
Podcast Mode Routes
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging

from services.news_service import fetch_macro_news
from services.podcast_service import podcast_service

logger = logging.getLogger(__name__)

router = APIRouter()


class PodcastResponse(BaseModel):
    audio_base64: str
    text_summary: str
    duration_estimate: int
    generated_at: str
    success: bool = True


@router.get("", response_model=PodcastResponse)   # "" not "/" — prevents 307 redirect
async def get_podcast_briefing():
    try:
        logger.info("Fetching macro news for podcast generation")
        news_data = await fetch_macro_news()

        if not news_data.get("articles"):
            raise HTTPException(status_code=404, detail="No news articles available")

        logger.info("Generating podcast")
        podcast_data = await podcast_service.generate_podcast(news_data)
        return PodcastResponse(**podcast_data)

    except ValueError as e:
        logger.error(f"Config error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Podcast generation failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate podcast: {str(e)}")


@router.get("/health")
async def podcast_health():
    return {"status": "healthy", "service": "podcast"}