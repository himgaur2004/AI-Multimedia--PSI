"""
Document and Multimedia Management Endpoints.
Handles file uploads, text extraction, speech transcription, vector indexing, and metadata retrieval.
"""

import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.v1.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import check_rate_limit
from app.schemas.document import DocumentDetailResponse, DocumentListResponse, DocumentResponse, TranscriptSegment
from app.services.document_service import document_service
from app.services.summary_service import summary_service
from app.services.transcription_service import transcription_service
from app.services.vector_service import vector_service

router = APIRouter(prefix="/documents", tags=["Documents & Multimedia"])


@router.post("/upload", response_model=DocumentDetailResponse, dependencies=[Depends(check_rate_limit)])
async def upload_document(
    file: UploadFile = File(...),
    api_key_override: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Upload and process a document (PDF) or multimedia file (Audio/Video).
    Transcribes audio/video with timestamps, extracts PDF pages, indexes into vector store,
    and creates initial summary and chapters.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided.")
        
    # Read file content into memory to validate size
    content = await file.read()
    file_size = len(content)
    
    try:
        file_type = document_service.validate_file(file.filename, file_size)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        
    # Save content bytes directly to disk for 100% byte fidelity
    file_id, storage_path = document_service.save_upload_file(content, file.filename)
    
    full_text = ""
    transcript_segments = []
    duration_seconds = 0.0
    chunks = []
    
    # Process according to file type
    if file_type == "pdf":
        full_text, pages_data = document_service.extract_pdf_content(storage_path)
        for p in pages_data:
            page_chunks = document_service.chunk_text(
                p["text"],
                chunk_size=400,
                chunk_overlap=80,
                metadata={"file_type": "pdf", "page": p["page"]}
            )
            chunks.extend(page_chunks)
    elif file_type == "text":
        full_text, pages_data = document_service.extract_text_content(storage_path)
        for p in pages_data:
            page_chunks = document_service.chunk_text(
                p["text"],
                chunk_size=400,
                chunk_overlap=80,
                metadata={"file_type": "text", "page": p["page"]}
            )
            chunks.extend(page_chunks)
    else:
        # Audio / Video processing via Transcription Service
        full_text, transcript_segments, duration_seconds = transcription_service.transcribe(
            file_path=storage_path,
            api_key_override=api_key_override or "",
            original_filename=file.filename
        )
        for seg in transcript_segments:
            chunks.append({
                "text": seg["text"],
                "metadata": {
                    "file_type": file_type,
                    "start_time": seg["start"],
                    "end_time": seg["end"],
                    "formatted_start": seg["formatted_start"],
                    "formatted_end": seg["formatted_end"]
                }
            })

    # Vector store indexing for instant semantic Q&A
    vector_service.index_chunks(file_id, chunks)

    # Initial summary and topic chapters
    summary_resp = summary_service.generate_summary(
        document_id=file_id,
        full_text=full_text,
        file_type=file_type,
        api_key_override=api_key_override or ""
    )
    
    topics_resp = summary_service.extract_topics(
        document_id=file_id,
        transcript_segments=transcript_segments,
        api_key_override=api_key_override or ""
    )

    now_str = datetime.now(timezone.utc).isoformat()
    cursor = conn.cursor()

    # Store document record
    cursor.execute(
        """
        INSERT INTO documents (
            id, user_id, filename, original_name, file_type, file_size, storage_path, duration_seconds, processed, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """,
        (file_id, current_user["id"], os.path.basename(storage_path), file.filename, file_type, file_size, storage_path, duration_seconds, now_str)
    )

    # Store content, transcript, summary, and topics
    cursor.execute(
        """
        INSERT INTO document_contents (
            document_id, full_text, transcript_segments_json, summary, topics_json
        ) VALUES (?, ?, ?, ?, ?)
        """,
        (
            file_id,
            full_text,
            json.dumps(transcript_segments),
            summary_resp.executive_summary,
            json.dumps([t.model_dump() for t in topics_resp.topics])
        )
    )

    parsed_segments = [TranscriptSegment(**s) for s in transcript_segments]

    return DocumentDetailResponse(
        id=file_id,
        user_id=current_user["id"],
        filename=os.path.basename(storage_path),
        original_name=file.filename,
        file_type=file_type,
        file_size=file_size,
        duration_seconds=duration_seconds,
        processed=True,
        created_at=now_str,
        full_text=full_text,
        summary=summary_resp.executive_summary,
        transcript_segments=parsed_segments,
        topics=[t.model_dump() for t in topics_resp.topics]
    )


@router.get("/list", response_model=DocumentListResponse)
def list_documents(
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Retrieve list of all documents uploaded by current user or shared in guest room."""
    cursor = conn.cursor()
    user_id = current_user["id"]
    is_guest_flag = 1 if current_user.get("is_guest") else 0
    cursor.execute(
        """
        SELECT d.id, d.user_id, d.filename, d.original_name, d.file_type, d.file_size, d.duration_seconds, d.processed, d.created_at
        FROM documents d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.user_id = ? OR (? = 1 AND u.is_guest = 1)
        ORDER BY d.created_at DESC
        """,
        (user_id, is_guest_flag)
    )
    rows = cursor.fetchall()
    docs = [
        DocumentResponse(
            id=r["id"],
            user_id=r["user_id"],
            filename=r["filename"],
            original_name=r["original_name"],
            file_type=r["file_type"],
            file_size=r["file_size"],
            duration_seconds=r["duration_seconds"],
            processed=bool(r["processed"]),
            created_at=str(r["created_at"])
        )
        for r in rows
    ]
    return DocumentListResponse(documents=docs, total=len(docs))


@router.get("/{document_id}", response_model=DocumentDetailResponse)
def get_document_details(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Fetch full document details, transcripts, topics, and summary."""
    cursor = conn.cursor()
    user_id = current_user["id"]
    is_guest_flag = 1 if current_user.get("is_guest") else 0
    cursor.execute(
        """
        SELECT d.id, d.user_id, d.filename, d.original_name, d.file_type, d.file_size, d.duration_seconds,
               d.processed, d.created_at, c.full_text, c.transcript_segments_json, c.summary, c.topics_json
        FROM documents d
        LEFT JOIN document_contents c ON d.id = c.document_id
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.id = ? AND (d.user_id = ? OR (? = 1 AND u.is_guest = 1))
        """,
        (document_id, user_id, is_guest_flag)
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    raw_segments = json.loads(row["transcript_segments_json"] or "[]")
    parsed_segments = [TranscriptSegment(**s) for s in raw_segments]
    topics = json.loads(row["topics_json"] or "[]")

    return DocumentDetailResponse(
        id=row["id"],
        user_id=row["user_id"],
        filename=row["filename"],
        original_name=row["original_name"],
        file_type=row["file_type"],
        file_size=row["file_size"],
        duration_seconds=row["duration_seconds"],
        processed=bool(row["processed"]),
        created_at=str(row["created_at"]),
        full_text=row["full_text"] or "",
        summary=row["summary"],
        transcript_segments=parsed_segments,
        topics=topics
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Delete a document, its disk assets, vector index, and database records."""
    cursor = conn.cursor()
    user_id = current_user["id"]
    is_guest_flag = 1 if current_user.get("is_guest") else 0
    cursor.execute(
        """
        SELECT d.storage_path FROM documents d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.id = ? AND (d.user_id = ? OR ? = 1 OR u.is_guest = 1 OR u.id IS NULL)
        """,
        (document_id, user_id, is_guest_flag)
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    storage_path = row["storage_path"]
    if os.path.exists(storage_path):
        try:
            os.remove(storage_path)
        except OSError:
            pass

    # Clear vector store memory
    vector_service.delete_document(document_id)

    # Delete from DB (clean up chat messages, document contents, and document record)
    cursor.execute("DELETE FROM chat_messages WHERE document_id = ?", (document_id,))
    cursor.execute("DELETE FROM document_contents WHERE document_id = ?", (document_id,))
    cursor.execute("DELETE FROM documents WHERE id = ?", (document_id,))
    return None
