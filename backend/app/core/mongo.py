"""
MongoDB Connection and Repository Manager.
Production-grade MongoDB driver with connection pooling, index management,
and seamless integration with PSI document & multimedia pipelines.
"""

import logging
from typing import Optional, Dict, Any, List
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.collection import Collection
from pymongo.errors import ConnectionFailure, PyMongoError

from app.core.config import settings

logger = logging.getLogger("psi.mongodb")


class MongoManager:
    """Manages MongoDB client connections, lifecycle, and collections."""

    def __init__(self):
        self._client: Optional[MongoClient] = None
        self._db: Optional[Database] = None
        self._connected: bool = False

    @property
    def is_configured(self) -> bool:
        """Check whether a MongoDB connection URL has been provided."""
        url = settings.MONGODB_URL or ""
        if not url and settings.DATABASE_URL.startswith(("mongodb://", "mongodb+srv://")):
            url = settings.DATABASE_URL
        return bool(url.strip())

    @property
    def connection_url(self) -> str:
        """Get the active MongoDB connection URL."""
        if settings.MONGODB_URL:
            return settings.MONGODB_URL
        if settings.DATABASE_URL.startswith(("mongodb://", "mongodb+srv://")):
            return settings.DATABASE_URL
        return ""

    def connect(self) -> bool:
        """Initialize MongoDB client and ensure indexes exist."""
        if not self.is_configured:
            logger.info("MongoDB URL not configured; using default relational storage.")
            return False

        try:
            url = self.connection_url
            self._client = MongoClient(
                url,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                maxPoolSize=50,
                minPoolSize=5,
            )
            # Verify connectivity
            self._client.admin.command("ping")
            
            db_name = settings.MONGODB_DB_NAME
            # If database name is embedded in URI, use it
            default_db = self._client.get_default_database()
            if default_db is not None and default_db.name:
                self._db = default_db
            else:
                self._db = self._client[db_name]

            self._connected = True
            logger.info(f"Connected to MongoDB database: {self._db.name}")
            self.ensure_indexes()
            return True
        except (ConnectionFailure, PyMongoError, Exception) as exc:
            logger.warning(f"MongoDB connection failed ({exc}); continuing with fallback storage.")
            self._connected = False
            self._client = None
            self._db = None
            return False

    def close(self):
        """Cleanly close MongoDB client connections."""
        if self._client:
            self._client.close()
            self._connected = False
            self._client = None
            self._db = None
            logger.info("MongoDB connection closed.")

    @property
    def db(self) -> Optional[Database]:
        """Return active MongoDB database reference."""
        return self._db

    @property
    def is_connected(self) -> bool:
        """Check if active MongoDB connection is healthy."""
        return self._connected and self._db is not None

    # ── Collection Accessors ──────────────────────────────────────────────────

    @property
    def users(self) -> Optional[Collection]:
        return self._db["users"] if self.is_connected else None

    @property
    def documents(self) -> Optional[Collection]:
        return self._db["documents"] if self.is_connected else None

    @property
    def document_contents(self) -> Optional[Collection]:
        return self._db["document_contents"] if self.is_connected else None

    @property
    def chat_messages(self) -> Optional[Collection]:
        return self._db["chat_messages"] if self.is_connected else None

    @property
    def api_keys(self) -> Optional[Collection]:
        return self._db["api_keys"] if self.is_connected else None

    # ── Index Management ──────────────────────────────────────────────────────

    def ensure_indexes(self):
        """Create required indexes for fast queries and uniqueness constraints."""
        if not self.is_connected:
            return

        try:
            # Users: unique username and email
            self.users.create_index([("username", ASCENDING)], unique=True)
            self.users.create_index([("email", ASCENDING)], unique=True)
            self.users.create_index([("id", ASCENDING)], unique=True)

            # Documents: query by user and file id
            self.documents.create_index([("id", ASCENDING)], unique=True)
            self.documents.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])

            # Document Contents
            self.document_contents.create_index([("document_id", ASCENDING)], unique=True)

            # Chat Messages: fast retrieval by document and creation order
            self.chat_messages.create_index([("document_id", ASCENDING), ("created_at", ASCENDING)])
            self.chat_messages.create_index([("user_id", ASCENDING)])

            # API Keys: unique key hash lookup
            self.api_keys.create_index([("key_hash", ASCENDING)], unique=True)
            self.api_keys.create_index([("user_id", ASCENDING)])

            logger.info("MongoDB collection indexes verified.")
        except Exception as exc:
            logger.warning(f"Failed ensuring MongoDB indexes: {exc}")

    def ping(self) -> bool:
        """Healthcheck ping to MongoDB."""
        if not self.is_connected or not self._client:
            return False
        try:
            self._client.admin.command("ping")
            return True
        except Exception:
            return False


# Global singleton instance
mongo_manager = MongoManager()
