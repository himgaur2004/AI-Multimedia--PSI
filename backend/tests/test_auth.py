"""
Tests for Authentication & User Registration API.
"""

from fastapi import status


def test_register_success(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "alexdev",
            "email": "alex@example.com",
            "password": "StrongPassword123!"
        }
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "alexdev"
    assert data["user"]["email"] == "alex@example.com"
    assert data["user"]["is_guest"] is False


def test_register_duplicate_username_or_email(client):
    payload = {
        "username": "dupuser",
        "email": "dup@example.com",
        "password": "Password123"
    }
    resp1 = client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == status.HTTP_200_OK
    
    # Duplicate username
    resp2 = client.post(
        "/api/v1/auth/register",
        json={"username": "dupuser", "email": "other@example.com", "password": "Password123"}
    )
    assert resp2.status_code == status.HTTP_400_BAD_REQUEST
    assert "already registered" in resp2.json()["detail"]


def test_register_invalid_data(client):
    # Short username
    resp = client.post(
        "/api/v1/auth/register",
        json={"username": "a", "email": "valid@example.com", "password": "Password123"}
    )
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Invalid email
    resp = client.post(
        "/api/v1/auth/register",
        json={"username": "validname", "email": "not-an-email", "password": "Password123"}
    )
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_login_success(client):
    # Create user
    client.post(
        "/api/v1/auth/register",
        json={"username": "loginuser", "email": "login@example.com", "password": "SecretPassword123"}
    )
    
    # Login with username
    resp_user = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "loginuser", "password": "SecretPassword123"}
    )
    assert resp_user.status_code == status.HTTP_200_OK
    assert "access_token" in resp_user.json()

    # Login with email
    resp_email = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "login@example.com", "password": "SecretPassword123"}
    )
    assert resp_email.status_code == status.HTTP_200_OK
    assert "access_token" in resp_email.json()


def test_login_invalid_credentials(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "nonexistent", "password": "WrongPassword"}
    )
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Incorrect username or password" in resp.json()["detail"]


def test_guest_session_creation(client):
    resp = client.post("/api/v1/auth/guest")
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["is_guest"] is True
    assert data["user"]["username"].startswith("guest_")


def test_get_me_endpoint(client, auth_headers, test_user):
    resp = client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["id"] == test_user["id"]
    assert data["username"] == test_user["username"]


def test_get_me_unauthorized(client):
    # Missing token
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    # Invalid token
    resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.token.value"})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
