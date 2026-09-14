"""
Unit and Integration Tests for Gemini Service and LangChain RAG Search Modes.
Ensures >95% backend coverage across all AI pipelines and error fallback branches.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import httpx

from app.schemas.chat import Citation
from app.services.gemini_service import GeminiService, gemini_service
from app.services.rag_service import RAGService


# ─── 1. Gemini Service Unit Tests ─────────────────────────────────────────────

def test_gemini_service_config_resolution():
    svc = GeminiService()
    key, model = svc._resolve_config("custom_key", "custom_model")
    assert key == "custom_key"
    assert model == "custom_model"

    # Test with no key raises in generate_response
    svc.default_api_key = ""
    with pytest.raises(ValueError, match="Gemini API key is required"):
        svc.generate_response("test", api_key="")


def test_gemini_generate_response_success():
    svc = GeminiService()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [
            {
                "content": {
                    "parts": [{"text": "Gemini answer text."}]
                }
            }
        ]
    }
    with patch("httpx.Client.post", return_value=mock_resp):
        ans = svc.generate_response("Test prompt", api_key="test_gemini_key", model="gemini-1.5-flash")
        assert ans == "Gemini answer text."


def test_gemini_generate_response_empty_candidates():
    svc = GeminiService()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"candidates": []}
    with patch("httpx.Client.post", return_value=mock_resp):
        ans = svc.generate_response("Test prompt", api_key="test_gemini_key")
        assert ans == ""


@pytest.mark.asyncio
async def test_gemini_stream_response_requires_key():
    svc = GeminiService()
    svc.default_api_key = ""
    with pytest.raises(ValueError, match="Gemini API key is required"):
        async for _ in svc.stream_response("test", api_key=""):
            pass


@pytest.mark.asyncio
async def test_gemini_stream_response_success_and_edge_lines():
    svc = GeminiService()

    class MockAsyncResponse:
        def raise_for_status(self):
            pass

        async def aiter_lines(self):
            # Comments, invalid lines, valid JSON
            yield ": ping"
            yield "data: "
            yield "data: invalid_json"
            yield 'data: {"candidates": [{"content": {"parts": [{"text": "Hello "}]}}]}'
            yield 'data: {"candidates": [{"content": {"parts": [{"text": "Gemini!"}]}}]}'

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        def stream(self, method, url, **kwargs):
            mock_stream_ctx = MagicMock()
            mock_stream_ctx.__aenter__ = AsyncMock(return_value=MockAsyncResponse())
            mock_stream_ctx.__aexit__ = AsyncMock(return_value=None)
            return mock_stream_ctx

    with patch("httpx.AsyncClient", MockAsyncClient):
        chunks = []
        async for token in svc.stream_response("Stream test", api_key="test_gemini_key"):
            chunks.append(token)

        assert "".join(chunks) == "Hello Gemini!"


# ─── 2. RAG Service Gemini & LangChain Branches ──────────────────────────────

def test_rag_service_gemini_sync_success():
    rag = RAGService()
    dummy_cits = [Citation(source="pdf", page=1, snippet="Doc snippet")]

    with patch.object(rag, "build_context", return_value=("Context text", dummy_cits)), \
         patch.object(gemini_service, "generate_response", return_value="Gemini generated response."):

        ans, cits, fups = rag.answer_query(
            document_id="doc_gemini_1",
            query="Tell me about chapter 1",
            gemini_api_key_override="valid_gemini_key",
            search_mode="gemini"
        )
        assert ans == "Gemini generated response."
        assert "Google Gemini" in rag.last_engine
        assert "Gemini LLM Generation" in rag.last_retrieval_method


def test_rag_service_gemini_sync_error_and_no_key_fallback():
    rag = RAGService()
    dummy_cits = [Citation(source="pdf", page=1, snippet="Doc snippet")]

    with patch.object(rag, "build_context", return_value=("Context text", dummy_cits)):
        # Case A: Error during generate_response
        with patch.object(gemini_service, "generate_response", side_effect=Exception("API key not valid (403)")):
            ans, cits, fups = rag.answer_query(
                document_id="doc_gemini_err",
                query="Query error test",
                gemini_api_key_override="bad_key",
                search_mode="gemini"
            )
            assert ans != ""
            assert "Gemini LLM (Fallback: Inbuilt RAG)" in rag.last_engine
            assert "Invalid API Key" in rag.last_engine

        # Case B: No Gemini key provided
        ans2, cits2, fups2 = rag.answer_query(
            document_id="doc_gemini_nokey",
            query="Query no key test",
            gemini_api_key_override="",
            search_mode="gemini"
        )
        assert ans2 != ""
        assert "No API Key Provided" in rag.last_engine


@pytest.mark.asyncio
async def test_rag_service_gemini_stream_success_and_fallback():
    rag = RAGService()
    dummy_cits = [Citation(source="pdf", page=1, snippet="Doc snippet")]

    async def mock_stream_tokens(*args, **kwargs):
        for token in ["Gemini ", "stream ", "works!"]:
            yield token

    with patch.object(rag, "build_context", return_value=("Context text", dummy_cits)):
        # Success stream
        with patch.object(gemini_service, "stream_response", side_effect=mock_stream_tokens):
            events = []
            async for frame in rag.stream_query(
                document_id="doc_gemini_stream_1",
                query="Stream test",
                gemini_api_key_override="test_key",
                search_mode="gemini"
            ):
                events.append(frame)

            assert any("Gemini " in ev for ev in events)
            assert any('"done": true' in ev for ev in events)

        # Fallback stream (error occurred)
        async def mock_stream_error(*args, **kwargs):
            raise Exception("Quota exceeded 429")
            yield "never"

        with patch.object(gemini_service, "stream_response", side_effect=mock_stream_error):
            fallback_events = []
            async for frame in rag.stream_query(
                document_id="doc_gemini_stream_err",
                query="Stream error test",
                gemini_api_key_override="test_key",
                search_mode="gemini"
            ):
                fallback_events.append(frame)

            assert len(fallback_events) > 0
            assert any('"done": true' in ev for ev in fallback_events)


def test_rag_service_langchain_sync_branches():
    rag = RAGService()
    dummy_cits = [Citation(source="pdf", page=1, snippet="LangChain snippet")]

    with patch.object(rag, "build_context", return_value=("LangChain context", dummy_cits)):
        # 1. With Gemini key
        with patch.object(gemini_service, "generate_response", return_value="LangChain + Gemini answer"):
            ans, cits, _ = rag.answer_query(
                document_id="doc_lc_1",
                query="Query LC 1",
                gemini_api_key_override="gemini_lc_key",
                search_mode="langchain"
            )
            assert ans == "LangChain + Gemini answer"
            assert "LangChain + Gemini" in rag.last_engine

        # 2. With Gemini error -> fallback
        with patch.object(gemini_service, "generate_response", side_effect=Exception("Network error")):
            ans, _, _ = rag.answer_query(
                document_id="doc_lc_2",
                query="Query LC 2",
                gemini_api_key_override="gemini_lc_key",
                search_mode="langchain"
            )
            assert ans != ""

        # 3. With OpenAI key
        mock_openai_client = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock(message=MagicMock(content="LangChain + OpenAI answer"))]
        mock_openai_client.chat.completions.create.return_value = mock_completion

        with patch.object(rag, "_get_client", return_value=mock_openai_client):
            ans, _, _ = rag.answer_query(
                document_id="doc_lc_3",
                query="Query LC 3",
                api_key_override="openai_key",
                search_mode="langchain"
            )
            assert ans == "LangChain + OpenAI answer"
            assert "LangChain + OpenAI" in rag.last_engine

        # 4. With OpenAI error -> fallback
        mock_openai_client.chat.completions.create.side_effect = Exception("OpenAI down")
        with patch.object(rag, "_get_client", return_value=mock_openai_client):
            ans, _, _ = rag.answer_query(
                document_id="doc_lc_4",
                query="Query LC 4",
                api_key_override="openai_key",
                search_mode="langchain"
            )
            assert ans != ""

        # 5. Without keys -> deterministic answer
        ans, _, _ = rag.answer_query(
            document_id="doc_lc_5",
            query="Query LC 5",
            search_mode="langchain"
        )
        assert ans != ""
        assert "LangChain Retrieval Engine" in rag.last_engine


@pytest.mark.asyncio
async def test_rag_service_langchain_stream_branches():
    rag = RAGService()
    dummy_cits = [Citation(source="pdf", page=1, snippet="LangChain snippet")]

    async def mock_gemini_tokens(*args, **kwargs):
        for token in ["LangChain ", "streamed ", "token"]:
            yield token

    with patch.object(rag, "build_context", return_value=("LangChain context", dummy_cits)):
        # 1. Stream with Gemini key
        with patch.object(gemini_service, "stream_response", side_effect=mock_gemini_tokens):
            events = []
            async for frame in rag.stream_query(
                document_id="doc_lc_str_1",
                query="LC stream test 1",
                gemini_api_key_override="gemini_key",
                search_mode="langchain"
            ):
                events.append(frame)
            assert any("LangChain " in ev for ev in events)

        # 2. Stream with OpenAI client
        mock_openai_client = MagicMock()
        mock_chunk1 = MagicMock()
        mock_chunk1.choices = [MagicMock(delta=MagicMock(content="OpenAI "))]
        mock_chunk2 = MagicMock()
        mock_chunk2.choices = [MagicMock(delta=MagicMock(content="token"))]
        mock_openai_client.chat.completions.create.return_value = [mock_chunk1, mock_chunk2]

        with patch.object(rag, "_get_client", return_value=mock_openai_client):
            events = []
            async for frame in rag.stream_query(
                document_id="doc_lc_str_2",
                query="LC stream test 2",
                api_key_override="openai_key",
                search_mode="langchain"
            ):
                events.append(frame)
            assert any("OpenAI " in ev for ev in events)

        # 3. Stream with no keys -> deterministic streaming
        events = []
        async for frame in rag.stream_query(
            document_id="doc_lc_str_3",
            query="LC stream test 3",
            search_mode="langchain"
        ):
            events.append(frame)
        assert any('"done": true' in ev for ev in events)


# ─── 3. Chat Endpoints with Gemini and LangChain ──────────────────────────────

def test_chat_endpoints_with_gemini_and_langchain(client, auth_headers):
    # Upload test document
    upload_res = client.post(
        "/api/v1/documents/upload",
        files={"file": ("test_doc.txt", b"PSI document content about artificial intelligence algorithms.", "text/plain")},
        headers=auth_headers
    )
    assert upload_res.status_code in (200, 201)
    doc_id = upload_res.json()["id"]

    # 1. Standard chat endpoint with search_mode="gemini"
    chat_payload = {
        "message": "What is this file about?",
        "gemini_api_key_override": "gemini_mock_key",
        "search_mode": "gemini"
    }
    with patch.object(gemini_service, "generate_response", return_value="This is about AI algorithms from Gemini."):
        resp = client.post(f"/api/v1/documents/{doc_id}/chat", json=chat_payload, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "Google Gemini" in data["engine"]
        assert data["answer"] == "This is about AI algorithms from Gemini."

    # 2. SSE streaming chat endpoint with search_mode="langchain"
    stream_payload = {
        "message": "Explain details with LangChain",
        "gemini_api_key_override": "gemini_mock_key",
        "search_mode": "langchain"
    }
    async def mock_tokens(*args, **kwargs):
        yield "Streamed "
        yield "from "
        yield "Gemini"

    with patch.object(gemini_service, "stream_response", side_effect=mock_tokens):
        stream_resp = client.post(f"/api/v1/documents/{doc_id}/chat/stream", json=stream_payload, headers=auth_headers)
        assert stream_resp.status_code == 200
        content = stream_resp.text
        assert "Streamed " in content
        assert '"done": true' in content
