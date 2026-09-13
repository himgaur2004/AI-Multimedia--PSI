"""
Authentication schemas for request/response validation.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username_or_email: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    is_active: bool
    is_guest: bool
    created_at: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: str
    username: str
    exp: Optional[int] = None


class ApiKeyCreate(BaseModel):
    name: str = Field("Default API Key", min_length=1, max_length=100)


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    created_at: str
    is_active: bool


class ApiKeyGeneratedResponse(BaseModel):
    id: str
    name: str
    api_key: str
    key_prefix: str
    created_at: str

