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
from app.core.database import db_manager, get_db
from app.core.rate_limit import check_rate_limit
from app.schemas.chat import ChatMessageSchema, ChatRequest, ChatResponse, Citation
from app.services.rag_service import rag_service

router = APIRouter(prefix="/documents", tags=["Chat & Q&A"])


def _verify_document_access(document_id: str, user_id: str, conn: sqlite3.Connection) -> dict:
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT d.id, d.file_type, d.original_name, d.user_id, u.is_guest as doc_is_guest
        FROM documents d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE d.id = ?
        """,
        (document_id,)
    )
    doc = cursor.fetchone()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found or unauthorized.")

    cursor.execute("SELECT is_guest FROM users WHERE id = ?", (user_id,))
    u_row = cursor.fetchone()
    current_is_guest = u_row and u_row["is_guest"]

    if doc["user_id"] != user_id and not (current_is_guest and doc["doc_is_guest"]):
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
    
    # Generate answer with citations and follow-up questions
    answer, citations, follow_ups = rag_service.answer_query(
        document_id=document_id,
        query=request.message,
        file_type=doc["file_type"],
        api_key_override=request.api_key_override or "",
        chat_history=request.chat_history or [],
        search_mode=request.search_mode or "inbuilt",
        model_override=request.model
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
        document_id=document_id,
        follow_up_questions=follow_ups,
        engine=rag_service.last_engine,
        retrieval_method=rag_service.last_retrieval_method
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
    Clients receive instantaneous word-by-word generation followed by citations and follow-up questions.
    Persists both the user prompt and assistant response into the conversation history.
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

    async def stream_and_persist_wrapper():
        accumulated_chunks = []
        collected_citations = []
        async for chunk_str in rag_service.stream_query(
            document_id=document_id,
            query=request.message,
            file_type=doc["file_type"],
            api_key_override=request.api_key_override or "",
            chat_history=request.chat_history or [],
            search_mode=request.search_mode or "inbuilt",
            model_override=request.model
        ):
            yield chunk_str
            if chunk_str.startswith("data: "):
                try:
                    payload = json.loads(chunk_str[6:].strip())
                    if payload.get("chunk"):
                        accumulated_chunks.append(payload["chunk"])
                    if payload.get("done"):
                        collected_citations = payload.get("citations", [])
                except Exception:
                    pass

        # Persist the complete assistant answer into history once streaming finishes
        full_text = "".join(accumulated_chunks).strip()
        if full_text:
            try:
                asst_id = str(uuid.uuid4())
                asst_ts = datetime.now(timezone.utc).isoformat()
                with db_manager.session() as sess_conn:
                    sess_cursor = sess_conn.cursor()
                    sess_cursor.execute(
                        "INSERT INTO chat_messages (id, document_id, user_id, role, content, citations_json, created_at) VALUES (?, ?, ?, 'assistant', ?, ?, ?)",
                        (asst_id, document_id, current_user["id"], full_text, json.dumps(collected_citations), asst_ts)
                    )
            except Exception as e:
                print(f"[ChatStream] Assistant message persistence error: {e}")

    return StreamingResponse(
        stream_and_persist_wrapper(),
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
