"""
Authentication API Endpoints.
Provides user registration, login, guest access, and token verification.
"""

import uuid
from datetime import datetime, timezone
import sqlite3
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from app.core.database import get_db
from app.core.rate_limit import check_rate_limit
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_api_key,
    hash_api_key,
    hash_password,
    verify_password,
)
from app.schemas.auth import (
    ApiKeyCreate,
    ApiKeyGeneratedResponse,
    ApiKeyResponse,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    conn: sqlite3.Connection = Depends(get_db)
) -> dict:
    """
    Enterprise Authentication Dependency.
    Validates either:
    1. Direct API Key header (X-API-Key: psi_... or Authorization: Api-Key psi_...)
    2. Bearer JWT Access Token (Authorization: Bearer <jwt>)
    Guarantees strict multi-tenant isolation across all routes.
    """
    # 1. Inspect API Key headers
    api_key = request.headers.get("X-API-Key")
    auth_header = request.headers.get("Authorization", "")
    if not api_key and (auth_header.startswith("Api-Key ") or auth_header.startswith("ApiKey ")):
        api_key = auth_header.split(" ", 1)[1].strip()

    cursor = conn.cursor()

    if api_key:
        key_hash = hash_api_key(api_key.strip())
        cursor.execute(
            """
            SELECT u.id, u.username, u.email, u.is_active, u.is_guest, u.created_at
            FROM api_keys k
            JOIN users u ON k.user_id = u.id
            WHERE k.key_hash = ? AND k.is_active = 1
            """,
            (key_hash,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked API key."
            )
        return dict(row)

    # 2. Inspect JWT Bearer token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided."
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token."
        )

    user_id = payload.get("sub")
    cursor.execute("SELECT id, username, email, is_active, is_guest, created_at FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token not found."
        )

    return dict(row)


@router.post("/register", response_model=Token, dependencies=[Depends(check_rate_limit)])
def register(user_in: UserCreate, conn: sqlite3.Connection = Depends(get_db)):
    """Register a new user account."""
    cursor = conn.cursor()
    
    # Check existing user
    cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (user_in.username, user_in.email))
    if cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email is already registered."
        )
        
    user_id = str(uuid.uuid4())
    hashed_pwd = hash_password(user_in.password)
    now_str = datetime.now(timezone.utc).isoformat()
    
    cursor.execute(
        """
        INSERT INTO users (id, username, email, hashed_password, is_active, is_guest, created_at)
        VALUES (?, ?, ?, ?, 1, 0, ?)
        """,
        (user_id, user_in.username, user_in.email, hashed_pwd, now_str)
    )
    
    token = create_access_token(data={"sub": user_id, "username": user_in.username})
    user_resp = UserResponse(
        id=user_id,
        username=user_in.username,
        email=user_in.email,
        is_active=True,
        is_guest=False,
        created_at=now_str
    )
    return Token(access_token=token, token_type="bearer", user=user_resp)


@router.post("/login", response_model=Token, dependencies=[Depends(check_rate_limit)])
def login(login_in: UserLogin, conn: sqlite3.Connection = Depends(get_db)):
    """Authenticate with username/email and password."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, email, hashed_password, is_active, is_guest, created_at FROM users WHERE username = ? OR email = ?",
        (login_in.username_or_email, login_in.username_or_email)
    )
    user_row = cursor.fetchone()
    
    if not user_row or not verify_password(login_in.password, user_row["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password."
        )
        
    token = create_access_token(data={"sub": user_row["id"], "username": user_row["username"]})
    user_resp = UserResponse(
        id=user_row["id"],
        username=user_row["username"],
        email=user_row["email"],
        is_active=bool(user_row["is_active"]),
        is_guest=bool(user_row["is_guest"]),
        created_at=user_row["created_at"]
    )
    return Token(access_token=token, token_type="bearer", user=user_resp)


@router.post("/guest", response_model=Token)
def create_guest_session(conn: sqlite3.Connection = Depends(get_db)):
    """Instant friction-free guest session generator."""
    user_id = str(uuid.uuid4())
    username = f"guest_{user_id[:8]}"
    email = f"{username}@psi.local"
    hashed_pwd = hash_password(str(uuid.uuid4()))
    now_str = datetime.now(timezone.utc).isoformat()

    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO users (id, username, email, hashed_password, is_active, is_guest, created_at)
        VALUES (?, ?, ?, ?, 1, 1, ?)
        """,
        (user_id, username, email, hashed_pwd, now_str)
    )

    token = create_access_token(data={"sub": user_id, "username": username})
    user_resp = UserResponse(
        id=user_id,
        username=username,
        email=email,
        is_active=True,
        is_guest=True,
        created_at=now_str
    )
    return Token(access_token=token, token_type="bearer", user=user_resp)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Retrieve current authenticated profile."""
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        email=current_user["email"],
        is_active=bool(current_user["is_active"]),
        is_guest=bool(current_user["is_guest"]),
        created_at=str(current_user["created_at"])
    )


@router.post("/api-keys", response_model=ApiKeyGeneratedResponse)
def create_new_api_key(
    key_in: ApiKeyCreate,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Generate a high-entropy secret API key for programmatic/developer access."""
    key_id = str(uuid.uuid4())
    raw_key = generate_api_key(prefix="psi")
    key_prefix = raw_key[:12] + "..."
    key_hash = hash_api_key(raw_key)
    now_str = datetime.now(timezone.utc).isoformat()

    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, created_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        """,
        (key_id, current_user["id"], key_hash, key_prefix, key_in.name, now_str)
    )

    return ApiKeyGeneratedResponse(
        id=key_id,
        name=key_in.name,
        api_key=raw_key,
        key_prefix=key_prefix,
        created_at=now_str
    )


@router.get("/api-keys", response_model=List[ApiKeyResponse])
def list_api_keys(
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """List active API keys belonging to the authenticated tenant."""
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, name, key_prefix, created_at, is_active
        FROM api_keys
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC
        """,
        (current_user["id"],)
    )
    rows = cursor.fetchall()
    return [
        ApiKeyResponse(
            id=r["id"],
            name=r["name"],
            key_prefix=r["key_prefix"],
            created_at=str(r["created_at"]),
            is_active=bool(r["is_active"])
        )
        for r in rows
    ]


@router.delete("/api-keys/{key_id}")
def revoke_api_key(
    key_id: str,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    """Revoke an API key belonging to the authenticated user."""
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?",
        (key_id, current_user["id"])
    )
    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or not owned by user."
        )
    return {"status": "success", "message": "API key successfully revoked."}

