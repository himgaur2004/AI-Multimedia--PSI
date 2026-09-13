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


def test_api_key_lifecycle_and_authentication(client, auth_headers, test_user):
    """Test full API key generation, dual-mode header auth, listing, and revocation."""
    # 1. Generate new API Key
    resp = client.post(
        "/api/v1/auth/api-keys",
        headers=auth_headers,
        json={"name": "CLI Tool Key"}
    )
    assert resp.status_code == status.HTTP_200_OK
    key_data = resp.json()
    assert "api_key" in key_data
    assert key_data["api_key"].startswith("psi_")
    assert key_data["name"] == "CLI Tool Key"
    raw_api_key = key_data["api_key"]
    key_id = key_data["id"]

    # 2. Authenticate using X-API-Key header
    resp_x_key = client.get("/api/v1/auth/me", headers={"X-API-Key": raw_api_key})
    assert resp_x_key.status_code == status.HTTP_200_OK
    assert resp_x_key.json()["id"] == test_user["id"]

    # 3. Authenticate using Authorization: Api-Key header
    resp_auth_key = client.get("/api/v1/auth/me", headers={"Authorization": f"Api-Key {raw_api_key}"})
    assert resp_auth_key.status_code == status.HTTP_200_OK
    assert resp_auth_key.json()["username"] == test_user["username"]

    # 4. List API keys
    resp_list = client.get("/api/v1/auth/api-keys", headers=auth_headers)
    assert resp_list.status_code == status.HTTP_200_OK
    keys = resp_list.json()
    assert len(keys) >= 1
    assert any(k["id"] == key_id for k in keys)

    # 5. Revoke API key
    resp_del = client.delete(f"/api/v1/auth/api-keys/{key_id}", headers=auth_headers)
    assert resp_del.status_code == status.HTTP_200_OK
    assert resp_del.json()["status"] == "success"

    # 6. Revoked key must fail authentication
    resp_revoked = client.get("/api/v1/auth/me", headers={"X-API-Key": raw_api_key})
    assert resp_revoked.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid or revoked API key" in resp_revoked.json()["detail"]

    # 7. Revoking nonexistent key returns 404
    resp_del_404 = client.delete("/api/v1/auth/api-keys/nonexistent-key-id", headers=auth_headers)
    assert resp_del_404.status_code == status.HTTP_404_NOT_FOUND


def test_invalid_api_key_header(client):
    """Test rejection of non-existent or invalid API key."""
    resp = client.get("/api/v1/auth/me", headers={"X-API-Key": "psi_fake_key_12345"})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_me_user_not_found(client):
    """Test rejection when token has valid signature but user does not exist in DB."""
    from app.core.security import create_access_token
    token = create_access_token({"sub": "non-existent-user-id-9999"})
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "User associated with token not found" in resp.json()["detail"]


