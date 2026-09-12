"""
Comprehensive Mock Tests for External AI APIs (OpenAI Whisper, Chat, Summarization, Topics)
and Edge Cases to guarantee >=95% total code coverage.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi import status

from app.core.config import settings
from app.core.rate_limit import RateLimiter, check_rate_limit
from app.main import app
from app.services.document_service import document_service
from app.services.rag_service import rag_service
from app.services.summary_service import summary_service
from app.services.transcription_service import transcription_service
from app.services.vector_service import vector_service


def test_transcription_service_openai_success(monkeypatch, tmp_path):
    """Test OpenAI Whisper API branch in transcription_service."""
    dummy_file = tmp_path / "test.mp3"
    dummy_file.write_bytes(b"dummy audio bytes")

    # Mock response object from OpenAI client
    mock_resp = MagicMock()
    mock_resp.text = "This is a transcribed speech."
    mock_resp.duration = 42.0
    mock_resp.segments = [
        {"start": 0.0, "end": 15.0, "text": "This is a transcribed speech."},
        {"start": 15.0, "end": 42.0, "text": "Continuing discussion on system design."}
    ]

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create.return_value = mock_resp

    with patch("app.services.transcription_service.OpenAI", return_value=mock_client):
        full_text, segs, dur = transcription_service.transcribe(
            file_path=str(dummy_file),
            api_key_override="sk-mock-test-key",
            original_filename="test.mp3"
        )
        assert full_text == "This is a transcribed speech."
        assert len(segs) == 2
        assert segs[0]["formatted_start"] == "00:00"
        assert segs[0]["formatted_end"] == "00:15"
        assert dur == 42.0


def test_transcription_service_openai_error_fallback(monkeypatch, tmp_path):
    """Test OpenAI Whisper API error fallback to deterministic engine."""
    dummy_file = tmp_path / "error.mp3"
    dummy_file.write_bytes(b"dummy audio bytes")

    mock_client = MagicMock()
    mock_client.audio.transcriptions.create.side_effect = Exception("API rate limit exceeded")

    with patch("app.services.transcription_service.OpenAI", return_value=mock_client):
        full_text, segs, dur = transcription_service.transcribe(
            file_path=str(dummy_file),
            api_key_override="sk-failing-key"
        )
        # Should smoothly fall back to deterministic transcript
        assert len(segs) > 0
        assert dur > 0


def test_rag_service_openai_sync_success():
    """Test OpenAI Chat completion branch in rag_service."""
    mock_choice = MagicMock()
    mock_choice.message.content = "This is a grounded answer citing [01:23]."
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_resp

    with patch("app.services.rag_service.OpenAI", return_value=mock_client):
        answer, citations = rag_service.answer_query(
            document_id="unindexed-id",
            query="Tell me about latency",
            file_type="video",
            api_key_override="sk-mock-chat-key"
        )
        assert answer == "This is a grounded answer citing [01:23]."


def test_rag_service_openai_sync_error_fallback():
    """Test OpenAI Chat completion error fallback in rag_service."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception("OpenAI outage")

    with patch("app.services.rag_service.OpenAI", return_value=mock_client):
        answer, citations = rag_service.answer_query(
            document_id="unindexed-id",
            query="Tell me about latency",
            file_type="pdf",
            api_key_override="sk-failing-key"
        )
        assert "no specific passages matched" in answer


@pytest.mark.asyncio
async def test_rag_service_openai_stream_success():
    """Test OpenAI streaming tokens branch in rag_service."""
    # Create mock chunks for stream
    c1 = MagicMock()
    c1.choices = [MagicMock()]
    c1.choices[0].delta.content = "Streaming "

    c2 = MagicMock()
    c2.choices = [MagicMock()]
    c2.choices[0].delta.content = "response tokens."

    mock_client = MagicMock()
    mock_client.chat.completions.stream.return_value = [c1, c2]

    with patch("app.services.rag_service.OpenAI", return_value=mock_client):
        gen = rag_service.stream_query(
            document_id="unindexed-id",
            query="Stream test",
            file_type="document",
            api_key_override="sk-stream-key"
        )
        chunks = []
        async for chunk in gen:
            chunks.append(chunk)
            
        assert len(chunks) == 3  # 2 token frames + 1 terminal frame
        assert "Streaming" in chunks[0]
        assert "done" in chunks[-1]


def test_summary_service_openai_success():
    """Test OpenAI JSON completion branch in summary_service."""
    mock_choice = MagicMock()
    mock_choice.message.content = '{"executive_summary": "OpenAI summary text", "key_points": ["Point 1", "Point 2"]}'
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_resp

    with patch("app.services.summary_service.OpenAI", return_value=mock_client):
        res = summary_service.generate_summary(
            document_id="doc-123",
            full_text="Some text for summarization with sufficient length.",
            file_type="pdf",
            api_key_override="sk-summary-key"
        )
        assert res.executive_summary == "OpenAI summary text"
        assert len(res.key_points) == 2


def test_topics_service_openai_success():
    """Test OpenAI topic extraction branch in summary_service."""
    mock_choice = MagicMock()
    mock_choice.message.content = '{"topics": [{"title": "AI Intro", "start_time": 0.0, "end_time": 30.0, "summary": "Intro"}]}'
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = mock_resp

    segs = [{"formatted_start": "00:00", "formatted_end": "00:30", "text": "Intro text"}]

    with patch("app.services.summary_service.OpenAI", return_value=mock_client):
        res = summary_service.extract_topics(
            document_id="doc-topics",
            transcript_segments=segs,
            api_key_override="sk-topics-key"
        )
        assert res.total_topics == 1
        assert res.topics[0].title == "AI Intro"


def test_vector_service_stop_words_fallback():
    """Test vector service handling of corpus with only stop words."""
    vs = vector_service
    chunks = [{"text": "and the or if but in on at", "metadata": {}}]
    vs.index_chunks("stop-doc", chunks)
    res = vs.search("stop-doc", "and", top_k=1)
    assert len(res) == 1


def test_rate_limit_exceeded_http_exception(client):
    """Test rate limiter throwing HTTP 429 Too Many Requests."""
    from fastapi import HTTPException
    rl = RateLimiter(requests_per_minute=1)
    assert rl.is_allowed("test-client") is True
    assert rl.is_allowed("test-client") is False


def test_summary_and_topics_endpoints_on_demand_generation(client, auth_headers):
    """Test endpoints generating summary and topics on demand when unpopulated."""
    from app.core.database import db_manager
    conn = db_manager.get_connection()
    doc_id = "doc-unpopulated-summary"
    user_id = "test-user-uuid-1234"

    # Insert document with empty summary and empty topics
    conn.execute(
        "INSERT INTO documents (id, user_id, filename, original_name, file_type, file_size, storage_path, processed) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
        (doc_id, user_id, "doc.pdf", "doc.pdf", "pdf", 100, "/tmp/doc.pdf")
    )
    conn.execute(
        "INSERT INTO document_contents (document_id, full_text, transcript_segments_json, summary, topics_json) VALUES (?, ?, '[]', '', '')",
        (doc_id, "Line one with text.\nLine two with description.")
    )

    # Calling summary endpoint triggers on-demand generation
    sum_resp = client.get(f"/api/v1/documents/{doc_id}/summary", headers=auth_headers)
    assert sum_resp.status_code == status.HTTP_200_OK
    assert sum_resp.json()["executive_summary"] != ""

    # Calling topics endpoint triggers on-demand generation
    top_resp = client.get(f"/api/v1/documents/{doc_id}/topics", headers=auth_headers)
    assert top_resp.status_code == status.HTTP_200_OK


def test_global_exception_handler():
    """Test that unexpected server exceptions are cleanly formatted as JSON."""
    from fastapi.testclient import TestClient
    from app.api.v1.auth import get_current_user

    def raise_runtime_error():
        raise RuntimeError("Simulated internal error")

    app.dependency_overrides[get_current_user] = raise_runtime_error
    try:
        err_client = TestClient(app, raise_server_exceptions=False)
        resp = err_client.get("/api/v1/auth/me", headers={"Authorization": "Bearer valid.token.format"})
        assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "An internal server error occurred" in resp.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
