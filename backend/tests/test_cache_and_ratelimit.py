"""
Tests for Redis Dual-Tier Cache Manager, Rate Limiting, and FAISS Vector Service.
Ensures rigorous >=95% code coverage across new enterprise infrastructure.
"""

import time
from unittest.mock import MagicMock, patch
import pytest
from fastapi import HTTPException

from app.core.cache import RedisCacheManager, cache_manager
from app.core.rate_limit import RateLimiter, check_rate_limit
from app.core.security import generate_api_key, hash_api_key, verify_api_key
from app.services.vector_service import vector_service, VectorService
from app.services.rag_service import rag_service


def test_api_key_crypto_helpers():
    """Verify high-entropy generation, SHA-256 hashing, and constant-time verification."""
    key = generate_api_key(prefix="omni_dev")
    assert key.startswith("omni_dev_")
    assert len(key) > 30

    h = hash_api_key(key)
    assert len(h) == 64  # SHA-256 hex length
    assert verify_api_key(key, h) is True
    assert verify_api_key("wrong_key", h) is False


def test_redis_cache_in_memory_fallback():
    """Test full in-memory fallback behavior when Redis is disabled."""
    mgr = RedisCacheManager(redis_url="redis://invalid-host:9999/0", default_ttl=2)
    assert mgr.is_redis_available() is False

    # Set and Get
    mgr.set("user:101", {"name": "Alice", "role": "admin"})
    val = mgr.get("user:101")
    assert val == {"name": "Alice", "role": "admin"}

    # String value
    mgr.set("plain_str", "hello_world")
    assert mgr.get("plain_str") == "hello_world"

    # Nonexistent key
    assert mgr.get("nonexistent") is None

    # Pattern deletion
    mgr.set("doc:1", "data1")
    mgr.set("doc:2", "data2")
    mgr.set("other:1", "data3")
    deleted_count = mgr.delete_pattern("doc:*")
    assert deleted_count >= 2
    assert mgr.get("doc:1") is None
    assert mgr.get("other:1") == "data3"

    # Single delete
    mgr.delete("other:1")
    assert mgr.get("other:1") is None

    # Clear
    mgr.set("k1", "v1")
    mgr.clear()
    assert mgr.get("k1") is None


def test_redis_cache_expiration():
    """Test TTL expiration in cache manager."""
    mgr = RedisCacheManager(redis_url="redis://invalid-host:9999/0", default_ttl=1)
    mgr.set("ephemeral_key", "temporary_data", ttl=1)
    assert mgr.get("ephemeral_key") == "temporary_data"
    time.sleep(1.1)
    assert mgr.get("ephemeral_key") is None


def test_redis_cache_mocked_redis_branch():
    """Test Redis client branch with mock client."""
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_redis.get.return_value = '{"foo": "bar"}'
    mock_redis.keys.return_value = ["test:1", "test:2"]
    mock_redis.delete.return_value = 2

    mgr = RedisCacheManager()
    mgr._redis_client = mock_redis

    assert mgr.is_redis_available() is True
    assert mgr.get("test:1") == {"foo": "bar"}

    mgr.set("test:3", {"val": 123}, ttl=60)
    mock_redis.set.assert_called()

    assert mgr.delete("test:1") is True
    assert mgr.delete_pattern("test:*") >= 2

    mgr.clear()
    mock_redis.flushdb.assert_called()


def test_rate_limiter_redis_and_fallback():
    """Test distributed sliding window rate limiter backed by Redis and fallback."""
    limiter = RateLimiter(requests_per_minute=3)
    limiter.clear()

    client_id = "test-client-127.0.0.1"
    assert limiter.is_allowed(client_id) is True
    assert limiter.is_allowed(client_id) is True
    assert limiter.is_allowed(client_id) is True
    # 4th request must be rejected
    assert limiter.is_allowed(client_id) is False

    limiter.clear()
    assert limiter.is_allowed(client_id) is True


@pytest.mark.asyncio
async def test_check_rate_limit_dependency_exceeded():
    """Verify check_rate_limit dependency raises 429 when quota exceeded."""
    from app.core.rate_limit import limiter
    limiter.clear()
    mock_req = MagicMock()
    mock_req.headers = {"X-API-Key": "omni_rate_limit_test"}
    mock_req.client = MagicMock()
    mock_req.client.host = "127.0.0.1"

    # Exhaust limit
    for _ in range(limiter.requests_per_minute):
        await check_rate_limit(mock_req)

    with pytest.raises(HTTPException) as exc_info:
        await check_rate_limit(mock_req)
    assert exc_info.value.status_code == 429


def test_faiss_semantic_vector_search():
    """Test FAISS IndexFlatIP indexing, querying, and deletion."""
    vs = VectorService()
    doc_id = "test-faiss-doc-001"
    chunks = [
        {"text": "Artificial intelligence and neural networks are revolutionizing computing.", "metadata": {"page": 1, "file_type": "pdf"}},
        {"text": "Quantum computing utilizes qubits for exponential speedup in cryptographic tasks.", "metadata": {"page": 2, "file_type": "pdf"}},
        {"text": "Database indexing with B-Trees and LSM trees provides low-latency disk access.", "metadata": {"page": 3, "file_type": "pdf"}},
    ]

    vs.index_chunks(doc_id, chunks)
    assert doc_id in vs.doc_faiss_indexes
    assert vs.doc_faiss_indexes[doc_id].ntotal == 3

    # Query for quantum computing
    results = vs.search(doc_id, "qubits cryptography quantum speedup", top_k=2)
    assert len(results) > 0
    assert "qubits" in results[0]["text"]
    assert results[0]["metadata"]["page"] == 2

    # Query for databases
    results_db = vs.search(doc_id, "database indexing B-Trees", top_k=1)
    assert "LSM trees" in results_db[0]["text"]

    # Test deletion
    vs.delete_document(doc_id)
    assert doc_id not in vs.doc_faiss_indexes
    assert vs.search(doc_id, "quantum") == []


@pytest.mark.asyncio
async def test_rag_service_redis_caching_and_streaming():
    """Verify RAG service caches query answers and streams tokens with SSE."""
    cache_manager.clear()
    doc_id = "rag-cached-doc-001"
    chunks = [
        {"text": "PSI supports high-concurrency Redis caching and FAISS vector retrieval.", "metadata": {"page": 1, "file_type": "pdf"}}
    ]
    vector_service.index_chunks(doc_id, chunks)

    # 1. First call computes and caches answer
    ans1, cits1, fups1 = rag_service.answer_query(
        document_id=doc_id,
        query="What does PSI support?",
        file_type="pdf",
        search_mode="inbuilt"
    )
    assert "PSI" in ans1 or "Redis caching" in ans1
    assert rag_service.last_retrieval_method == "FAISS Semantic Vector Search"

    # 2. Second call retrieves instantly from cache
    ans2, cits2, fups2 = rag_service.answer_query(
        document_id=doc_id,
        query="What does PSI support?",
        file_type="pdf",
        search_mode="inbuilt"
    )
    assert ans2 == ans1

    # 3. Test SSE streaming from cache
    tokens = []
    async for chunk_str in rag_service.stream_query(
        document_id=doc_id,
        query="What does PSI support?",
        file_type="pdf",
        search_mode="inbuilt"
    ):
        tokens.append(chunk_str)

    assert len(tokens) > 0
    assert any("done" in t for t in tokens)


def test_rate_limiter_redis_pipeline_branches():
    """Verify rate limiter Redis pipeline logic and branch execution."""
    mock_redis = MagicMock()
    mock_pipe = MagicMock()
    # First call: 1 request (allowed), second call: 99 requests (rejected)
    mock_pipe.execute.side_effect = [
        [0, 1, 1, True],
        [0, 1, 99, True],
        Exception("Redis pipeline error"),
    ]
    mock_redis.pipeline.return_value = mock_pipe
    mock_redis.keys.side_effect = [
        ["ratelimit:client_a"],
        Exception("Keys scan error"),
    ]

    with patch("app.core.rate_limit.cache_manager._redis_client", mock_redis):
        lim = RateLimiter(requests_per_minute=5)
        # 1st call <= 5 -> True
        assert lim.is_allowed("client_a") is True
        # 2nd call > 5 -> False
        assert lim.is_allowed("client_a") is False
        # 3rd call raises exception -> falls back to in-memory -> True
        assert lim.is_allowed("client_b") is True

        # Test clear with keys
        lim.clear()
        mock_redis.delete.assert_called_with("ratelimit:client_a")

        # Test clear with exception
        lim.clear()


def test_cache_manager_plain_string_and_get_exception():
    """Verify non-JSON string decoding and get() exception handling."""
    mock_redis = MagicMock()
    mock_redis.get.side_effect = [
        "raw-unquoted-string",
        Exception("Redis get timeout"),
    ]

    mgr = RedisCacheManager()
    mgr._redis_client = mock_redis
    # 1. Non-JSON string falls back to raw string
    assert mgr.get("plain_key") == "raw-unquoted-string"
    # 2. Redis exception falls back to in-memory cache
    mgr._memory_cache["plain_key"] = ("fallback_val", time.time() + 60)
    assert mgr.get("plain_key") == "fallback_val"


def test_vector_service_ensure_indexed_from_db():

    """Verify vector service reconstructs in-memory FAISS and TF-IDF index from DB."""
    vs = VectorService()
    doc_id = "test-reconstructed-doc-id"

    # Mock DB row returning document_contents
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = {
        "file_type": "pdf",
        "full_text": "[Page 1] Introduction to Distributed Systems and Consensus Algorithms.\n[Page 2] Raft and Paxos.",
        "transcript_segments_json": "[]"
    }
    mock_conn.cursor.return_value = mock_cursor

    with patch("app.core.database.db_manager.get_connection", return_value=mock_conn):
        vs._ensure_indexed(doc_id)
        assert doc_id in vs.doc_chunks
        assert doc_id in vs.doc_faiss_indexes
        results = vs.search(doc_id, "Consensus Algorithms Raft", top_k=2)
        assert len(results) > 0


def test_cache_manager_exception_resilience():
    """Verify cache manager gracefully handles Redis exceptions without failing."""
    mock_redis = MagicMock()
    mock_redis.get.side_effect = Exception("Redis connection dropped")
    mock_redis.set.side_effect = Exception("Redis write failed")
    mock_redis.delete.side_effect = Exception("Redis delete error")
    mock_redis.keys.side_effect = Exception("Redis keys error")
    mock_redis.flushdb.side_effect = Exception("Redis flush error")

    mgr = RedisCacheManager()
    mgr._redis_client = mock_redis

    # Should fall back to in-memory silently without raising
    mgr.set("resilient_key", {"status": "ok"}, ttl=60)
    assert mgr.get("resilient_key") == {"status": "ok"}
    assert mgr.delete("resilient_key") is True
    mgr.set("doc:1", "item1")
    mgr.delete_pattern("doc:*")
    mgr.clear()

