"""
Tests for Chat, Streaming Q&A, and Citation Grounding API.
"""

import json
from fastapi import status


def test_chat_with_pdf_document(client, auth_headers, sample_pdf_bytes):
    # Upload PDF
    up = client.post("/api/v1/documents/upload", files={"file": ("doc.pdf", sample_pdf_bytes, "application/pdf")}, headers=auth_headers)
    doc_id = up.json()["id"]

    # Ask question
    resp = client.post(
        f"/api/v1/documents/{doc_id}/chat",
        json={"message": "What is the system overview about?"},
        headers=auth_headers
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert "answer" in data
    assert len(data["citations"]) > 0
    assert data["citations"][0]["source"] == "pdf"


def test_chat_with_media_document_has_timestamps(client, auth_headers):
    # Upload audio file
    audio_bytes = b"ID3\x03\x00\x00\x00\x00\x00#TSSE" + b"\x00" * 200
    up = client.post("/api/v1/documents/upload", files={"file": ("talk.mp3", audio_bytes, "audio/mpeg")}, headers=auth_headers)
    doc_id = up.json()["id"]

    # Ask question about transcription
    resp = client.post(
        f"/api/v1/documents/{doc_id}/chat",
        json={"message": "What is discussed about speech transcription?"},
        headers=auth_headers
    )
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert "answer" in data
    assert len(data["citations"]) > 0
    # Must contain timestamp citation for media
    cit = data["citations"][0]
    assert cit["start_time"] is not None
    assert cit["formatted_timestamp"] is not None


def test_chat_streaming_sse(client, auth_headers, sample_pdf_bytes):
    up = client.post("/api/v1/documents/upload", files={"file": ("doc.pdf", sample_pdf_bytes, "application/pdf")}, headers=auth_headers)
    doc_id = up.json()["id"]

    # Stream query
    resp = client.post(
        f"/api/v1/documents/{doc_id}/chat/stream",
        json={"message": "Explain the architecture"},
        headers=auth_headers
    )
    assert resp.status_code == status.HTTP_200_OK
    assert "text/event-stream" in resp.headers["content-type"]
    
    # Parse SSE events from response body
    lines = resp.text.strip().split("\n\n")
    assert len(lines) > 1
    
    found_chunk = False
    found_done = False
    for event in lines:
        if event.startswith("data: "):
            payload = json.loads(event.replace("data: ", ""))
            if "chunk" in payload:
                found_chunk = True
            if payload.get("done") is True:
                found_done = True
                assert "citations" in payload
                
    assert found_chunk is True
    assert found_done is True


def test_chat_history_recording(client, auth_headers, sample_pdf_bytes):
    up = client.post("/api/v1/documents/upload", files={"file": ("doc.pdf", sample_pdf_bytes, "application/pdf")}, headers=auth_headers)
    doc_id = up.json()["id"]

    # Send 2 queries
    client.post(f"/api/v1/documents/{doc_id}/chat", json={"message": "First query"}, headers=auth_headers)
    client.post(f"/api/v1/documents/{doc_id}/chat", json={"message": "Second query"}, headers=auth_headers)

    # Retrieve history
    history_resp = client.get(f"/api/v1/documents/{doc_id}/messages", headers=auth_headers)
    assert history_resp.status_code == status.HTTP_200_OK
    messages = history_resp.json()
    assert len(messages) == 4  # 2 user messages + 2 assistant answers
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "First query"
    assert messages[1]["role"] == "assistant"


def test_chat_nonexistent_document(client, auth_headers):
    resp = client.post(
        "/api/v1/documents/nonexistent-id/chat",
        json={"message": "Hello?"},
        headers=auth_headers
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_chat_unauthorized_access(client, auth_headers, other_auth_headers, sample_pdf_bytes):
    up = client.post("/api/v1/documents/upload", files={"file": ("doc.pdf", sample_pdf_bytes, "application/pdf")}, headers=auth_headers)
    doc_id = up.json()["id"]

    # Other user attempts to chat with it
    resp = client.post(
        f"/api/v1/documents/{doc_id}/chat",
        json={"message": "Can I see this?"},
        headers=other_auth_headers
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND
