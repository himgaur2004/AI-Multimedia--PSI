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
    engine: Optional[str] = "Self-Built RAG • Semantic Vector Search"
    retrieval_method: Optional[str] = "Semantic Vector Search"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    api_key_override: Optional[str] = None
    chat_history: Optional[List[dict]] = None
    search_mode: Optional[str] = None  # 'inbuilt' (self-built RAG + vector search) or 'gpt' (OpenAI LLM)
    model: Optional[str] = None


class ChatResponse(BaseModel):
    message_id: str
    answer: str
    citations: List[Citation] = []
    document_id: str
    follow_up_questions: List[str] = []
    engine: str = "Self-Built RAG Grounding Engine"
    retrieval_method: str = "Semantic Vector Search (TF-IDF & Cosine Similarity)"

