"""
Rate Limiting Middleware & Dependency.
Senior SDE Pattern: Distributed Redis sliding-window rate limiter with
in-memory fallback and per-client / per-user isolation.
"""

import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status
from app.core.config import settings
from app.core.cache import cache_manager


class RateLimiter:
    """Sliding-window distributed rate limiter backed by Redis with in-memory fallback."""

    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self._history: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, identifier: str) -> bool:
        """Evaluate whether the request from identifier is within rate limits."""
        now = time.time()
        window_start = now - 60.0

        # Attempt Redis sliding window
        redis_client = cache_manager._redis_client
        if redis_client is not None:
            try:
                key = f"ratelimit:{identifier}"
                pipe = redis_client.pipeline()
                pipe.zremrangebyscore(key, 0, window_start)
                pipe.zadd(key, {f"{now}": now})
                pipe.zcard(key)
                pipe.expire(key, 65)
                results = pipe.execute()
                current_count = results[2]
                return current_count <= self.requests_per_minute
            except Exception:
                pass

        # In-memory sliding window fallback
        self._history[identifier] = [t for t in self._history[identifier] if t > window_start]
        if len(self._history[identifier]) >= self.requests_per_minute:
            return False

        self._history[identifier].append(now)
        return True

    def clear(self):
        """Helper for test suites to reset rate limit state."""
        self._history.clear()
        redis_client = cache_manager._redis_client
        if redis_client is not None:
            try:
                keys = redis_client.keys("ratelimit:*")
                if keys:
                    redis_client.delete(*keys)
            except Exception:
                pass


limiter = RateLimiter(requests_per_minute=settings.RATE_LIMIT_PER_MINUTE)


async def check_rate_limit(request: Request):
    """FastAPI dependency to enforce rate limits on sensitive endpoints."""
    auth_header = request.headers.get("Authorization", "")
    api_key_header = request.headers.get("X-API-Key", "")
    client_id = api_key_header or auth_header or (request.client.host if request.client else "127.0.0.1")

    if not limiter.is_allowed(client_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before sending more requests."
        )
