"""
Rate Limiting Middleware & Dependency.
Senior SDE Pattern: Sliding window in-memory rate limiter with clean pluggable backend.
"""

import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status
from app.core.config import settings


class RateLimiter:
    """Sliding window in-memory rate limiter keyed by client IP or user ID."""

    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self._history: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, identifier: str) -> bool:
        now = time.time()
        window_start = now - 60.0
        
        # Clean older requests outside the 60s sliding window
        self._history[identifier] = [t for t in self._history[identifier] if t > window_start]
        
        if len(self._history[identifier]) >= self.requests_per_minute:
            return False
            
        self._history[identifier].append(now)
        return True

    def clear(self):
        """Helper for test suites to reset rate limit state."""
        self._history.clear()


limiter = RateLimiter(requests_per_minute=settings.RATE_LIMIT_PER_MINUTE)


async def check_rate_limit(request: Request):
    """FastAPI dependency to enforce rate limits on sensitive endpoints."""
    # Use client host IP or authorization header if available
    auth_header = request.headers.get("Authorization", "")
    client_id = auth_header if auth_header else (request.client.host if request.client else "127.0.0.1")
    
    if not limiter.is_allowed(client_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before sending more requests."
        )
