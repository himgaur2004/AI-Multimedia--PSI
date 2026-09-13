"""
Distributed Redis & In-Memory Cache Manager.
Senior SDE Pattern: Resilient dual-tier cache layer providing automatic Redis pooling,
JSON serialization, and transparent in-memory fallback if Redis is unavailable.
"""

import json
import logging
import threading
import time
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import redis
except ImportError:
    redis = None


class RedisCacheManager:
    """Enterprise dual-tier caching manager with Redis connection pooling & in-memory fallback."""

    def __init__(self, redis_url: str = settings.REDIS_URL, default_ttl: int = settings.CACHE_TTL_SECONDS):
        self.redis_url = redis_url
        self.default_ttl = default_ttl
        self._redis_client = None
        self._memory_cache: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()
        self._init_redis()

    def _init_redis(self):
        """Attempt connection to Redis server."""
        if redis is None:
            return
        try:
            client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
            )
            client.ping()
            self._redis_client = client
            logger.info("Connected to Redis cache at %s", self.redis_url)
        except Exception as err:
            logger.warning("Redis not reachable (%s); falling back to in-memory cache.", err)
            self._redis_client = None

    def is_redis_available(self) -> bool:
        """Check if Redis connection is active and responsive."""
        if self._redis_client is None:
            return False
        try:
            return bool(self._redis_client.ping())
        except Exception:
            return False

    def get(self, key: str) -> Optional[Any]:
        """Retrieve and deserialize value from cache."""
        if self._redis_client is not None:
            try:
                raw = self._redis_client.get(key)
                if raw is not None:
                    try:
                        return json.loads(raw)
                    except (json.JSONDecodeError, TypeError):
                        return raw
            except Exception as err:
                logger.warning("Redis get error for key %s: %s", key, err)

        # In-memory fallback
        with self._lock:
            if key in self._memory_cache:
                val, expires_at = self._memory_cache[key]
                if expires_at > time.time():
                    return val
                del self._memory_cache[key]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Serialize and store value in cache with expiration TTL (seconds)."""
        expiry = ttl if ttl is not None else self.default_ttl
        serialized = json.dumps(value) if not isinstance(value, str) else value

        if self._redis_client is not None:
            try:
                self._redis_client.set(key, serialized, ex=expiry)
                return True
            except Exception as err:
                logger.warning("Redis set error for key %s: %s", key, err)

        # In-memory fallback
        with self._lock:
            self._memory_cache[key] = (value, time.time() + expiry)
        return True

    def delete(self, key: str) -> bool:
        """Remove key from cache."""
        deleted = False
        if self._redis_client is not None:
            try:
                self._redis_client.delete(key)
                deleted = True
            except Exception as err:
                logger.warning("Redis delete error: %s", err)

        with self._lock:
            if key in self._memory_cache:
                del self._memory_cache[key]
                deleted = True
        return deleted

    def delete_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching glob pattern (e.g. 'doc:*')."""
        count = 0
        if self._redis_client is not None:
            try:
                keys = self._redis_client.keys(pattern)
                if keys:
                    count += self._redis_client.delete(*keys)
            except Exception as err:
                logger.warning("Redis pattern deletion error: %s", err)

        # Also purge in-memory matching
        import fnmatch
        with self._lock:
            matched = [k for k in self._memory_cache if fnmatch.fnmatch(k, pattern)]
            for k in matched:
                del self._memory_cache[k]
                count += 1
        return count

    def clear(self):
        """Purge cache contents entirely (useful for tests)."""
        if self._redis_client is not None:
            try:
                self._redis_client.flushdb()
            except Exception:
                pass
        with self._lock:
            self._memory_cache.clear()


cache_manager = RedisCacheManager()
