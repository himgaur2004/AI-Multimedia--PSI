"""
PSI Backend Application Entry Point.
Production-grade FastAPI application with CORS, rate limiting, and modular routing.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import db_manager
from app.core.mongo import mongo_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager ensuring database initialization and resource cleanup."""
    db_manager.init_db()
    if mongo_manager.is_configured:
        mongo_manager.connect()
    yield
    mongo_manager.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Full-stack AI-Powered Document & Multimedia Q&A System with LangChain, Whisper, and Video Player sync.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Inject production-grade security headers into all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    # HSTS — only enable over HTTPS in production
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Include Version 1 API
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["System Health"])
def health_check():
    """Health check endpoint for Docker container orchestration and uptime monitoring."""
    resp = {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }
    if mongo_manager.is_configured:
        resp["mongodb"] = "connected" if mongo_manager.is_connected else "disconnected"
    return resp


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler ensuring clean JSON error responses."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please contact support if the issue persists."},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
