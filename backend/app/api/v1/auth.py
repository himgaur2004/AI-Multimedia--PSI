"""
Authentication API Endpoints.
Provides user registration, login, guest access, and token verification.
"""

import uuid
from datetime import datetime, timezone
import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.database import get_db
from app.core.rate_limit import check_rate_limit
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.schemas.auth import Token, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    conn: sqlite3.Connection = Depends(get_db)
) -> dict:
    """Dependency extracting and validating the authenticated user from JWT bearer token."""
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
    cursor = conn.cursor()
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
    email = f"{username}@omnimind.local"
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
