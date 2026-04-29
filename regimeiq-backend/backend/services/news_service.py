"""
news_service.py
Fetches the biggest finance/macro stories of the day using NewsAPI.
Uses sortBy=popularity to surface the most-read stories, not just newest.
Day-level cache ensures the briefing is stable — same stories all day.
"""

import httpx
from datetime import datetime, timedelta
import os
import logging

logger = logging.getLogger(__name__)

NEWS_API_KEY  = os.getenv("NEWS_API_KEY", "")
NEWS_ENDPOINT = "https://newsapi.org/v2/everything"

_news_cache: dict = {}


async def fetch_macro_news(days_back: int = 1) -> dict:
    """
    Fetches the biggest financial/macro stories of the day.
    Sorted by popularity (most-read/shared) so you always get the top stories,
    not random recent ones. Cached per calendar day for stability.
    """
    if not NEWS_API_KEY:
        raise ValueError("NEWS_API_KEY environment variable is not set")

    # Day-level cache key — refreshes once per day
    today_key = datetime.now().strftime("%Y-%m-%d")
    if today_key in _news_cache:
        logger.info(f"Returning cached news for {today_key}")
        return _news_cache[today_key]

    from_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")

    # Five buckets targeting the biggest stories in each segment
    queries = {
        "macro": (
            "Federal Reserve OR inflation OR recession OR GDP OR interest rates "
            "OR ECB OR central bank OR CPI OR economic outlook"
        ),
        "equities": (
            "stock market OR S&P 500 OR Nasdaq OR earnings results "
            "OR market rally OR stocks OR Wall Street OR equity"
        ),
        "bonds": (
            "Treasury yields OR bond market OR yield curve OR credit spreads "
            "OR fixed income OR 10-year Treasury OR debt"
        ),
        "commodities": (
            "oil price OR crude oil OR gold price OR commodity markets "
            "OR OPEC OR energy prices OR Brent OR WTI"
        ),
        "fx": (
            "dollar index OR currency markets OR EUR USD OR forex "
            "OR exchange rate OR DXY OR yen OR yuan"
        ),
    }

    all_articles: list = []

    async with httpx.AsyncClient(timeout=25.0) as client:
        for bucket, query in queries.items():
            try:
                resp = await client.get(
                    NEWS_ENDPOINT,
                    params={
                        "q":        query,
                        "from":     from_date,
                        "sortBy":   "popularity", 
                        "language": "en",
                        "pageSize": 10,   
                        "apiKey":   NEWS_API_KEY,
                    },
                )
                if resp.status_code != 200:
                    logger.warning(f"NewsAPI {bucket} returned {resp.status_code}")
                    continue

                articles = resp.json().get("articles", [])

                
                for a in articles[:7]:
                    title = (a.get("title") or "").strip()
                    desc  = (a.get("description") or a.get("content") or "").strip()
                    if not title or title == "[Removed]":
                        continue
                    all_articles.append({
                        "title":       title,
                        "description": desc,
                        "source":      a.get("source", {}).get("name") or "Unknown",
                        "url":         a.get("url") or "",
                        "publishedAt": a.get("publishedAt") or "",
                        "bucket":      bucket,
                    })

            except Exception as exc:
                logger.warning(f"NewsAPI {bucket} fetch failed: {exc}")
                continue

    # Deduplicate by title
    seen:   set  = set()
    unique: list = []
    for a in all_articles:
        key = a["title"].lower().strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(a)

    bucket_priority = {"macro": 0, "equities": 1, "bonds": 2, "commodities": 3, "fx": 4}
    unique.sort(key=lambda x: bucket_priority.get(x["bucket"], 5))

    bucket_counts = {b: sum(1 for a in unique if a["bucket"] == b) for b in queries}
    summary = " | ".join(f"{b}: {n}" for b, n in bucket_counts.items() if n > 0)
    logger.info(f"News fetched for {today_key}: {summary}")

    result = {
        "articles": unique[:25],
        "summary":  summary,
        "as_of":    datetime.now().isoformat(),
    }

    # Cache for the day
    _news_cache.clear() 
    _news_cache[today_key] = result
    return result