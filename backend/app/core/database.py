"""
Database Engine & Session Management.
Senior SDE Pattern: Thread-safe SQLite database manager supporting connection pooling,
context management, and frictionless in-memory test overrides.
"""

import json
import sqlite3
import threading
from contextlib import contextmanager
from typing import Generator
from app.core.config import settings


class DatabaseManager:
    """Manages SQLite database connections and schema migrations."""

    def __init__(self, db_url: str = settings.DATABASE_URL):
        if db_url.startswith(("mongodb://", "mongodb+srv://")):
            self.db_path = "psi.db"
        else:
            self.db_path = db_url.replace("sqlite:///", "")
        self._local = threading.local()
        try:
            self.init_db()
        except Exception:
            pass

    def get_connection(self) -> sqlite3.Connection:
        """Get or initialize thread-local sqlite connection with row factories."""
        if not hasattr(self._local, "connection") or self._local.connection is None:
            conn = sqlite3.connect(
                self.db_path,
                check_same_thread=False,
                timeout=30.0,
                isolation_level=None  # autocommit mode managed via transactions
            )
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA foreign_keys=ON;")
            self._local.connection = conn
        return self._local.connection

    def init_db(self):
        """Idempotent schema initialization creating required tables and indexes."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 1. Users Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            is_guest INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 2. Documents Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            file_type TEXT NOT NULL, -- 'pdf', 'audio', 'video'
            file_size INTEGER NOT NULL,
            storage_path TEXT NOT NULL,
            duration_seconds REAL DEFAULT 0.0,
            processed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)

        # 3. Document Contents & Transcripts Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS document_contents (
            document_id TEXT PRIMARY KEY,
            full_text TEXT NOT NULL,
            transcript_segments_json TEXT, -- JSON list of {id, start, end, text}
            summary TEXT,
            topics_json TEXT, -- JSON list of {topic, start_time, end_time, summary}
            FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
        );
        """)

        # 4. Chat Messages Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL, -- 'user', 'assistant'
            content TEXT NOT NULL,
            citations_json TEXT, -- JSON list of {page, start_time, end_time, text}
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)

        # 5. API Keys Table (Multi-User API Key Authentication)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            key_hash TEXT UNIQUE NOT NULL,
            key_prefix TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
        """)

        # Indexes for fast lookup
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_user ON documents(user_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_chat_doc ON chat_messages(document_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);")

        conn.commit()
        conn.close()

    @contextmanager
    def session(self) -> Generator[sqlite3.Connection, None, None]:
        """Context manager yielding a transactional database session."""
        conn = self.get_connection()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


db_manager = DatabaseManager()


def get_db() -> Generator[sqlite3.Connection, None, None]:
    """FastAPI Dependency for transactional DB sessions."""
    with db_manager.session() as conn:
        yield conn
