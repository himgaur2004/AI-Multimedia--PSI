"""
Security & Cryptography Module.
Provides robust password hashing (PBKDF2-HMAC-SHA256 with salt) and JWT token generation/validation.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from app.core.config import settings


def generate_api_key(prefix: str = "omni") -> str:
    """Generate a high-entropy API key prefixed for PSI authentication."""
    random_part = secrets.token_urlsafe(32)
    return f"{prefix}_{random_part}"


def hash_api_key(api_key: str) -> str:
    """Hash API key using SHA-256 for secure database storage."""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def verify_api_key(plain_key: str, hashed_key: str) -> bool:
    """Verify an API key in constant time."""
    computed_hash = hash_api_key(plain_key)
    return hmac.compare_digest(computed_hash, hashed_key)



def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with a secure random 16-byte salt."""
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations=100_000,
    )
    # Store as salt_hex$key_hex
    return f"{salt.hex()}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed representation in constant time."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 2:
            return False
        salt = bytes.fromhex(parts[0])
        expected_key = bytes.fromhex(parts[1])
        actual_key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt,
            iterations=100_000,
        )
        return hmac.compare_digest(actual_key, expected_key)
    except Exception:
        return False


def _b64_url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT token (HS256) with expiration timestamp."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": int(expire.timestamp()), "iat": int(time.time())})
    
    header = {"alg": "HS256", "typ": "JWT"}
    header_bytes = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_bytes = json.dumps(to_encode, separators=(",", ":")).encode("utf-8")
    
    header_b64 = _b64_url_encode(header_bytes)
    payload_b64 = _b64_url_encode(payload_bytes)
    
    message = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
    signature_b64 = _b64_url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify signature of JWT token. Returns payload dict or None if invalid/expired."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        message = f"{header_b64}.{payload_b64}".encode("utf-8")
        
        expected_sig = hmac.new(settings.SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
        actual_sig = _b64_url_decode(signature_b64)
        
        if not hmac.compare_digest(actual_sig, expected_sig):
            return None
        
        payload_bytes = _b64_url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
        
        # Verify expiration
        exp = payload.get("exp")
        if exp and exp < time.time():
            return None
            
        return payload
    except Exception:
        return None
