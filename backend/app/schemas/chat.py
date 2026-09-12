"""
Chat and Streaming schemas with citation grounding.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class Citation(BaseModel):
    source: str = "document"  # 'pdf' or 'media'
    page: Optional[int] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    formatted_timestamp: Optional[str] = None
    snippet: str


class ChatMessageSchema(BaseModel):
    id: str
    document_id: str
    role: str  # 'user' or 'assistant'
    content: str
    citations: Optional[List[Citation]] = []
    created_at: Optional[str] = None


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    api_key_override: Optional[str] = None


class ChatResponse(BaseModel):
    message_id: str
    answer: str
    citations: List[Citation] = []
    document_id: str
