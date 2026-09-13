"""
Tests for MongoDB integration and MongoManager.
Verifies connection configuration, collection exposure, index creation,
health checks, and graceful fallback when unconfigured or disconnected.
"""

from unittest.mock import MagicMock, patch
from app.core.mongo import MongoManager
from app.core.config import settings


def test_mongo_manager_unconfigured(monkeypatch):
    """Verify MongoManager handles unconfigured state cleanly."""
    monkeypatch.setattr(settings, "MONGODB_URL", "")
    monkeypatch.setattr(settings, "DATABASE_URL", "sqlite:///./test.db")
    
    mgr = MongoManager()
    assert not mgr.is_configured
    assert not mgr.is_connected
    assert mgr.connection_url == ""
    assert mgr.db is None
    assert mgr.users is None
    assert mgr.documents is None
    assert mgr.document_contents is None
    assert mgr.chat_messages is None
    assert mgr.api_keys is None
    assert not mgr.ping()
    
    # connect returns False when unconfigured
    result = mgr.connect()
    assert result is False


def test_mongo_manager_configured_from_mongodb_url(monkeypatch):
    """Verify is_configured detects MONGODB_URL."""
    monkeypatch.setattr(settings, "MONGODB_URL", "mongodb://localhost:27017/psi_test")
    mgr = MongoManager()
    assert mgr.is_configured
    assert mgr.connection_url == "mongodb://localhost:27017/psi_test"


def test_mongo_manager_configured_from_database_url(monkeypatch):
    """Verify is_configured detects mongodb:// inside DATABASE_URL."""
    monkeypatch.setattr(settings, "MONGODB_URL", "")
    monkeypatch.setattr(settings, "DATABASE_URL", "mongodb+srv://user:pass@cluster.mongodb.net/psi_prod")
    mgr = MongoManager()
    assert mgr.is_configured
    assert mgr.connection_url == "mongodb+srv://user:pass@cluster.mongodb.net/psi_prod?authSource=admin"


def test_mongo_manager_connect_and_indexes_mocked(monkeypatch):
    """Verify connect, ensure_indexes, and collections work with mocked client."""
    monkeypatch.setattr(settings, "MONGODB_URL", "mongodb://127.0.0.1:27017/test_psi")
    
    mock_client = MagicMock()
    mock_db = MagicMock()
    mock_db.name = "test_psi"
    mock_client.get_default_database.return_value = mock_db
    mock_client.__getitem__.return_value = mock_db
    
    with patch("app.core.mongo.MongoClient", return_value=mock_client):
        mgr = MongoManager()
        connected = mgr.connect()
        assert connected is True
        assert mgr.is_connected
        assert mgr.db == mock_db
        assert mgr.users is not None
        assert mgr.documents is not None
        assert mgr.document_contents is not None
        assert mgr.chat_messages is not None
        assert mgr.api_keys is not None
        
        # Test ping
        mock_client.admin.command.return_value = {"ok": 1}
        assert mgr.ping() is True
        
        # Test close
        mgr.close()
        assert not mgr.is_connected
        mock_client.close.assert_called_once()


def test_mongo_manager_connection_failure(monkeypatch):
    """Verify connect handles network failure gracefully."""
    monkeypatch.setattr(settings, "MONGODB_URL", "mongodb://unreachable-host:27017/psi")
    
    with patch("app.core.mongo.MongoClient", side_effect=Exception("Connection timed out")):
        mgr = MongoManager()
        connected = mgr.connect()
        assert connected is False
        assert not mgr.is_connected


def test_mongo_manager_auth_failure_closes_client(monkeypatch):
    """Verify connect closes client when ping fails due to bad credentials."""
    monkeypatch.setattr(settings, "MONGODB_URL", "mongodb://user:badpass@localhost:27017/psi")
    mock_client = MagicMock()
    mock_client.admin.command.side_effect = Exception("bad auth: authentication failed")
    
    with patch("app.core.mongo.MongoClient", return_value=mock_client):
        mgr = MongoManager()
        connected = mgr.connect()
        assert connected is False
        assert not mgr.is_connected
        mock_client.close.assert_called_once()


def test_mongo_manager_edges_and_disconnected():
    """Verify disconnected collection properties, index error handling, and ping failure."""
    mgr = MongoManager()
    assert mgr.users is None
    assert mgr.documents is None
    assert mgr.document_contents is None
    assert mgr.chat_messages is None
    assert mgr.api_keys is None
    assert mgr.ping() is False
    mgr.ensure_indexes()  # Should return immediately when not connected

    # Ping exception branch
    mgr._connected = True
    mock_client = MagicMock()
    mock_client.admin.command.side_effect = Exception("Ping network error")
    mgr._client = mock_client
    assert mgr.ping() is False

    # Index creation exception branch
    mock_db = MagicMock()
    mock_coll = MagicMock()
    mock_coll.create_index.side_effect = Exception("Index error")
    mock_db.__getitem__.return_value = mock_coll
    mgr._db = mock_db
    mgr.ensure_indexes()  # Should handle exception without raising


