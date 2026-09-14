"""
Google Gemini AI Service.
Integrates Gemini models (gemini-1.5-flash, gemini-1.5-pro) via direct Google Generative Language REST API.
Provides both synchronous completion and real-time SSE streaming.
"""

import json
from typing import AsyncGenerator, Optional
import httpx

from app.core.config import settings


class GeminiService:
    """Service for interfacing with Google Generative AI (Gemini) API."""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(self):
        self.default_model = settings.GEMINI_MODEL or "gemini-1.5-flash"
        self.default_api_key = settings.GEMINI_API_KEY or ""

    def _resolve_config(self, api_key: Optional[str] = None, model: Optional[str] = None) -> tuple[str, str]:
        key = (api_key or self.default_api_key or "").strip()
        mdl = (model or self.default_model or "gemini-1.5-flash").strip()
        return key, mdl

    def generate_response(
        self,
        prompt: str,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 30.0
    ) -> str:
        """
        Synchronously generate a response using Gemini REST API.
        """
        key, mdl = self._resolve_config(api_key, model)
        if not key:
            raise ValueError("Gemini API key is required")

        url = f"{self.BASE_URL}/models/{mdl}:generateContent?key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 800}
        }

        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        candidates = data.get("candidates", [])
        if not candidates:
            return ""
        parts = candidates[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts)

    async def stream_response(
        self,
        prompt: str,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 30.0
    ) -> AsyncGenerator[str, None]:
        """
        Stream response tokens from Gemini via SSE.
        """
        key, mdl = self._resolve_config(api_key, model)
        if not key:
            raise ValueError("Gemini API key is required")

        url = f"{self.BASE_URL}/models/{mdl}:streamGenerateContent?alt=sse&key={key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 800}
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line.startswith("data:"):
                        continue
                    json_str = line[5:].strip()
                    if not json_str:
                        continue
                    try:
                        chunk_data = json.loads(json_str)
                        candidates = chunk_data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            text = "".join(p.get("text", "") for p in parts)
                            if text:
                                yield text
                    except Exception:
                        continue


gemini_service = GeminiService()
