"""
Media Streaming Endpoint with HTTP Byte-Range Support.
Senior SDE Pattern: Implements RFC 7233 partial content streaming to enable
smooth scrubbing, timestamp seeking, and low-latency audio/video playback in browsers.
"""

import os
import sqlite3
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from fastapi.responses import FileResponse, Response

from app.core.database import get_db

router = APIRouter(prefix="/media", tags=["Media Streaming"])


@router.get("/{document_id}/stream")
def stream_media(
    document_id: str,
    request: Request,
    range: Optional[str] = Header(None),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Stream video/audio file with HTTP Range 206 support for instant timestamp seeking.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT storage_path, file_type, original_name FROM documents WHERE id = ?", (document_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found.")

    file_path = row["storage_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found on disk.")

    file_size = os.path.getsize(file_path)
    file_type = row["file_type"]
    ext = file_path.rsplit(".", 1)[-1].lower()

    # Determine MIME content type
    mime_types = {
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mov": "video/quicktime",
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "m4a": "audio/mp4",
        "pdf": "application/pdf"
    }
    content_type = mime_types.get(ext, "application/octet-stream")

    # If no Range header requested, serve full content
    if not range:
        return FileResponse(
            path=file_path,
            media_type=content_type,
            headers={"Accept-Ranges": "bytes", "Content-Length": str(file_size)}
        )

    # Parse Range header: 'bytes=start-end'
    try:
        range_value = range.strip().lower()
        if not range_value.startswith("bytes="):
            raise ValueError()
            
        byte_range = range_value[len("bytes="):]
        parts = byte_range.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1
        
        if start >= file_size or end >= file_size or start > end:
            raise ValueError()
    except ValueError:
        return Response(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"}
        )

    chunk_size = (end - start) + 1
    with open(file_path, "rb") as f:
        f.seek(start)
        data = f.read(chunk_size)

    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(chunk_size),
        "Content-Type": content_type,
    }
    return Response(content=data, status_code=status.HTTP_206_PARTIAL_CONTENT, headers=headers)
