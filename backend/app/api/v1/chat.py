"""
Chat & Streaming Q&A Endpoints.
Provides both standard JSON responses and real-time SSE streaming with citations and timestamp badges.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.v1.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import check_rate_limit
from app.schemas.chat import ChatMessageSchema, ChatRequest, ChatResponse, Citation
from app.services.rag_service import rag_service

router = APIRouter(prefix="/documents", tags=["Chat & Q&A"])


def _verify_document_access(document_id: str, user_id: str, conn: sqlite3.Connection) -> dict:
    cursor = conn.cursor()
    cursor.execute("SELECT id, file_type, original_name FROM documents WHERE id = ? AND user_id = ?", (document_id, user_id))
    doc = cursor.fetchone()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found or unauthorized.")
    return dict(doc)


@router.post("/{document_id}/chat", response_model=ChatResponse, dependencies=[Depends(check_rate_limit)])
def chat_with_document(
    document_id: str,
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Ask a question about a document or media file and receive a grounded answer with citations."""
    doc = _verify_document_access(document_id, current_user["id"], conn)
    
    # Generate answer with citations
    answer, citations = rag_service.answer_query(
        document_id=document_id,
        query=request.message,
        file_type=doc["file_type"],
        api_key_override=request.api_key_override or ""
    )

    now_str = datetime.now(timezone.utc).isoformat()
    cursor = conn.cursor()

    # Save user message
    user_msg_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO chat_messages (id, document_id, user_id, role, content, citations_json, created_at) VALUES (?, ?, ?, 'user', ?, '[]', ?)",
        (user_msg_id, document_id, current_user["id"], request.message, now_str)
    )

    # Save assistant message
    asst_msg_id = str(uuid.uuid4())
    citations_data = [c.model_dump() for c in citations]
    cursor.execute(
        "INSERT INTO chat_messages (id, document_id, user_id, role, content, citations_json, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?)",
        (asst_msg_id, document_id, current_user["id"], answer, json.dumps(citations_data), now_str)
    )

    return ChatResponse(
        message_id=asst_msg_id,
        answer=answer,
        citations=citations,
        document_id=document_id
    )


@router.post("/{document_id}/chat/stream")
async def chat_stream_with_document(
    document_id: str,
    request: ChatRequest,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Stream answer tokens in real-time using Server-Sent Events (SSE).
    Clients receive instantaneous word-by-word generation followed by citations.
    """
    doc = _verify_document_access(document_id, current_user["id"], conn)

    # Record the user's prompt in database
    now_str = datetime.now(timezone.utc).isoformat()
    cursor = conn.cursor()
    user_msg_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO chat_messages (id, document_id, user_id, role, content, citations_json, created_at) VALUES (?, ?, ?, 'user', ?, '[]', ?)",
        (user_msg_id, document_id, current_user["id"], request.message, now_str)
    )

    return StreamingResponse(
        rag_service.stream_query(
            document_id=document_id,
            query=request.message,
            file_type=doc["file_type"],
            api_key_override=request.api_key_override or ""
        ),
        media_type="text/event-stream"
    )


@router.get("/{document_id}/messages", response_model=List[ChatMessageSchema])
def get_chat_history(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Retrieve full chronological conversation history for the specified document."""
    _verify_document_access(document_id, current_user["id"], conn)
    
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, document_id, role, content, citations_json, created_at
        FROM chat_messages
        WHERE document_id = ?
        ORDER BY created_at ASC
        """,
        (document_id,)
    )
    rows = cursor.fetchall()

    history = []
    for r in rows:
        raw_cites = json.loads(r["citations_json"] or "[]")
        citations = [Citation(**c) for c in raw_cites]
        history.append(ChatMessageSchema(
            id=r["id"],
            document_id=r["document_id"],
            role=r["role"],
            content=r["content"],
            citations=citations,
            created_at=str(r["created_at"])
        ))

    return history
