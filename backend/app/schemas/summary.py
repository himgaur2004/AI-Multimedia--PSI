"""
Summary and Topic Segmentation schemas.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class TopicSegment(BaseModel):
    id: int
    title: str
    start_time: float = Field(..., description="Topic start time in seconds")
    end_time: float = Field(..., description="Topic end time in seconds")
    formatted_start: str
    formatted_end: str
    summary: str


class SummaryResponse(BaseModel):
    document_id: str
    executive_summary: str
    key_points: List[str]
    word_count: int


class TopicsResponse(BaseModel):
    document_id: str
    topics: List[TopicSegment]
    total_topics: int
