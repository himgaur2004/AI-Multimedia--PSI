"""
Tests for Media Streaming & RFC 7233 Byte-Range API.
"""

from fastapi import status


def test_media_stream_full(client, auth_headers):
    # Upload video
    media_data = b"HEAD" + (b"DATA" * 50)  # 204 bytes
    up = client.post("/api/v1/documents/upload", files={"file": ("video.mp4", media_data, "video/mp4")}, headers=auth_headers)
    doc_id = up.json()["id"]

    # Stream full file
    resp = client.get(f"/api/v1/media/{doc_id}/stream")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.headers["accept-ranges"] == "bytes"
    assert int(resp.headers["content-length"]) == len(media_data)
    assert resp.content == media_data


def test_media_stream_range_partial_content(client, auth_headers):
    media_data = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"  # 36 bytes
    up = client.post("/api/v1/documents/upload", files={"file": ("sample.mp4", media_data, "video/mp4")}, headers=auth_headers)
    doc_id = up.json()["id"]

    # Request range bytes 0-9 (first 10 bytes)
    headers = {"Range": "bytes=0-9"}
    resp = client.get(f"/api/v1/media/{doc_id}/stream", headers=headers)
    assert resp.status_code == status.HTTP_206_PARTIAL_CONTENT
    assert resp.headers["content-range"] == f"bytes 0-9/{len(media_data)}"
    assert resp.content == media_data[0:10]

    # Request range bytes 10-19
    headers = {"Range": "bytes=10-19"}
    resp2 = client.get(f"/api/v1/media/{doc_id}/stream", headers=headers)
    assert resp2.status_code == status.HTTP_206_PARTIAL_CONTENT
    assert resp2.content == media_data[10:20]


def test_media_stream_invalid_range(client, auth_headers):
    media_data = b"1234567890"
    up = client.post("/api/v1/documents/upload", files={"file": ("clip.mp3", media_data, "audio/mpeg")}, headers=auth_headers)
    doc_id = up.json()["id"]

    # Invalid range exceeding file size
    headers = {"Range": "bytes=50-100"}
    resp = client.get(f"/api/v1/media/{doc_id}/stream", headers=headers)
    assert resp.status_code == status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE

    # Malformed range
    headers_malformed = {"Range": "invalid-range"}
    resp_malformed = client.get(f"/api/v1/media/{doc_id}/stream", headers=headers_malformed)
    assert resp_malformed.status_code == status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE


def test_media_stream_not_found(client):
    resp = client.get("/api/v1/media/nonexistent-doc/stream")
    assert resp.status_code == status.HTTP_404_NOT_FOUND
