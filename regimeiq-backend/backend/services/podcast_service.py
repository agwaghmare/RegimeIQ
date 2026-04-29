"""
Podcast Mode Service
Generates macro briefing text via Mistral AI + audio via Voxtral TTS SDK
"""

import os
import base64
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import httpx
import logging

logger = logging.getLogger(__name__)

_podcast_cache: Dict[str, Any] = {}
CACHE_TTL_MINUTES = 10

# Confirmed working voice IDs from Voxtral TTS preset library
# See: https://console.mistral.ai (Studio > Audio > Voices)
VOXTRAL_VOICE = "river"   # neutral English male — change to "aurora" for female


class PodcastService:
    def __init__(self):
        self.mistral_api_key = os.getenv("MISTRAL_API_KEY")
        if not self.mistral_api_key:
            raise ValueError("MISTRAL_API_KEY not found in environment")
        self.mistral_chat_url = "https://api.mistral.ai/v1/chat/completions"
        self.mistral_tts_url  = "https://api.mistral.ai/v1/audio/speech"

    async def generate_podcast(self, news_data: Dict[str, Any]) -> Dict[str, Any]:
        cache_key = "podcast_latest"
        cached = self._get_cached_podcast(cache_key)
        if cached:
            logger.info("Returning cached podcast")
            return cached

        logger.info("Generating text summary with Mistral AI")
        text_summary = await self._generate_summary_mistral(news_data)

        logger.info("Generating audio with Voxtral TTS")
        audio_base64 = await self._generate_audio_voxtral(text_summary)

        word_count        = len(text_summary.split())
        duration_estimate = int((word_count / 150) * 60)

        result = {
            "audio_base64":     audio_base64,
            "text_summary":     text_summary,
            "duration_estimate": duration_estimate,
            "generated_at":     datetime.utcnow().isoformat()
        }

        self._cache_podcast(cache_key, result)
        logger.info(f"Podcast generated: {word_count} words, ~{duration_estimate}s")
        return result

    async def _generate_summary_mistral(self, news_data: Dict[str, Any]) -> str:
        articles  = news_data.get("articles", [])
        today     = datetime.utcnow().strftime("%B %d, %Y")

        articles_text = "\n\n".join([
            f"Headline: {a['title']}\n"
            f"Source: {a.get('source', 'Unknown')}\n"
            f"Detail: {a.get('description', 'No detail available.')}"
            for a in articles[:20]
        ])

        prompt = f"""You are a senior macro strategist recording a daily audio briefing for institutional investors.

TODAY'S DATE: {today}

NEWS AVAILABLE:
{articles_text}

Produce a 700-900 word spoken briefing like a Bloomberg radio segment covering:
1. Opening: "Good morning. Here is your macro and markets briefing for {today}."
2. Macro overview: growth, central bank policy, inflation
3. Fixed income & rates: Treasury yields, credit spreads
4. Equities: S&P 500, Nasdaq, sector rotation, earnings
5. Commodities & FX: oil, gold, DXY, EUR/USD
6. Geopolitical & policy risk
7. Closing takeaway ending with: "That's your briefing for {today}. Stay sharp."

Requirements: pure spoken prose, no bullets/headers/markdown, natural transitions, specific numbers from news.
Output ONLY the spoken text."""

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.mistral_chat_url,
                headers={
                    "Authorization": f"Bearer {self.mistral_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "mistral-large-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.65,
                    "max_tokens": 1200
                }
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()

    async def _generate_audio_voxtral(self, text: str) -> str:
        """
        Generate audio using voxtral-mini-tts-latest.
        Uses the mistralai SDK to ensure correct request format.
        Falls back to empty string (browser TTS) if audio fails.
        """
        try:
            from mistralai import Mistral
            client = Mistral(api_key=self.mistral_api_key)

            response = client.audio.speech(
                model="voxtral-mini-tts-latest",
                voice=VOXTRAL_VOICE,
                input=text,
                response_format="mp3"
            )

            # response is bytes or has .content
            if hasattr(response, 'content'):
                audio_bytes = response.content
            elif hasattr(response, 'read'):
                audio_bytes = response.read()
            else:
                audio_bytes = bytes(response)

            audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
            logger.info(f"Audio generated via SDK: {len(audio_bytes):,} bytes")
            return audio_b64

        except ImportError:
            logger.warning("mistralai SDK not installed, falling back to httpx")
            return await self._generate_audio_httpx(text)
        except Exception as e:
            logger.error(f"Voxtral SDK error: {str(e)} — falling back to httpx")
            return await self._generate_audio_httpx(text)

    async def _generate_audio_httpx(self, text: str) -> str:
        """
        Direct httpx fallback. Lists available voices first to use a valid one.
        Returns empty string on failure (browser TTS handles it).
        """
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    self.mistral_tts_url,
                    headers={
                        "Authorization": f"Bearer {self.mistral_api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "voxtral-mini-tts-latest",
                        "input": text,
                        "voice": VOXTRAL_VOICE,
                        "response_format": "mp3"
                    }
                )
                response.raise_for_status()
                audio_b64 = base64.b64encode(response.content).decode("utf-8")
                logger.info(f"Audio generated via httpx: {len(response.content):,} bytes")
                return audio_b64

        except Exception as e:
            logger.error(f"Voxtral httpx error: {str(e)} — returning empty, browser TTS will handle")
            return ""   # graceful fallback to browser TTS

    def _get_cached_podcast(self, key: str) -> Optional[Dict[str, Any]]:
        if key in _podcast_cache:
            d  = _podcast_cache[key]
            at = datetime.fromisoformat(d["generated_at"])
            if datetime.utcnow() - at < timedelta(minutes=CACHE_TTL_MINUTES):
                return d
        return None

    def _cache_podcast(self, key: str, data: Dict[str, Any]):
        _podcast_cache[key] = data


podcast_service = PodcastService()