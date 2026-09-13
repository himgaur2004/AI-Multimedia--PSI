"""
Tests for Document & Multimedia Ingestion API.
"""

import io
from fastapi import status


def test_upload_pdf_success(client, auth_headers, sample_pdf_bytes):
    files = {"file": ("report.pdf", sample_pdf_bytes, "application/pdf")}
    response = client.post("/api/v1/documents/upload", files=files, headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["file_type"] == "pdf"
    assert data["original_name"] == "report.pdf"
    assert data["processed"] is True
    assert "summary" in data
    assert data["id"] is not None


def test_upload_audio_success(client, auth_headers):
    # Simulated audio payload
    audio_bytes = b"ID3\x03\x00\x00\x00\x00\x00#TSSE\x00\x00\x00\x0f\x00\x00\x03Lavf58.29.100" + b"\x00" * 200
    files = {"file": ("interview.mp3", audio_bytes, "audio/mpeg")}
    response = client.post("/api/v1/documents/upload", files=files, headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["file_type"] == "audio"
    assert data["original_name"] == "interview.mp3"
    assert len(data["transcript_segments"]) > 0
    assert len(data["topics"]) > 0
    assert data["duration_seconds"] > 0


def test_upload_video_success(client, auth_headers):
    # Simulated video payload
    video_bytes = b"\x00\x00\x00 ftypisom\x00\x00\x02\x00isomiso2mp41\x00\x00\x00\x08free" + b"\x00" * 300
    files = {"file": ("lecture.mp4", video_bytes, "video/mp4")}
    response = client.post("/api/v1/documents/upload", files=files, headers=auth_headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["file_type"] == "video"
    assert data["original_name"] == "lecture.mp4"
    assert len(data["transcript_segments"]) > 0
    # First segment should have start/end timestamp
    seg = data["transcript_segments"][0]
    assert "start" in seg
    assert "end" in seg
    assert "formatted_start" in seg


def test_upload_unsupported_file_extension(client, auth_headers):
    files = {"file": ("malicious.exe", b"binary content", "application/octet-stream")}
    response = client.post("/api/v1/documents/upload", files=files, headers=auth_headers)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Unsupported file format" in response.json()["detail"]


def test_upload_unauthenticated(client, sample_pdf_bytes):
    files = {"file": ("test.pdf", sample_pdf_bytes, "application/pdf")}
    response = client.post("/api/v1/documents/upload", files=files)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_list_documents(client, auth_headers, sample_pdf_bytes):
    # Initial empty state
    resp_init = client.get("/api/v1/documents/list", headers=auth_headers)
    assert resp_init.status_code == status.HTTP_200_OK
    assert resp_init.json()["total"] == 0

    # Upload document
    client.post("/api/v1/documents/upload", files={"file": ("test.pdf", sample_pdf_bytes, "application/pdf")}, headers=auth_headers)
    
    resp_list = client.get("/api/v1/documents/list", headers=auth_headers)
    assert resp_list.status_code == status.HTTP_200_OK
    data = resp_list.json()
    assert data["total"] == 1
    assert data["documents"][0]["original_name"] == "test.pdf"


def test_get_document_details(client, auth_headers, sample_pdf_bytes):
    upload_resp = client.post("/api/v1/documents/upload", files={"file": ("test.pdf", sample_pdf_bytes, "application/pdf")}, headers=auth_headers)
    doc_id = upload_resp.json()["id"]

    resp = client.get(f"/api/v1/documents/{doc_id}", headers=auth_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["id"] == doc_id
    assert "full_text" in data
    assert "summary" in data


def test_get_document_not_found(client, auth_headers):
    resp = client.get("/api/v1/documents/nonexistent-id", headers=auth_headers)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_delete_document_success(client, auth_headers, sample_pdf_bytes):
    upload_resp = client.post("/api/v1/documents/upload", files={"file": ("test.pdf", sample_pdf_bytes, "application/pdf")}, headers=auth_headers)
    doc_id = upload_resp.json()["id"]

    # Delete
    del_resp = client.delete(f"/api/v1/documents/{doc_id}", headers=auth_headers)
    assert del_resp.status_code == status.HTTP_204_NO_CONTENT

    # Confirm gone
    get_resp = client.get(f"/api/v1/documents/{doc_id}", headers=auth_headers)
    assert get_resp.status_code == status.HTTP_404_NOT_FOUND


def test_delete_document_not_found(client, auth_headers):
    resp = client.delete("/api/v1/documents/nonexistent-uuid", headers=auth_headers)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_multi_user_document_isolation(client, auth_headers, other_auth_headers, sample_pdf_bytes):
    # User 1 uploads document
    upload_resp = client.post("/api/v1/documents/upload", files={"file": ("private.pdf", sample_pdf_bytes, "application/pdf")}, headers=auth_headers)
    doc_id = upload_resp.json()["id"]

    # User 2 cannot access or list it
    other_list = client.get("/api/v1/documents/list", headers=other_auth_headers)
    assert other_list.json()["total"] == 0

    other_get = client.get(f"/api/v1/documents/{doc_id}", headers=other_auth_headers)
    assert other_get.status_code == status.HTTP_404_NOT_FOUND


def test_upload_text_file_success(client, auth_headers):
    files = {"file": ("notes.txt", b"Antigravity AI Document System and semantic vector search architecture.", "text/plain")}
    resp = client.post("/api/v1/documents/upload", files=files, headers=auth_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["file_type"] == "text"
    assert data["original_name"] == "notes.txt"
    assert "vector search" in data["full_text"]


def test_upload_no_filename(client, auth_headers):
    files = {"file": ("", b"hello", "text/plain")}
    resp = client.post("/api/v1/documents/upload", files=files, headers=auth_headers)
    assert resp.status_code in {status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY}


