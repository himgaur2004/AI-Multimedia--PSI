"""
Main API Router for Version 1.
Aggregates authentication, documents, chat, summary, and media streaming routes.
"""

from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.chat import router as chat_router
from app.api.v1.documents import router as documents_router
from app.api.v1.media import router as media_router
from app.api.v1.summary import router as summary_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(documents_router)
api_router.include_router(chat_router)
api_router.include_router(summary_router)
api_router.include_router(media_router)
