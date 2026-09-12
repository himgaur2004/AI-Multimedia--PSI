"""
Document and Multimedia schemas.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class TranscriptSegment(BaseModel):
    id: int
    start: float = Field(..., description="Start timestamp in seconds")
    end: float = Field(..., description="End timestamp in seconds")
    text: str
    formatted_start: Optional[str] = None
    formatted_end: Optional[str] = None


class DocumentBase(BaseModel):
    filename: str
    original_name: str
    file_type: str  # 'pdf', 'audio', 'video'
    file_size: int
    duration_seconds: float = 0.0


class DocumentResponse(DocumentBase):
    id: str
    user_id: str
    processed: bool
    created_at: str


class DocumentDetailResponse(DocumentResponse):
    full_text: Optional[str] = ""
    summary: Optional[str] = None
    transcript_segments: Optional[List[TranscriptSegment]] = []
    topics: Optional[List[dict]] = []


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int
