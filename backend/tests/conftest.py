"""
Pytest Fixtures and Test Suite Configuration.
Configures in-memory database, test client, authenticated headers, and mock files.
"""

import io
import os
import sqlite3
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import db_manager, get_db
from app.core.security import create_access_token, hash_password
from app.core.rate_limit import limiter
from app.main import app


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter state before each test."""
    limiter.clear()


@pytest.fixture(scope="session")
def test_db_path(tmp_path_factory):
    """Create a temporary sqlite db for isolation."""
    fn = tmp_path_factory.mktemp("data") / "test_omnimind.db"
    return str(fn)


@pytest.fixture(autouse=True)
def setup_test_db(monkeypatch, test_db_path):
    """Set db_manager to point to an isolated test db."""
    db_manager.db_path = test_db_path
    db_manager.init_db()
    
    # Ensure fresh tables
    conn = sqlite3.connect(test_db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_messages;")
    cursor.execute("DELETE FROM document_contents;")
    cursor.execute("DELETE FROM documents;")
    cursor.execute("DELETE FROM users;")
    conn.commit()
    conn.close()


@pytest.fixture
def client():
    """FastAPI TestClient instance."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def test_user():
    """Create a primary test user in the database."""
    user_id = "test-user-uuid-1234"
    username = "testengineer"
    email = "engineer@omnimind.io"
    hashed_pwd = hash_password("ValidP@ssw0rd123")
    
    conn = db_manager.get_connection()
    conn.execute(
        "INSERT INTO users (id, username, email, hashed_password, is_active, is_guest) VALUES (?, ?, ?, ?, 1, 0)",
        (user_id, username, email, hashed_pwd)
    )
    return {"id": user_id, "username": username, "email": email}


@pytest.fixture
def auth_headers(test_user):
    """JWT Bearer Authorization header for test user."""
    token = create_access_token(data={"sub": test_user["id"], "username": test_user["username"]})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_user():
    """Create a second distinct user to test multi-tenant isolation."""
    user_id = "other-user-uuid-5678"
    username = "otherengineer"
    email = "other@omnimind.io"
    hashed_pwd = hash_password("ValidP@ssw0rd456")
    
    conn = db_manager.get_connection()
    conn.execute(
        "INSERT INTO users (id, username, email, hashed_password, is_active, is_guest) VALUES (?, ?, ?, ?, 1, 0)",
        (user_id, username, email, hashed_pwd)
    )
    return {"id": user_id, "username": username, "email": email}


@pytest.fixture
def other_auth_headers(other_user):
    token = create_access_token(data={"sub": other_user["id"], "username": other_user["username"]})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_pdf_bytes():
    """Return realistic PDF byte stream for upload tests."""
    pdf_content = (
        b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n"
        b"4 0 obj\n<< /Length 75 >>\nstream\n"
        b"BT /F1 12 Tf 100 700 Td (AI Document and Multimedia System Overview) Tj ET\n"
        b"endstream\nendobj\nxref\n0 5\n0000000000 65535 f \n"
        b"trailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n300\n%%EOF\n"
    )
    return pdf_content
