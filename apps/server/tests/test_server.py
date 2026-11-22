"""Tests for the Zod Control Center event server."""

import pytest
import json
import sqlite3
from pathlib import Path
from aiohttp.test_utils import AioHTTPTestCase, TestClient, TestServer
from aiohttp import web

# Import the server module
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from server import (
    init_db,
    check_auth,
    handle_events,
    handle_get_events,
    handle_get_sessions,
    handle_messages,
    handle_get_messages,
    handle_get_diagrams,
    DATABASE_PATH,
    TOKEN,
)


class TestAuth:
    """Tests for authentication."""

    def test_check_auth_valid_token(self):
        """Valid bearer token returns True."""
        class MockRequest:
            headers = {"Authorization": f"Bearer {TOKEN}"}
        assert check_auth(MockRequest()) is True

    def test_check_auth_invalid_token(self):
        """Invalid bearer token returns False."""
        class MockRequest:
            headers = {"Authorization": "Bearer wrong-token"}
        assert check_auth(MockRequest()) is False

    def test_check_auth_missing_header(self):
        """Missing Authorization header returns False."""
        class MockRequest:
            headers = {}
        assert check_auth(MockRequest()) is False

    def test_check_auth_malformed_header(self):
        """Malformed Authorization header returns False."""
        class MockRequest:
            headers = {"Authorization": "NotBearer token"}
        assert check_auth(MockRequest()) is False


class TestDatabase:
    """Tests for database operations."""

    @pytest.fixture(autouse=True)
    def setup_db(self, tmp_path):
        """Use a temporary database for tests."""
        import server
        self.original_db = server.DATABASE_PATH
        server.DATABASE_PATH = tmp_path / "test_events.db"
        server.init_db()
        yield
        server.DATABASE_PATH = self.original_db

    def test_init_db_creates_tables(self, tmp_path):
        """Database initialization creates events and messages tables."""
        conn = sqlite3.connect(str(tmp_path / "test_events.db"))
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        conn.close()
        assert "events" in tables
        assert "messages" in tables

    def test_events_table_schema(self, tmp_path):
        """Events table has expected columns."""
        conn = sqlite3.connect(str(tmp_path / "test_events.db"))
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(events)")
        columns = {row[1] for row in cursor.fetchall()}
        conn.close()
        expected = {
            "id", "uuid", "session_id", "source_app", "agent_name",
            "event_type", "tool_name", "tool_input", "tool_output",
            "timestamp", "transcript_path", "created_at"
        }
        assert expected.issubset(columns)

    def test_messages_table_schema(self, tmp_path):
        """Messages table has expected columns."""
        conn = sqlite3.connect(str(tmp_path / "test_events.db"))
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(messages)")
        columns = {row[1] for row in cursor.fetchall()}
        conn.close()
        expected = {"id", "uuid", "target", "text", "session_id", "created_at"}
        assert expected.issubset(columns)


class TestEventEndpoints:
    """Tests for event handling endpoints."""

    @pytest.fixture(autouse=True)
    def setup_db(self, tmp_path):
        """Use a temporary database for tests."""
        import server
        self.original_db = server.DATABASE_PATH
        server.DATABASE_PATH = tmp_path / "test_events.db"
        server.init_db()
        yield
        server.DATABASE_PATH = self.original_db

    @pytest.fixture
    async def client(self):
        """Create a test client for the aiohttp app."""
        from server import create_app
        async with TestClient(TestServer(create_app())) as client:
            yield client

    @pytest.mark.asyncio
    async def test_post_event_stores_in_db(self, client):
        """POST /events stores event in database."""
        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "test-session",
                "source_app": "test-app",
                "agent_name": "test-agent",
                "type": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": "/test/file.ts"}
            }
        )
        assert response.status == 200
        data = await response.json()
        assert data["status"] == "stored"
        assert "event_id" in data

    @pytest.mark.asyncio
    async def test_post_event_requires_auth(self, client):
        """POST /events returns 401 without valid token."""
        response = await client.post(
            "/events",
            headers={"Authorization": "Bearer invalid", "Content-Type": "application/json"},
            json={"session_id": "test"}
        )
        assert response.status == 401

    @pytest.mark.asyncio
    async def test_post_event_invalid_json_returns_400(self, client):
        """POST /events returns 400 for invalid JSON."""
        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            data="not valid json"
        )
        assert response.status == 400
        data = await response.json()
        assert "Invalid JSON" in data["error"]

    @pytest.mark.asyncio
    async def test_get_events_returns_session_events(self, client):
        """GET /events?session_id returns events for that session."""
        # First insert test data
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        conn.execute(
            """INSERT INTO events (uuid, session_id, source_app, agent_name, event_type, tool_name, tool_input, tool_output, timestamp, transcript_path)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ("uuid-1", "sess-1", "app-1", "agent-1", "PreToolUse", "Read", "{}", "{}", 1000.0, None)
        )
        conn.commit()
        conn.close()

        response = await client.get(
            "/events?session_id=sess-1",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        assert response.status == 200
        data = await response.json()
        assert len(data["events"]) == 1
        assert data["events"][0]["session_id"] == "sess-1"
        assert data["total"] == 1

    @pytest.mark.asyncio
    async def test_get_events_requires_session_id(self, client):
        """GET /events returns 400 without session_id."""
        response = await client.get(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        assert response.status == 400
        data = await response.json()
        assert "session_id query parameter required" in data["error"]

    @pytest.mark.asyncio
    async def test_get_sessions_returns_all_sessions(self, client):
        """GET /sessions returns all sessions with metadata."""
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        conn.execute(
            """INSERT INTO events (uuid, session_id, source_app, agent_name, event_type, tool_name, tool_input, tool_output, timestamp, transcript_path)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ("uuid-1", "sess-1", "app-1", "agent-1", "PreToolUse", "Read", "{}", "{}", 1000.0, None)
        )
        conn.execute(
            """INSERT INTO events (uuid, session_id, source_app, agent_name, event_type, tool_name, tool_input, tool_output, timestamp, transcript_path)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            ("uuid-2", "sess-2", "app-2", "agent-2", "PostToolUse", "Write", "{}", "{}", 2000.0, None)
        )
        conn.commit()
        conn.close()

        response = await client.get(
            "/sessions",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        assert response.status == 200
        data = await response.json()
        assert len(data["sessions"]) == 2
        # Should be ordered by start_time DESC (newest first)
        assert data["sessions"][0]["session_id"] == "sess-2"
        assert data["sessions"][1]["session_id"] == "sess-1"


class TestMessageEndpoints:
    """Tests for message handling endpoints."""

    @pytest.fixture(autouse=True)
    def setup_db(self, tmp_path):
        """Use a temporary database for tests."""
        import server
        self.original_db = server.DATABASE_PATH
        server.DATABASE_PATH = tmp_path / "test_events.db"
        server.init_db()
        yield
        server.DATABASE_PATH = self.original_db

    @pytest.fixture
    async def client(self):
        """Create a test client for the aiohttp app."""
        from server import create_app
        async with TestClient(TestServer(create_app())) as client:
            yield client

    @pytest.mark.asyncio
    async def test_post_message_stores_in_db(self, client):
        """POST /messages stores message in database."""
        response = await client.post(
            "/messages",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "target": "lead",
                "text": "Hello agent",
                "session_id": "test-session"
            }
        )
        assert response.status == 200
        data = await response.json()
        assert data["status"] == "message_received"
        assert data["target"] == "lead"
        assert data["text_length"] == len("Hello agent")

    @pytest.mark.asyncio
    async def test_get_messages_returns_for_target(self, client):
        """GET /messages/:target returns messages for that target."""
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        conn.execute(
            """INSERT INTO messages (uuid, target, text, session_id) VALUES (?, ?, ?, ?)""",
            ("uuid-1", "lead", "Message 1", "sess-1")
        )
        conn.execute(
            """INSERT INTO messages (uuid, target, text, session_id) VALUES (?, ?, ?, ?)""",
            ("uuid-2", "lead", "Message 2", "sess-2")
        )
        conn.execute(
            """INSERT INTO messages (uuid, target, text, session_id) VALUES (?, ?, ?, ?)""",
            ("uuid-3", "other", "Message 3", "sess-3")
        )
        conn.commit()
        conn.close()

        response = await client.get(
            "/messages/lead",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        assert response.status == 200
        data = await response.json()
        assert len(data["messages"]) == 2
        # Response format: {"messages": [{"session_id": "...", "text": "...", "created_at": ...}, ...]}
        assert all("session_id" in m and "text" in m for m in data["messages"])
        assert all(m["text"].startswith("Message") for m in data["messages"])


class TestDiagramEndpoints:
    """Tests for diagram endpoints."""

    @pytest.fixture
    async def client(self):
        """Create a test client for the aiohttp app."""
        from server import create_app
        async with TestClient(TestServer(create_app())) as client:
            yield client

    @pytest.mark.asyncio
    async def test_get_diagram_returns_file(self, client):
        """GET /diagrams/:name returns diagram file."""
        response = await client.get("/diagrams/system-overview")
        # File exists in repo
        assert response.status == 200
        # Response is text/markdown, not JSON
        content_type = response.headers.get("Content-Type", "")
        assert "text/markdown" in content_type
        text = await response.text()
        assert len(text) > 0
        assert "flowchart" in text or "graph" in text  # Mermaid diagram

    @pytest.mark.asyncio
    async def test_get_diagram_not_found(self, client):
        """GET /diagrams/:name returns 404 for missing file."""
        response = await client.get("/diagrams/nonexistent")
        assert response.status == 404
        data = await response.json()
        assert "Diagram not found" in data["error"]


# Mutation test: these tests should fail if the implementation is broken
class TestMutationChecks:
    """Tests designed to catch regressions (hand-made mutants)."""

    @pytest.fixture(autouse=True)
    def setup_db(self, tmp_path):
        """Use a temporary database for tests."""
        import server
        self.original_db = server.DATABASE_PATH
        server.DATABASE_PATH = tmp_path / "test_events.db"
        server.init_db()
        yield
        server.DATABASE_PATH = self.original_db

    @pytest.fixture
    async def client(self):
        """Create a test client for the aiohttp app."""
        from server import create_app
        async with TestClient(TestServer(create_app())) as client:
            yield client

    @pytest.mark.asyncio
    async def test_token_check_is_case_sensitive(self):
        """Token check should be case-sensitive."""
        class MockRequest:
            headers = {"Authorization": f"Bearer {TOKEN.upper()}"}
        # This should fail if token check is case-insensitive
        assert check_auth(MockRequest()) is False

    @pytest.mark.asyncio
    async def test_post_event_rejects_missing_fields(self, client):
        """POST /events should handle missing optional fields gracefully."""
        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={"type": "TestEvent"}
        )
        # Should succeed with defaults
        assert response.status == 200
        data = await response.json()
        assert data["status"] == "stored"

    @pytest.mark.asyncio
    async def test_get_events_pagination(self, client):
        """GET /events supports limit and offset."""
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        for i in range(5):
            conn.execute(
                """INSERT INTO events (uuid, session_id, source_app, agent_name, event_type, tool_name, tool_input, tool_output, timestamp, transcript_path)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (f"uuid-{i}", "sess-page", "app", "agent", "Test", "Tool", "{}", "{}", float(1000 + i), None)
            )
        conn.commit()
        conn.close()

        response = await client.get(
            "/events?session_id=sess-page&limit=2&offset=1",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        assert response.status == 200
        data = await response.json()
        assert len(data["events"]) == 2
        assert data["total"] == 5


if __name__ == "__main__":
    pytest.main([__file__, "-v"])