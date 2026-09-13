"""
Tests for Document Summaries and Topic Chapters API.
"""

from fastapi import status


def test_get_summary_pdf(client, auth_headers, sample_pdf_bytes):
    up = client.post("/api/v1/documents/upload", files={"file": ("doc.pdf", sample_pdf_bytes, "application/pdf")}, headers=auth_headers)
    doc_id = up.json()["id"]

    resp = client.get(f"/api/v1/documents/{doc_id}/summary", headers=auth_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["document_id"] == doc_id
    assert "executive_summary" in data
    assert len(data["key_points"]) > 0
    assert data["word_count"] > 0


def test_get_summary_video(client, auth_headers):
    video_bytes = b"\x00\x00\x00 ftypisom" + b"\x00" * 300
    up = client.post("/api/v1/documents/upload", files={"file": ("clip.mp4", video_bytes, "video/mp4")}, headers=auth_headers)
    doc_id = up.json()["id"]

    resp = client.get(f"/api/v1/documents/{doc_id}/summary", headers=auth_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["document_id"] == doc_id
    assert "executive_summary" in data
    assert any("[00:" in pt for pt in data["key_points"])


def test_get_summary_not_found(client, auth_headers):
    resp = client.get("/api/v1/documents/nonexistent-doc/summary", headers=auth_headers)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_get_topics_multimedia(client, auth_headers):
    # Upload video
    video_bytes = b"\x00\x00\x00 ftypisom" + b"\x00" * 300
    up = client.post("/api/v1/documents/upload", files={"file": ("clip.mp4", video_bytes, "video/mp4")}, headers=auth_headers)
    doc_id = up.json()["id"]

    resp = client.get(f"/api/v1/documents/{doc_id}/topics", headers=auth_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["document_id"] == doc_id
    assert data["total_topics"] > 0
    
    # Check chapter structure
    first_topic = data["topics"][0]
    assert "title" in first_topic
    assert "start_time" in first_topic
    assert "end_time" in first_topic
    assert "formatted_start" in first_topic
    assert "formatted_end" in first_topic
    assert first_topic["end_time"] > first_topic["start_time"]


def test_get_topics_not_found(client, auth_headers):
    resp = client.get("/api/v1/documents/nonexistent-doc/topics", headers=auth_headers)
    assert resp.status_code == status.HTTP_404_NOT_FOUND
