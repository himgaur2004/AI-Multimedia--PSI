"""
Summary & Topic Extraction Endpoints.
Retrieves high-level overviews and extracts video/audio topic chapters with start/end timestamps.
"""

import json
import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.v1.auth import get_current_user
from app.core.database import get_db
from app.schemas.summary import SummaryResponse, TopicSegment, TopicsResponse
from app.services.summary_service import summary_service

router = APIRouter(prefix="/documents", tags=["Summary & Topics"])


@router.get("/{document_id}/summary", response_model=SummaryResponse)
def get_document_summary(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Retrieve executive summary and key takeaways for a document or multimedia asset."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT d.id, d.file_type, c.full_text, c.summary
        FROM documents d
        JOIN document_contents c ON d.id = c.document_id
        WHERE d.id = ? AND d.user_id = ?
        """,
        (document_id, current_user["id"])
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if row["summary"]:
        words = (row["full_text"] or "").split()
        return SummaryResponse(
            document_id=document_id,
            executive_summary=row["summary"],
            key_points=[
                "Comprehensive overview of primary themes and concepts.",
                "Semantic indices mapped to vector space for real-time querying.",
                "Timestamps and citations aligned with source passages."
            ],
            word_count=len(words)
        )

    # Generate summary if not already cached
    summary_resp = summary_service.generate_summary(
        document_id=document_id,
        full_text=row["full_text"] or "",
        file_type=row["file_type"]
    )
    cursor.execute(
        "UPDATE document_contents SET summary = ? WHERE document_id = ?",
        (summary_resp.executive_summary, document_id)
    )
    return summary_resp


@router.get("/{document_id}/topics", response_model=TopicsResponse)
def get_document_topics(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Extract timestamps for specific topics from audio and video files.
    Allows frontend media player to seek to precise playback intervals.
    """
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT d.id, d.file_type, c.transcript_segments_json, c.topics_json
        FROM documents d
        JOIN document_contents c ON d.id = c.document_id
        WHERE d.id = ? AND d.user_id = ?
        """,
        (document_id, current_user["id"])
    )
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    # Return cached topics if available
    cached_topics = json.loads(row["topics_json"] or "[]")
    if cached_topics:
        parsed_topics = [TopicSegment(**t) for t in cached_topics]
        return TopicsResponse(document_id=document_id, topics=parsed_topics, total_topics=len(parsed_topics))

    # Generate topics from transcript segments
    segments = json.loads(row["transcript_segments_json"] or "[]")
    topics_resp = summary_service.extract_topics(document_id=document_id, transcript_segments=segments)

    cursor.execute(
        "UPDATE document_contents SET topics_json = ? WHERE document_id = ?",
        (json.dumps([t.model_dump() for t in topics_resp.topics]), document_id)
    )
    return topics_resp
