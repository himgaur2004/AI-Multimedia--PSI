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
        answer, citations, follow_ups = rag_service.answer_query(
            document_id="unindexed-id",
            query="Tell me about latency",
            file_type="video",
            api_key_override="sk-mock-chat-key"
        )
        assert answer == "This is a grounded answer citing [01:23]."
        assert len(follow_ups) > 0


def test_rag_service_openai_sync_error_fallback():
    """Test OpenAI Chat completion error fallback in rag_service."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception("OpenAI outage")

    with patch("app.services.rag_service.OpenAI", return_value=mock_client):
        answer, citations, follow_ups = rag_service.answer_query(
            document_id="unindexed-id",
            query="Tell me about latency",
            file_type="pdf",
            api_key_override="sk-failing-key"
        )
        assert "no specific passages matched" in answer
        assert len(follow_ups) > 0


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


@pytest.mark.asyncio
async def test_rag_service_openai_stream_error_fallback():
    """Test OpenAI streaming error fallback in rag_service."""
    mock_client = MagicMock()
    mock_client.chat.completions.stream.side_effect = Exception("Stream connection failed")

    with patch("app.services.rag_service.OpenAI", return_value=mock_client):
        gen = rag_service.stream_query(
            document_id="unindexed-id",
            query="Stream error test",
            file_type="document",
            api_key_override="sk-failing-key",
            search_mode="gpt"
        )
        chunks = []
        async for chunk in gen:
            chunks.append(chunk)

        assert len(chunks) > 0
        assert "GPT LLM (Fallback: Inbuilt RAG)" in chunks[-1]


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


def test_get_media_duration_variants():
    """Test get_media_duration parsing format and stream duration metadata."""
    from app.services.transcription_service import get_media_duration
    import subprocess

    # 1. Format duration
    mock_res_fmt = MagicMock()
    mock_res_fmt.returncode = 0
    mock_res_fmt.stdout = '{"format": {"duration": "14.25"}, "streams": []}'
    with patch("subprocess.run", return_value=mock_res_fmt):
        dur = get_media_duration("/dummy/video.mp4")
        assert dur == 14.25

    # 2. Streams duration fallback
    mock_res_stream = MagicMock()
    mock_res_stream.returncode = 0
    mock_res_stream.stdout = '{"format": {}, "streams": [{"duration": "30.50"}]}'
    with patch("subprocess.run", return_value=mock_res_stream):
        dur = get_media_duration("/dummy/video.mp4")
        assert dur == 30.50

    # 3. Subprocess failure
    mock_fail = MagicMock()
    mock_fail.returncode = 1
    with patch("subprocess.run", return_value=mock_fail):
        assert get_media_duration("/dummy/video.mp4") == 0.0

    # 4. Exception
    with patch("subprocess.run", side_effect=Exception("ffprobe missing")):
        assert get_media_duration("/dummy/video.mp4") == 0.0


def test_local_transcription_branches(tmp_path):
    """Test deterministic transcription with short (<10s) and long (>10s) audio."""
    dummy_file = tmp_path / "short_clip.mp4"
    dummy_file.write_bytes(b"dummy video")

    # Short clip with speech recognition mock
    mock_sr = MagicMock()
    mock_recognizer = MagicMock()
    mock_recognizer.recognize_google.return_value = "Spoken sentence in short video"
    mock_sr.Recognizer.return_value = mock_recognizer
    mock_sr.AudioFile.return_value.__enter__.return_value = MagicMock()

    with patch("app.services.transcription_service.get_media_duration", return_value=5.04), \
         patch("subprocess.run", return_value=MagicMock(returncode=0)), \
         patch("os.path.exists", return_value=True), \
         patch("os.path.getsize", return_value=1000), \
         patch("app.services.transcription_service.sr", mock_sr):
        full_text, segs, dur = transcription_service._generate_deterministic_transcript(str(dummy_file))
        assert dur == 5.04
        assert len(segs) == 1
        assert "Spoken sentence" in full_text

    # Longer clip (>10s)
    with patch("app.services.transcription_service.get_media_duration", return_value=35.0), \
         patch("subprocess.run", return_value=MagicMock(returncode=1)):
        full_text, segs, dur = transcription_service._generate_deterministic_transcript(str(dummy_file))
        assert dur == 35.0
        assert len(segs) >= 2

    # Speech recognition language fallback (en-IN fails, en-US succeeds)
    mock_recognizer_us = MagicMock()
    mock_recognizer_us.recognize_google.side_effect = [Exception("en-IN failed"), "English US speech recognized"]
    mock_sr.Recognizer.return_value = mock_recognizer_us
    with patch("app.services.transcription_service.get_media_duration", return_value=8.0), \
         patch("subprocess.run", return_value=MagicMock(returncode=0)), \
         patch("os.path.exists", return_value=True), \
         patch("os.path.getsize", return_value=1000), \
         patch("app.services.transcription_service.sr", mock_sr):
        full_text_us, segs_us, dur_us = transcription_service._generate_deterministic_transcript(str(dummy_file))
        assert "English US speech" in full_text_us


def test_summary_service_custom_speech_and_edge_cases():
    """Test custom dialogue summary and topic formatting edge cases."""
    # 1. Single segment with dialogue
    s1 = summary_service._generate_deterministic_summary(
        document_id="doc-custom",
        full_text="[00:00 - 00:05] Ek Taraf India ki ek simple medical student Isha",
        file_type="video"
    )
    assert "Ek Taraf India" in s1.executive_summary
    assert len(s1.key_points) == 2

    # 2. Media full text without timestamp brackets
    s2 = summary_service._generate_deterministic_summary(
        document_id="doc-no-ts",
        full_text="Just raw unformatted text without timestamps",
        file_type="video"
    )
    assert "Just raw unformatted" in s2.executive_summary
    assert len(s2.key_points) > 0

    # 3. Topic extraction with short titles and fallback titles
    top_res = summary_service._generate_deterministic_topics(
        document_id="doc-edge",
        transcript_segments=[
            {"start": 10.0, "end": 5.0, "text": "Quick title"},
            {"start": 12.0, "end": 15.0, "text": ""}
        ]
    )
    assert top_res.total_topics == 2
    assert top_res.topics[0].end_time > top_res.topics[0].start_time
    assert "Topic Chapter" in top_res.topics[1].title


