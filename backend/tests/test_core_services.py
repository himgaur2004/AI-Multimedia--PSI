"""
Unit tests for Core Services, Security, Vector Retrieval, and Edge Cases.
"""

import time
import pytest
from app.core.config import settings
from app.core.rate_limit import RateLimiter, limiter
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.services.document_service import (
    DocumentService,
    document_service,
    format_seconds,
    parse_timestamp_to_seconds,
)
from app.services.vector_service import VectorService, vector_service
from app.services.rag_service import rag_service
from app.services.summary_service import summary_service
from app.services.transcription_service import transcription_service


def test_security_password_hashing():
    pwd = "SeniorEngineerSecret!99"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False
    assert verify_password(pwd, "invalid_hash_format") is False


def test_security_jwt_lifecycle():
    data = {"sub": "user-42", "username": "ada"}
    token = create_access_token(data)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "user-42"
    assert decoded["username"] == "ada"

    # Corrupted tokens
    assert decode_access_token("corrupted.jwt.token") is None
    assert decode_access_token("singlepart") is None

    # Expired token
    from datetime import timedelta
    expired_token = create_access_token(data, expires_delta=timedelta(seconds=-10))
    assert decode_access_token(expired_token) is None


def test_rate_limiter():
    rl = RateLimiter(requests_per_minute=3)
    assert rl.is_allowed("ip1") is True
    assert rl.is_allowed("ip1") is True
    assert rl.is_allowed("ip1") is True
    # 4th request exceeds limit
    assert rl.is_allowed("ip1") is False
    # Distinct IP is allowed
    assert rl.is_allowed("ip2") is True
    
    # Test reset
    rl.clear()
    assert rl.is_allowed("ip1") is True


def test_document_service_utilities():
    # Time formatting
    assert format_seconds(0) == "00:00"
    assert format_seconds(65) == "01:05"
    assert format_seconds(3665) == "01:01:05"

    # Time parsing
    assert parse_timestamp_to_seconds("01:05") == 65.0
    assert parse_timestamp_to_seconds("[01:01:05]") == 3665.0
    assert parse_timestamp_to_seconds("invalid") == 0.0

    # Validation errors
    with pytest.raises(ValueError, match="missing extension"):
        document_service.validate_file("filename_without_ext", 100)

    with pytest.raises(ValueError, match="Unsupported file format"):
        document_service.validate_file("test.exe", 100)

    with pytest.raises(ValueError, match="exceeds maximum permitted limit"):
        document_service.validate_file("test.pdf", (settings.MAX_FILE_SIZE_MB + 1) * 1024 * 1024)

    # Chunking
    text = "Sentence one. Sentence two. Sentence three. Sentence four."
    chunks = document_service.chunk_text(text, chunk_size=25, chunk_overlap=5)
    assert len(chunks) > 1
    assert document_service.chunk_text("") == []


def test_vector_service_operations():
    vs = VectorService()
    doc_id = "doc-test-1"
    chunks = [
        {"text": "FastAPI is a modern web framework for building APIs with Python.", "metadata": {"page": 1}},
        {"text": "LangChain provides components for retrieval-augmented generation.", "metadata": {"page": 2}},
        {"text": "Whisper is an automatic speech recognition system trained on audio.", "metadata": {"start_time": 10.0}}
    ]
    vs.index_chunks(doc_id, chunks)

    # Search query
    res = vs.search(doc_id, "FastAPI Python web framework", top_k=2)
    assert len(res) == 2
    assert "FastAPI" in res[0]["text"]
    assert res[0]["score"] > 0

    # Search non-indexed document
    empty_res = vs.search("unknown-doc", "query")
    assert empty_res == []

    # Deletion
    vs.delete_document(doc_id)
    assert vs.search(doc_id, "FastAPI") == []


def test_rag_service_fallback():
    context, citations = rag_service.build_context("unindexed-doc", "any query")
    assert "No relevant context found" in context
    assert citations == []

    # Prompt formatting
    pdf_prompt = rag_service.generate_prompt("query", "some context", "pdf")
    assert "[Page" in pdf_prompt

    media_prompt = rag_service.generate_prompt("query", "some context", "video")
    assert "[01:23]" in media_prompt


def test_summary_and_transcription_fallbacks():
    text = "Paragraph one with detailed system information.\nParagraph two explaining vector indexing."
    summary = summary_service._generate_deterministic_summary("doc-1", text, "document")
    assert summary.document_id == "doc-1"
    assert len(summary.key_points) > 0

    topics = summary_service.extract_topics("doc-1", [])
    assert topics.total_topics == 0

    # Transcription deterministic
    txt, segs, dur = transcription_service._generate_deterministic_transcript("fake_path.mp4")
    assert len(segs) > 0
    assert dur > 0


def test_health_check_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "OmniMind" in data["app"]
