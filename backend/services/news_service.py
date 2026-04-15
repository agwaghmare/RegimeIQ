import httpx
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import os

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "").strip()
NEWS_ENDPOINT = "https://newsapi.org/v2/everything"


def _parse_published_at(raw: Any) -> datetime:
    if raw is None:
        return datetime.now(timezone.utc)
    if isinstance(raw, datetime):
        return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)
    s = str(raw).strip()
    if not s:
        return datetime.now(timezone.utc)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


def _normalize_article(raw: dict, relevance: str, score: float) -> dict:
    """Map NewsAPI article JSON to our NewsArticle schema."""
    src = raw.get("source")
    if isinstance(src, dict):
        source_name = (src.get("name") or "unknown").strip() or "unknown"
    elif isinstance(src, str):
        source_name = src.strip() or "unknown"
    else:
        source_name = "unknown"

    title = (raw.get("title") or "").strip() or "Untitled"
    url = (raw.get("url") or "").strip() or "https://newsapi.org"
    desc = raw.get("description")
    if isinstance(desc, str):
        desc = desc.strip() or None
    else:
        desc = None

    return {
        "title": title,
        "source": source_name,
        "url": url,
        "published_at": _parse_published_at(raw.get("publishedAt") or raw.get("published_at")),
        "description": desc,
        "black_swan_score": float(score),
        "relevance": relevance,
    }


async def _fetch_articles(
    client: httpx.AsyncClient,
    q: str,
    days_back: int,
) -> list[dict]:
    if not NEWS_API_KEY or NEWS_API_KEY == "your-key-here":
        return []
    params = {
        "q": q,
        "from": (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d"),
        "sortBy": "publishedAt",
        "language": "en",
        "pageSize": 10,
        "apiKey": NEWS_API_KEY,
    }
    try:
        resp = await client.get(NEWS_ENDPOINT, params=params, timeout=20.0)
    except httpx.RequestError:
        return []
    if resp.status_code != 200:
        return []
    try:
        data = resp.json()
    except Exception:
        return []
    articles = data.get("articles") or []
    return [a for a in articles if isinstance(a, dict)]


async def fetch_macro_news(days_back: int = 1, topics: Optional[list[str]] = None) -> dict:
    """
    Fetch macro/financial news. Never raises — returns empty articles if NewsAPI is unavailable
    or misconfigured so the UI still loads.
    """
    if not NEWS_API_KEY or NEWS_API_KEY == "your-key-here":
        return {
            "articles": [],
            "summary": "News disabled: set NEWS_API_KEY in backend/.env (see newsapi.org).",
            "as_of": datetime.now(timezone.utc),
        }

    black_swan_keywords = (
        "black swan OR crash OR meltdown OR crisis OR collapse OR contagion OR panic"
    )
    macro_keywords = (
        "fed OR inflation OR recession OR unemployment OR yield curve OR gdp OR cpi OR pmi"
    )
    if topics:
        topic_clause = " OR ".join([t.strip() for t in topics if t and t.strip()])
        if topic_clause:
            macro_keywords = f"({macro_keywords}) OR ({topic_clause})"

    all_normalized: list[dict] = []

    async with httpx.AsyncClient() as client:
        bs_raw = await _fetch_articles(client, black_swan_keywords, days_back)
        for a in bs_raw[:5]:
            all_normalized.append(_normalize_article(a, "black_swan", 90.0 + (len(str(a.get("title", ""))) % 10)))

        macro_raw = await _fetch_articles(client, macro_keywords, days_back)
        for a in macro_raw[:8]:
            all_normalized.append(
                _normalize_article(a, "macro", 20.0 + (len(str(a.get("title", ""))) % 40))
            )

    n_bs = len([x for x in all_normalized if x["relevance"] == "black_swan"])
    n_m = len([x for x in all_normalized if x["relevance"] == "macro"])
    summary = f"{n_bs} tail-risk + {n_m} macro articles"
    if not all_normalized:
        summary = "No articles returned (try broader topics or check NEWS_API_KEY quota)."

    return {
        "articles": all_normalized,
        "summary": summary,
        "as_of": datetime.now(timezone.utc),
    }
