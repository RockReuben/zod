"""Tests for question handling endpoints (P5.4 agent questions)."""

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
    handle_post_question,
    handle_get_question_answer,
    handle_post_question_answer,
    handle_get_questions,
    DATABASE_PATH,
    TOKEN,
)


class TestQuestionsEndpoints:
    """Tests for question handling endpoints."""

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
    async def test_post_question_requires_auth(self, client):
        """POST /questions requires valid token."""
        response = await client.post(
            "/questions",
            headers={"Authorization": "Bearer invalid", "Content-Type": "application/json"},
            json={"session_id": "sess-1", "agent_name": "test-agent", "question": "What should I do?"}
        )
        assert response.status == 401

    @pytest.mark.asyncio
    async def test_post_question_requires_fields(self, client):
        """POST /questions requires session_id, agent_name, question."""
        response = await client.post(
            "/questions",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={"session_id": "sess-1"}
        )
        assert response.status == 400
        data = await response.json()
        assert "required" in data["error"]

    @pytest.mark.asyncio
    async def test_post_question_stores_and_returns_id(self, client):
        """POST /questions stores question and returns question_id and uuid."""
        response = await client.post(
            "/questions",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={"session_id": "sess-1", "agent_name": "test-agent", "question": "What should I do?"}
        )
        assert response.status == 200
        data = await response.json()
        assert "question_id" in data
        assert "uuid" in data
        assert isinstance(data["question_id"], int)
        assert isinstance(data["uuid"], str)

    @pytest.mark.asyncio
    async def test_get_questions_returns_pending(self, client):
        """GET /questions returns pending questions."""
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        conn.execute(
            """INSERT INTO questions (uuid, session_id, agent_name, question_text, status) VALUES (?, ?, ?, ?, ?)""",
            ("uuid-1", "sess-1", "test-agent", "Question 1", "pending")
        )
        conn.execute(
            """INSERT INTO questions (uuid, session_id, agent_name, question_text, status) VALUES (?, ?, ?, ?, ?)""",
            ("uuid-2", "sess-2", "other-agent", "Question 2", "answered")
        )
        conn.commit()
        conn.close()

        response = await client.get(
            "/questions",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        assert response.status == 200
        data = await response.json()
        assert "questions" in data
        assert len(data["questions"]) == 1
        assert data["questions"][0]["question_text"] == "Question 1"
        assert data["questions"][0]["status"] == "pending"

    @pytest.mark.asyncio
    async def test_get_questions_all_status(self, client):
        """GET /questions?status=all returns all questions."""
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        conn.execute(
            """INSERT INTO questions (uuid, session_id, agent_name, question_text, status) VALUES (?, ?, ?, ?, ?)""",
            ("uuid-1", "sess-1", "test-agent", "Question 1", "pending")
        )
        conn.execute(
            """INSERT INTO questions (uuid, session_id, agent_name, question_text, status) VALUES (?, ?, ?, ?, ?)""",
            ("uuid-2", "sess-2", "other-agent", "Question 2", "answered")
        )
        conn.commit()
        conn.close()

        response = await client.get(
            "/questions?status=all",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        assert response.status == 200
        data = await response.json()
        assert len(data["questions"]) == 2

    @pytest.mark.asyncio
    async def test_get_question_answer_pending(self, client):
        """GET /questions/:id/answer returns pending status before answer."""
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        conn.execute(
            """INSERT INTO questions (uuid, session_id, agent_name, question_text, status) VALUES (?, ?, ?, ?, ?)""",
            ("uuid-1", "sess-1", "test-agent", "Question 1", "pending")
        )
        conn.commit()
        q_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()

        response = await client.get(
            f"/questions/{q_id}/answer",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        assert response.status == 200
        data = await response.json()
        assert data["status"] == "pending"
        assert data["answer"] is None

    @pytest.mark.asyncio
    async def test_post_question_answer_requires_auth(self, client):
        """POST /questions/:id/answer requires valid token."""
        response = await client.post(
            "/questions/1/answer",
            headers={"Authorization": "Bearer invalid", "Content-Type": "application/json"},
            json={"answer": "Do this"}
        )
        assert response.status == 401

    @pytest.mark.asyncio
    async def test_post_question_answer_marks_answered(self, client):
        """POST /questions/:id/answer marks question as answered."""
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        conn.execute(
            """INSERT INTO questions (uuid, session_id, agent_name, question_text, status) VALUES (?, ?, ?, ?, ?)""",
            ("uuid-1", "sess-1", "test-agent", "Question 1", "pending")
        )
        conn.commit()
        q_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()

        response = await client.post(
            f"/questions/{q_id}/answer",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={"answer": "Do this instead"}
        )
        assert response.status == 200
        data = await response.json()
        assert data["status"] == "answered"
        assert data["question_id"] == q_id

        # Verify in database
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT answer_text, status, answered_at FROM questions WHERE id = ?", (q_id,)).fetchone()
        conn.close()
        assert row["answer_text"] == "Do this instead"
        assert row["status"] == "answered"
        assert row["answered_at"] is not None

        # Verify response question_id (JSON may return as string)
        assert str(data["question_id"]) == str(q_id)

    @pytest.mark.asyncio
    async def test_get_question_answer_after_answered(self, client):
        """GET /questions/:id/answer returns answer after it's posted."""
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        conn.execute(
            """INSERT INTO questions (uuid, session_id, agent_name, question_text, status) VALUES (?, ?, ?, ?, ?)""",
            ("uuid-1", "sess-1", "test-agent", "Question 1", "pending")
        )
        conn.commit()
        q_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        conn.close()

        # Post answer
        await client.post(
            f"/questions/{q_id}/answer",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={"answer": "The answer"}
        )

        # Retrieve answer
        response = await client.get(
            f"/questions/{q_id}/answer",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        assert response.status == 200
        data = await response.json()
        assert data["status"] == "answered"
        assert data["answer"] == "The answer"

    @pytest.mark.asyncio
    async def test_post_question_answer_requires_answer_field(self, client):
        """POST /questions/:id/answer requires answer field."""
        response = await client.post(
            "/questions/1/answer",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={}
        )
        assert response.status == 400
        data = await response.json()
        assert "answer is required" in data["error"]

    @pytest.mark.asyncio
    async def test_post_question_answer_not_found(self, client):
        """POST /questions/:id/answer returns 404 for nonexistent question."""
        response = await client.post(
            "/questions/999/answer",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={"answer": "Test"}
        )
        assert response.status == 404
        data = await response.json()
        assert "Question not found" in data["error"]


class TestQuestionsSchema:
    """Tests for questions table schema (P5.4 migration)."""

    @pytest.fixture(autouse=True)
    def setup_db(self, tmp_path):
        """Use a temporary database for tests."""
        import server
        self.original_db = server.DATABASE_PATH
        server.DATABASE_PATH = tmp_path / "test_events.db"
        server.init_db()
        yield
        server.DATABASE_PATH = self.original_db

    def test_questions_table_has_expected_columns(self, tmp_path):
        """Questions table has all expected columns."""
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(questions)")
        columns = {row[1] for row in cursor.fetchall()}
        conn.close()
        expected = {"id", "uuid", "session_id", "agent_name", "question_text", "answer_text", "status", "created_at", "answered_at"}
        assert expected.issubset(columns)

    def test_status_defaults_to_pending(self, tmp_path):
        """New questions have status = 'pending' by default."""
        import server
        conn = sqlite3.connect(str(server.DATABASE_PATH))
        conn.execute(
            """INSERT INTO questions (uuid, session_id, agent_name, question_text) VALUES (?, ?, ?, ?)""",
            ("uuid-1", "sess-1", "test-agent", "Test question")
        )
        conn.commit()
        cursor = conn.execute("SELECT status FROM questions WHERE uuid = ?", ("uuid-1",))
        row = cursor.fetchone()
        conn.close()
        assert row[0] == "pending"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])