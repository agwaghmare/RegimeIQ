from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class NewsArticle(BaseModel):
    title: str
    source: str
    url: str
    published_at: datetime
    description: Optional[str] = None
    black_swan_score: float  # 0-100, high = potential black swan
    relevance: str  # "macro", "black_swan", "normal"

class NewsResponse(BaseModel):
    articles: List[NewsArticle]
    summary: str  # e.g. "3 macro + 1 potential black swan"
    as_of: datetime