import httpx
from datetime import datetime, timedelta
from typing import Optional
import os

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "your-key-here")  # Get free at newsapi.org
NEWS_ENDPOINT = "https://newsapi.org/v2/everything"

async def fetch_macro_news(days_back: int = 1, topics: Optional[list[str]] = None) -> dict:
    """Fetch recent macro/financial news + score for black swan potential."""
    async with httpx.AsyncClient() as client:
        # Black swan keywords (tail events, crashes, etc.)
        black_swan_keywords = "black swan OR crash OR meltdown OR crisis OR collapse OR contagion OR panic OR contagion"
        
        # Macro normal news
        macro_keywords = "fed OR inflation OR recession OR unemployment OR yield curve OR gdp OR cpi OR pmi OR gdp"
        if topics:
            topic_clause = " OR ".join([t.strip() for t in topics if t and t.strip()])
            if topic_clause:
                macro_keywords = f"({macro_keywords}) OR ({topic_clause})"
        
        # Fetch black swan first (higher priority)
        black_swan_resp = await client.get(
            NEWS_ENDPOINT,
            params={
                "q": black_swan_keywords,
                "from": (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d"),
                "sortBy": "publishedAt",
                "language": "en",
                "pageSize": 10,
                "apiKey": NEWS_API_KEY
            }
        )
        
        # Fetch macro normal
        macro_resp = await client.get(
            NEWS_ENDPOINT,
            params={
                "q": macro_keywords,
                "from": (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d"),
                "sortBy": "publishedAt",
                "language": "en",
                "pageSize": 10,
                "apiKey": NEWS_API_KEY
            }
        )
        
        if black_swan_resp.status_code != 200:
            raise ValueError(f"NewsAPI error: {black_swan_resp.text}")
        
        # Simple scoring logic (expand later with NLP)
        all_articles = []
        for article in black_swan_resp.json()["articles"][:5]:  # Top 5
            article["relevance"] = "black_swan"
            article["black_swan_score"] = 90 + (len(article["title"].lower().split()) * 2) % 10  # Dummy high score
            all_articles.append(article)
        
        for article in macro_resp.json()["articles"][:8]:  # Top 8 normal
            article["relevance"] = "macro"
            article["black_swan_score"] = 20 + (len(article["title"]) % 40)  # Dummy low-med score
            all_articles.append(article)
        
        summary = f"{len([a for a in all_articles if a['relevance']=='black_swan'])} black swan + {len([a for a in all_articles if a['relevance']=='macro'])} macro articles"
        
        return {
            "articles": all_articles,
            "summary": summary,
            "as_of": datetime.now()
        }