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

    # Test on-demand persistent reindexing from SQLite
    from app.core.database import db_manager
    conn = db_manager.get_connection()
    conn.execute(
        "INSERT OR IGNORE INTO users (id, username, email, hashed_password, is_active, is_guest) VALUES ('user-1', 'u1', 'u1@test.io', 'hash', 1, 0)"
    )
    conn.execute(
        "INSERT INTO documents (id, user_id, filename, original_name, file_type, file_size, storage_path, duration_seconds, processed, created_at) VALUES ('doc-reindex-1', 'user-1', 'f.pdf', 'f.pdf', 'pdf', 100, '/tmp/f.pdf', 0, 1, '2026-01-01T00:00:00Z')"
    )
    conn.execute(
        "INSERT INTO document_contents (document_id, full_text, transcript_segments_json, summary, topics_json) VALUES ('doc-reindex-1', '[Page 1]\\nPython and FastAPI are used for backend development.\\n[Page 2]\\nDocker is used for deployment.', '[]', 'Summary text', '[]')"
    )
    conn.execute(
        "INSERT INTO documents (id, user_id, filename, original_name, file_type, file_size, storage_path, duration_seconds, processed, created_at) VALUES ('doc-reindex-2', 'user-1', 'm.mp4', 'm.mp4', 'video', 100, '/tmp/m.mp4', 120, 1, '2026-01-01T00:00:00Z')"
    )
    conn.execute(
        "INSERT INTO document_contents (document_id, full_text, transcript_segments_json, summary, topics_json) VALUES ('doc-reindex-2', 'Video transcript overview', '[{\"id\": 1, \"start\": 0.0, \"end\": 10.0, \"formatted_start\": \"00:00\", \"formatted_end\": \"00:10\", \"text\": \"Welcome to the engineering talk.\"}]', 'Video summary', '[]')"
    )

    # Search should trigger on-demand index reconstruction
    reindexed_res = vs.search("doc-reindex-1", "FastAPI Python backend")
    assert len(reindexed_res) > 0
    assert "FastAPI" in reindexed_res[0]["text"]

    reindexed_media = vs.search("doc-reindex-2", "engineering talk")
    assert len(reindexed_media) > 0

    conn.execute(
        "INSERT INTO documents (id, user_id, filename, original_name, file_type, file_size, storage_path, duration_seconds, processed, created_at) VALUES ('doc-reindex-3', 'user-1', 'unpaged.pdf', 'unpaged.pdf', 'pdf', 100, '/tmp/u.pdf', 0, 1, '2026-01-01T00:00:00Z')"
    )
    conn.execute(
        "INSERT INTO document_contents (document_id, full_text, transcript_segments_json, summary, topics_json) VALUES ('doc-reindex-3', 'Unpaged pdf content without markers.', '[]', 'Summary', '[]')"
    )
    conn.execute(
        "INSERT INTO documents (id, user_id, filename, original_name, file_type, file_size, storage_path, duration_seconds, processed, created_at) VALUES ('doc-reindex-4', 'user-1', 'txtvideo.mp4', 'txtvideo.mp4', 'video', 100, '/tmp/tv.mp4', 60, 1, '2026-01-01T00:00:00Z')"
    )
    conn.execute(
        "INSERT INTO document_contents (document_id, full_text, transcript_segments_json, summary, topics_json) VALUES ('doc-reindex-4', 'Video with full text fallback', '[]', 'Summary', '[]')"
    )
    assert len(vs.search("doc-reindex-3", "unpaged")) > 0
    assert len(vs.search("doc-reindex-4", "fallback")) > 0


def test_rag_service_fallback():
    context, citations = rag_service.build_context("unindexed-doc", "any query")
    assert "No relevant context found" in context
    assert citations == []

    # Prompt formatting
    pdf_prompt = rag_service.generate_prompt("query", "some context", "pdf")
    assert "[Page" in pdf_prompt

    media_prompt = rag_service.generate_prompt("query", "some context", "video")
    assert "[01:23]" in media_prompt

    # Test deterministic synthesis with summary and points
    from app.schemas.chat import Citation
    sample_cites = [
        Citation(source="pdf", page=1, snippet="● Requirements: Build full stack app. ● Implement automated test coverage."),
    ]
    sample_media_cites = [
        Citation(source="video", formatted_timestamp="01:25", snippet="● Discussion on system architecture. ● High throughput caching.")
    ]
    sum_ans = rag_service._generate_deterministic_answer("summarize the document", sample_cites, "pdf")
    assert "• Requirements: Build full stack app." in sum_ans

    media_ans = rag_service._generate_deterministic_answer("summarize talk", sample_media_cites, "video")
    assert "[01:25]" in media_ans

    specific_ans = rag_service._generate_deterministic_answer("what are requirements", sample_cites, "pdf")
    assert "Based on [Page 1]" in specific_ans


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
    assert "PSI" in data["app"]


def test_rag_follow_up_questions_and_history():
    # Audio / Video branches
    v_fups1 = rag_service.generate_follow_up_questions("chapter summary", "context", "video")
    assert len(v_fups1) == 3
    v_fups2 = rag_service.generate_follow_up_questions("overview of video", "context", "video")
    assert len(v_fups2) == 3
    v_fups3 = rag_service.generate_follow_up_questions("something else", "context", "video")
    assert len(v_fups3) == 3

    # Document branches
    d_fups_tech = rag_service.generate_follow_up_questions("tech stack and backend", "context", "pdf")
    assert any("test coverage" in f.lower() or "database" in f.lower() for f in d_fups_tech)
    
    d_fups_test = rag_service.generate_follow_up_questions("pytest unit test coverage", "context", "pdf")
    assert any("deliverables" in f.lower() or "features" in f.lower() for f in d_fups_test)

    d_fups_deliv = rag_service.generate_follow_up_questions("submission deliverables on github", "context", "pdf")
    assert any("readme" in f.lower() or "scoring" in f.lower() for f in d_fups_deliv)

    d_fups_db = rag_service.generate_follow_up_questions("sql or nosql database storage", "context", "pdf")
    assert any("vector" in f.lower() or "upload" in f.lower() for f in d_fups_db)

    d_fups_sum = rag_service.generate_follow_up_questions("summarize what is this document", "context", "pdf")
    assert any("tech stack" in f.lower() or "test coverage" in f.lower() for f in d_fups_sum)

    # Fallback branch with keywords in context
    d_fups_fall = rag_service.generate_follow_up_questions(
        "general question",
        "We need 95% coverage for backend with fastapi and deliverables on github",
        "pdf"
    )
    assert len(d_fups_fall) == 3

    # Prompt with chat history
    chat_hist = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there!"}
    ]
    prompt_with_hist = rag_service.generate_prompt("Next question", "Some context", "pdf", chat_hist)
    assert "RECENT CONVERSATION HISTORY:" in prompt_with_hist
    assert "User: Hello" in prompt_with_hist
    assert "Assistant: Hi there!" in prompt_with_hist

    # Deterministic answer with no citations
    no_cites_ans = rag_service._generate_deterministic_answer("query", [], "pdf")
    assert "no specific passages matched" in no_cites_ans


def test_vector_service_and_document_edges():
    vs = VectorService()
    # Empty chunks indexing
    vs.index_chunks("empty-doc", [])
    assert vs.search("empty-doc", "query") == []

    # Corrupt vectorizer transform mock
    doc_id = "test-corrupt-doc"
    vs.index_chunks(doc_id, [{"text": "Sample text", "metadata": {}}])
    
    class BrokenVectorizer:
        def transform(self, texts):
            raise RuntimeError("Corrupted matrix")
    
    vs.doc_vectorizers[doc_id] = BrokenVectorizer()
    res = vs.search(doc_id, "Sample text")
    assert len(res) == 1

    # Client getters with empty key
    assert rag_service._get_client("") is None
    assert summary_service._get_client("") is None
    assert transcription_service._get_client("") is None

    # Time parsing edge
    assert parse_timestamp_to_seconds("01:02:03") == 3723.0
    assert parse_timestamp_to_seconds("[00:15.5]") == 15.5


def test_database_manager_session():
    """Test db_manager.session successful commit and rollback on exception."""
    from app.core.database import db_manager
    with db_manager.session() as conn:
        assert conn is not None

    with pytest.raises(ValueError):
        with db_manager.session() as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS _test_roll (x INT)")
            conn.execute("INSERT INTO _test_roll VALUES (1)")
            raise ValueError("Forced test rollback")


def test_cors_origins_parsing():
    """Test Settings.parse_cors_origins with various string and list formats."""
    from app.core.config import Settings
    
    # 1. Asterisk
    s1 = Settings(CORS_ORIGINS="*")
    assert s1.CORS_ORIGINS == ["*"]

    # 2. Empty string
    s2 = Settings(CORS_ORIGINS="")
    assert s2.CORS_ORIGINS == ["*"]

    # 3. Comma-separated string
    s3 = Settings(CORS_ORIGINS="https://ai-multimedia-psi.vercel.app, http://localhost:3000")
    assert "https://ai-multimedia-psi.vercel.app" in s3.CORS_ORIGINS
    assert "http://localhost:3000" in s3.CORS_ORIGINS

    # 4. JSON list string
    s4 = Settings(CORS_ORIGINS='["https://ai-multimedia-psi.vercel.app"]')
    assert s4.CORS_ORIGINS == ["https://ai-multimedia-psi.vercel.app"]

    # 5. Native list
    s5 = Settings(CORS_ORIGINS=["https://example.com"])
    assert s5.CORS_ORIGINS == ["https://example.com"]

    # 6. Fallback non-string/non-list
    s6 = Settings(CORS_ORIGINS=123)
    assert s6.CORS_ORIGINS == ["*"]


def test_database_manager_mongo_url_handling():
    """Test DatabaseManager safely handles mongodb URLs without sqlite failure."""
    from app.core.database import DatabaseManager
    dm = DatabaseManager("mongodb+srv://user:pass@cluster0.ieebzgz.mongodb.net/test")
    assert dm.db_path == "psi.db"


@pytest.mark.asyncio
async def test_main_app_lifespan():
    """Test main FastAPI lifespan execution and graceful error resilience."""
    from app.main import lifespan, app
    from unittest.mock import patch, PropertyMock
    from app.core.mongo import MongoManager

    with patch("app.core.database.db_manager.init_db", side_effect=Exception("DB init err")), \
         patch.object(MongoManager, "is_configured", new_callable=PropertyMock, return_value=True), \
         patch("app.core.mongo.mongo_manager.connect", side_effect=Exception("Mongo err")), \
         patch("app.core.mongo.mongo_manager.close", side_effect=Exception("Close err")):
        async with lifespan(app):
            pass

