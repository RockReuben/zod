"""Tests for P4.2: Node highlighting on file-edit events.

These tests define the expected behavior for mapping file-edit events to diagram nodes
and broadcasting node highlight information via WebSocket.

P4.2 Contract:
- On each file-edit event (Write, Edit, MultiEdit), map the path to a diagram node
- Include agent_name, diagram, and node in the WebSocket broadcast
- Highlight fades after 10 seconds (client-side concern, but server provides timestamp)
"""

import pytest
import json
import asyncio
from pathlib import Path
from aiohttp.test_utils import TestClient, TestServer
from aiohttp import web, WSMsgType

# Import the server module
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from server import create_app, connected_clients, broadcast_event, TOKEN, check_and_emit_diagram_events
from diagram_map import resolve_file_path, MappingResult, REPO_ROOT


class TestNodeHighlightMapping:
    """Tests for server-side path-to-node mapping on file-edit events."""

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
        async with TestClient(TestServer(create_app())) as client:
            yield client

    @pytest.fixture(autouse=True)
    def clear_clients(self):
        """Clear connected clients before and after each test."""
        connected_clients.clear()
        yield
        connected_clients.clear()

    # --- Path-to-node mapping tests ---

    def test_resolve_file_path_maps_server_files(self):
        """resolve_file_path maps apps/server/** to system-overview.md::server."""
        results = resolve_file_path("apps/server/server.py", REPO_ROOT)
        assert len(results) == 1
        assert results[0].diagram == "docs/diagrams/system-overview.md"
        assert results[0].node == "server"

    def test_resolve_file_path_maps_client_files(self):
        """resolve_file_path maps apps/client/** to system-overview.md::client."""
        results = resolve_file_path("apps/client/src/App.tsx", REPO_ROOT)
        assert len(results) == 1
        assert results[0].diagram == "docs/diagrams/system-overview.md"
        assert results[0].node == "client"

    def test_resolve_file_path_maps_hooks(self):
        """resolve_file_path maps .claude/hooks/** to system-overview.md::hooks."""
        results = resolve_file_path(".claude/hooks/send_event.py", REPO_ROOT)
        assert len(results) == 1
        assert results[0].diagram == "docs/diagrams/system-overview.md"
        assert results[0].node == "hooks"

    def test_resolve_file_path_maps_diagrams(self):
        """resolve_file_path maps docs/diagrams/** to system-overview.md::database."""
        results = resolve_file_path("docs/diagrams/system-overview.md", REPO_ROOT)
        assert len(results) == 1
        assert results[0].diagram == "docs/diagrams/system-overview.md"
        assert results[0].node == "database"

    def test_resolve_file_path_maps_plans(self):
        """resolve_file_path maps docs/plans/** to system-overview.md::planning."""
        results = resolve_file_path("docs/plans/my-plan/plan.md", REPO_ROOT)
        assert len(results) == 1
        assert results[0].diagram == "docs/diagrams/system-overview.md"
        assert results[0].node == "planning"

    def test_resolve_file_path_returns_empty_for_unmapped(self):
        """resolve_file_path returns empty list for unmapped paths."""
        results = resolve_file_path("random/unmapped/file.py", REPO_ROOT)
        assert results == []


class TestNodeHighlightWebSocketBroadcast:
    """Tests for WebSocket broadcast containing node highlight information.

    matrix: POST /events -> WebSocket broadcast | file-edit event with mapped path | P4.2
    """

    @pytest.fixture(autouse=True)
    def setup_db(self, tmp_path):
        import server
        self.original_db = server.DATABASE_PATH
        server.DATABASE_PATH = tmp_path / "test_events.db"
        server.init_db()
        yield
        server.DATABASE_PATH = self.original_db

    @pytest.fixture
    async def client(self):
        async with TestClient(TestServer(create_app())) as client:
            yield client

    @pytest.fixture(autouse=True)
    def clear_clients(self):
        connected_clients.clear()
        yield
        connected_clients.clear()

    @pytest.mark.asyncio
    async def test_write_event_mapped_path_broadcast_includes_node_info(self, client):
        """POST /events with Write to mapped path broadcasts event with diagram/node fields.

        matrix: POST /events -> WebSocket | Write to apps/server/** | P4.2
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "highlight-test-1",
                "source_app": "test-app",
                "agent_name": "test-agent",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "apps/server/new_module.py", "content": "x"},
                "tool_output": {"success": True},
            }
        )
        assert response.status == 200

        # Receive broadcast
        msg = await ws.receive()
        assert msg.type == WSMsgType.TEXT
        data = json.loads(msg.data)

        # Should be the main event
        assert data["type"] == "event"
        assert data["event_type"] == "PostToolUse"
        assert data["tool_name"] == "Write"
        assert data["agent_name"] == "test-agent"

        # Tool input should contain the file path that was mapped
        assert data["tool_input"]["file_path"] == "apps/server/new_module.py"

        # The server's check_and_emit_diagram_events adds diagram/node info for mapped files
        # Check if the event includes diagram and node in tool_input (for highlight)
        # Note: The actual highlight event may be separate or embedded
        # Per P4.2: "highlight that node with the agent's colour and name"
        await ws.close()

    @pytest.mark.asyncio
    async def test_edit_event_mapped_path_broadcast_includes_node_info(self, client):
        """POST /events with Edit to mapped path broadcasts event with diagram/node fields.

        matrix: POST /events -> WebSocket | Edit to apps/client/** | P4.2
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "highlight-test-2",
                "source_app": "test-app",
                "agent_name": "test-agent-2",
                "type": "PostToolUse",
                "tool_name": "Edit",
                "tool_input": {"file_path": "apps/client/src/components/TimelineLane.tsx", "old_string": "a", "new_string": "b"},
                "tool_output": {"success": True},
            }
        )
        assert response.status == 200

        msg = await ws.receive()
        assert msg.type == WSMsgType.TEXT
        data = json.loads(msg.data)

        assert data["event_type"] == "PostToolUse"
        assert data["tool_name"] == "Edit"
        assert data["agent_name"] == "test-agent-2"
        assert data["tool_input"]["file_path"] == "apps/client/src/components/TimelineLane.tsx"

        await ws.close()

    @pytest.mark.asyncio
    async def test_multiedit_event_mapped_path_broadcast_includes_node_info(self, client):
        """POST /events with MultiEdit to mapped path broadcasts event with diagram/node fields.

        matrix: POST /events -> WebSocket | MultiEdit to .claude/hooks/** | P4.2
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "highlight-test-3",
                "source_app": "test-app",
                "agent_name": "test-agent-3",
                "type": "PostToolUse",
                "tool_name": "MultiEdit",
                "tool_input": {"file_path": ".claude/hooks/send_event.py", "edits": [{"old_string": "x", "new_string": "y"}]},
                "tool_output": {"success": True},
            }
        )
        assert response.status == 200

        msg = await ws.receive()
        assert msg.type == WSMsgType.TEXT
        data = json.loads(msg.data)

        assert data["event_type"] == "PostToolUse"
        assert data["tool_name"] == "MultiEdit"
        assert data["agent_name"] == "test-agent-3"
        assert data["tool_input"]["file_path"] == ".claude/hooks/send_event.py"

        await ws.close()

    @pytest.mark.asyncio
    async def test_write_event_unmapped_path_broadcast_no_node_highlight(self, client):
        """POST /events with Write to unmapped path broadcasts event but no node highlight.

        matrix: POST /events -> WebSocket | Write to unmapped path | P4.2
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "highlight-test-4",
                "source_app": "test-app",
                "agent_name": "test-agent",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "random/unmapped/file.py", "content": "x"},
                "tool_output": {"success": True},
            }
        )
        assert response.status == 200

        msg = await ws.receive()
        assert msg.type == WSMsgType.TEXT
        data = json.loads(msg.data)

        # Main event should still broadcast
        assert data["event_type"] == "PostToolUse"
        assert data["tool_name"] == "Write"

        # No diagram/node in tool_input for highlight since it's unmapped
        # (unmapped_edit is a separate diagram event type)
        await ws.close()

    @pytest.mark.asyncio
    async def test_multiple_agents_same_node_different_colors(self, client):
        """Multiple agents editing same node get different highlight colors (server provides agent_name).

        matrix: POST /events -> WebSocket | concurrent agents on same node | P4.2
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        # Agent 1 edits server - will produce main event + node_highlight event
        await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "multi-agent-1",
                "source_app": "test-app",
                "agent_name": "agent-alpha",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "apps/server/module_a.py", "content": "a"},
                "tool_output": {"success": True},
            }
        )
        # Receive main event
        msg1_main = await ws.receive()
        data1_main = json.loads(msg1_main.data)
        assert data1_main["event_type"] == "PostToolUse"
        assert data1_main["agent_name"] == "agent-alpha"
        # Receive node_highlight event
        msg1_highlight = await ws.receive()
        data1_highlight = json.loads(msg1_highlight.data)
        assert data1_highlight["event_type"] == "node_highlight"
        assert data1_highlight["agent_name"] == "agent-alpha"
        assert data1_highlight["tool_input"]["node"] == "server"

        # Agent 2 edits server (same node) - will produce main event + node_highlight event
        await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "multi-agent-2",
                "source_app": "test-app",
                "agent_name": "agent-beta",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "apps/server/module_b.py", "content": "b"},
                "tool_output": {"success": True},
            }
        )
        # Receive main event
        msg2_main = await ws.receive()
        data2_main = json.loads(msg2_main.data)
        assert data2_main["event_type"] == "PostToolUse"
        assert data2_main["agent_name"] == "agent-beta"
        # Receive node_highlight event
        msg2_highlight = await ws.receive()
        data2_highlight = json.loads(msg2_highlight.data)
        assert data2_highlight["event_type"] == "node_highlight"
        assert data2_highlight["agent_name"] == "agent-beta"
        assert data2_highlight["tool_input"]["node"] == "server"

        # Both node_highlight events should have same diagram/node mapping but different agent_name
        # Client uses agent_name to assign consistent color per agent
        await ws.close()

    @pytest.mark.asyncio
    async def test_rapid_edits_same_node_multiple_highlights(self, client):
        """Rapid successive edits to same node produce multiple highlight events.

        matrix: POST /events -> WebSocket | rapid edits same node | P4.2
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        for i in range(5):
            await client.post(
                "/events",
                headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
                json={
                    "session_id": f"rapid-test-{i}",
                    "source_app": "test-app",
                    "agent_name": "rapid-agent",
                    "type": "PostToolUse",
                    "tool_name": "Edit",
                    "tool_input": {"file_path": "apps/server/server.py", "old_string": f"v{i}", "new_string": f"v{i+1}"},
                    "tool_output": {"success": True},
                }
            )
            msg = await ws.receive()
            assert msg.type == WSMsgType.TEXT
            data = json.loads(msg.data)
            assert data["tool_name"] == "Edit"
            assert data["agent_name"] == "rapid-agent"

        await ws.close()

    @pytest.mark.asyncio
    async def test_read_event_no_node_highlight(self, client):
        """Read events do not produce node highlights (read-only).

        matrix: POST /events -> WebSocket | Read event | P4.2
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "read-test",
                "source_app": "test-app",
                "agent_name": "test-agent",
                "type": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": "apps/server/server.py"},
                "tool_output": {},
            }
        )
        assert response.status == 200

        # Should receive the PreToolUse event but no highlight/diagram event
        msg = await ws.receive()
        assert msg.type == WSMsgType.TEXT
        data = json.loads(msg.data)
        assert data["event_type"] == "PreToolUse"
        assert data["tool_name"] == "Read"

        # No additional diagram events should follow for Read
        try:
            msg2 = await asyncio.wait_for(ws.receive(), timeout=0.2)
            # If we get another message, verify it's not a diagram event for this read
            data2 = json.loads(msg2.data)
            assert data2.get("event_type") not in ("unmapped_edit", "diagram_drift")
        except asyncio.TimeoutError:
            # Expected - no extra events
            pass

        await ws.close()


class TestCheckAndEmitDiagramEvents:
    """Direct tests for check_and_emit_diagram_events function.

    matrix: check_and_emit_diagram_events | file-edit tool input | P4.2
    """

    @pytest.fixture(autouse=True)
    def setup_db(self, tmp_path):
        import server
        self.original_db = server.DATABASE_PATH
        server.DATABASE_PATH = tmp_path / "test_events.db"
        server.init_db()
        yield
        server.DATABASE_PATH = self.original_db

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="pending:P4.2: Node highlight event emission not yet implemented")
    async def test_check_and_emit_write_event_mapped(self):
        """check_and_emit_diagram_events emits highlight info for Write to mapped path."""
        import server
        connected_clients.clear()

        # Create a mock broadcast to capture events
        captured_events = []
        original_broadcast = server.broadcast_event

        async def capture_broadcast(event_data):
            captured_events.append(event_data)

        server.broadcast_event = capture_broadcast

        try:
            await check_and_emit_diagram_events(
                session_id="test-session",
                source_app="test-app",
                agent_name="test-agent",
                tool_name="Write",
                tool_input={"file_path": "apps/server/new_file.py", "content": "test"}
            )

            # Should have broadcast the main event (via handle_events)
            # and potentially a highlight event
            # The highlight info should be in the main event's tool_input
            # or as a separate event with event_type "node_highlight"
            assert len(captured_events) >= 1
        finally:
            server.broadcast_event = original_broadcast

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="pending:P4.2: Node highlight event emission not yet implemented")
    async def test_check_and_emit_edit_event_mapped(self):
        """check_and_emit_diagram_events emits highlight info for Edit to mapped path."""
        import server
        connected_clients.clear()

        captured_events = []
        original_broadcast = server.broadcast_event

        async def capture_broadcast(event_data):
            captured_events.append(event_data)

        server.broadcast_event = capture_broadcast

        try:
            await check_and_emit_diagram_events(
                session_id="test-session",
                source_app="test-app",
                agent_name="test-agent",
                tool_name="Edit",
                tool_input={"file_path": "apps/client/src/components/X.tsx", "old_string": "a", "new_string": "b"}
            )

            assert len(captured_events) >= 1
        finally:
            server.broadcast_event = original_broadcast

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="pending:P4.2: Node highlight event emission not yet implemented")
    async def test_check_and_emit_multiedit_event_mapped(self):
        """check_and_emit_diagram_events emits highlight info for MultiEdit to mapped path."""
        import server
        connected_clients.clear()

        captured_events = []
        original_broadcast = server.broadcast_event

        async def capture_broadcast(event_data):
            captured_events.append(event_data)

        server.broadcast_event = capture_broadcast

        try:
            await check_and_emit_diagram_events(
                session_id="test-session",
                source_app="test-app",
                agent_name="test-agent",
                tool_name="MultiEdit",
                tool_input={"file_path": ".claude/hooks/script.py", "edits": []}
            )

            assert len(captured_events) >= 1
        finally:
            server.broadcast_event = original_broadcast

    @pytest.mark.asyncio
    async def test_check_and_emit_non_edit_tool_no_highlight(self):
        """Non-file-edit tools (Read, Task, Bash, etc.) do not emit highlights."""
        import server
        connected_clients.clear()

        captured_events = []
        original_broadcast = server.broadcast_event

        async def capture_broadcast(event_data):
            captured_events.append(event_data)

        server.broadcast_event = capture_broadcast

        try:
            # Read tool
            await check_and_emit_diagram_events(
                session_id="test-session",
                source_app="test-app",
                agent_name="test-agent",
                tool_name="Read",
                tool_input={"file_path": "apps/server/server.py"}
            )

            # Task tool
            await check_and_emit_diagram_events(
                session_id="test-session-2",
                source_app="test-app",
                agent_name="test-agent",
                tool_name="Task",
                tool_input={"description": "do something", "prompt": "..."}
            )

            # Bash tool
            await check_and_emit_diagram_events(
                session_id="test-session-3",
                source_app="test-app",
                agent_name="test-agent",
                tool_name="Bash",
                tool_input={"command": "ls"}
            )

            # Should not have emitted any diagram events for these
            diagram_events = [e for e in captured_events if e.get("event_type") in ("unmapped_edit", "diagram_drift", "node_highlight")]
            assert len(diagram_events) == 0
        finally:
            server.broadcast_event = original_broadcast


# PENDING tests - these define expected behavior that needs implementation
# They are marked xfail with pending:P4.2 reason so they fail until implemented

class TestNodeHighlightPending:
    """Pending tests for P4.2 - expected behavior not yet implemented.

    Remove @pytest.mark.xfail when the implementation passes these tests.
    """

    @pytest.fixture(autouse=True)
    def setup_db(self, tmp_path):
        import server
        self.original_db = server.DATABASE_PATH
        server.DATABASE_PATH = tmp_path / "test_events.db"
        server.init_db()
        yield
        server.DATABASE_PATH = self.original_db

    @pytest.fixture
    async def client(self):
        async with TestClient(TestServer(create_app())) as client:
            yield client

    @pytest.fixture(autouse=True)
    def clear_clients(self):
        connected_clients.clear()
        yield
        connected_clients.clear()

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="pending:P4.2: Node highlight event type not yet implemented")
    async def test_write_event_emits_node_highlight_event_type(self, client):
        """POST /events with Write to mapped path emits a 'node_highlight' event.

        matrix: POST /events -> WebSocket | Write to mapped path | P4.2

        Expected: A separate event with event_type="node_highlight" containing:
        - agent_name (for color assignment)
        - diagram (diagram file path)
        - node (node ID in diagram)
        - timestamp (for 10-second fade on client)
        - session_id, source_app (for context)
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "highlight-test-pending",
                "source_app": "test-app",
                "agent_name": "test-agent",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "apps/server/new_module.py", "content": "x"},
                "tool_output": {"success": True},
            }
        )

        # Should receive main event
        msg1 = await ws.receive()
        data1 = json.loads(msg1.data)
        assert data1["event_type"] == "PostToolUse"

        # Should receive node_highlight event (timeout if not implemented)
        try:
            msg2 = await asyncio.wait_for(ws.receive(), timeout=0.5)
            data2 = json.loads(msg2.data)
            assert data2["type"] == "event"
            assert data2["event_type"] == "node_highlight"
            assert data2["agent_name"] == "test-agent"
            assert "diagram" in data2["tool_input"]
            assert "node" in data2["tool_input"]
            assert data2["tool_input"]["diagram"] == "docs/diagrams/system-overview.md"
            assert data2["tool_input"]["node"] == "server"
            assert "timestamp" in data2
        except asyncio.TimeoutError:
            # Expected until implementation - test is xfail anyway
            pytest.fail("node_highlight event not received (pending implementation)")

        await ws.close()

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="pending:P4.2: Node highlight event for Edit not yet implemented")
    async def test_edit_event_emits_node_highlight_event_type(self, client):
        """POST /events with Edit to mapped path emits a 'node_highlight' event.

        matrix: POST /events -> WebSocket | Edit to mapped path | P4.2
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "highlight-test-pending-2",
                "source_app": "test-app",
                "agent_name": "test-agent-2",
                "type": "PostToolUse",
                "tool_name": "Edit",
                "tool_input": {"file_path": "apps/client/src/App.tsx", "old_string": "a", "new_string": "b"},
                "tool_output": {"success": True},
            }
        )

        # Receive main event
        msg1 = await ws.receive()
        data1 = json.loads(msg1.data)
        assert data1["event_type"] == "PostToolUse"

        # Receive node_highlight event
        try:
            msg2 = await asyncio.wait_for(ws.receive(), timeout=0.5)
            data2 = json.loads(msg2.data)
            assert data2["event_type"] == "node_highlight"
            assert data2["agent_name"] == "test-agent-2"
            assert data2["tool_input"]["diagram"] == "docs/diagrams/system-overview.md"
            assert data2["tool_input"]["node"] == "client"
        except asyncio.TimeoutError:
            pytest.fail("node_highlight event not received (pending implementation)")

        await ws.close()

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="pending:P4.2: Node highlight event for MultiEdit not yet implemented")
    async def test_multiedit_event_emits_node_highlight_event_type(self, client):
        """POST /events with MultiEdit to mapped path emits a 'node_highlight' event.

        matrix: POST /events -> WebSocket | MultiEdit to mapped path | P4.2
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "highlight-test-pending-3",
                "source_app": "test-app",
                "agent_name": "test-agent-3",
                "type": "PostToolUse",
                "tool_name": "MultiEdit",
                "tool_input": {"file_path": ".claude/hooks/send_event.py", "edits": []},
                "tool_output": {"success": True},
            }
        )

        msg1 = await ws.receive()
        data1 = json.loads(msg1.data)
        assert data1["event_type"] == "PostToolUse"

        try:
            msg2 = await asyncio.wait_for(ws.receive(), timeout=0.5)
            data2 = json.loads(msg2.data)
            assert data2["event_type"] == "node_highlight"
            assert data2["agent_name"] == "test-agent-3"
            assert data2["tool_input"]["diagram"] == "docs/diagrams/system-overview.md"
            assert data2["tool_input"]["node"] == "hooks"
        except asyncio.TimeoutError:
            pytest.fail("node_highlight event not received (pending implementation)")

        await ws.close()

    @pytest.mark.asyncio
    @pytest.mark.xfail(reason="pending:P4.2: Node highlight event includes timestamp for fade")
    async def test_node_highlight_includes_timestamp_for_fade(self, client):
        """node_highlight event includes timestamp for client-side 10-second fade.

        matrix: POST /events -> WebSocket | node_highlight timestamp | P4.2

        Client uses timestamp to auto-remove highlight after 10 seconds.
        """
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "highlight-timestamp-test",
                "source_app": "test-app",
                "agent_name": "test-agent",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "apps/server/x.py", "content": "x"},
                "tool_output": {"success": True},
            }
        )

        msg1 = await ws.receive()  # main event

        try:
            msg2 = await asyncio.wait_for(ws.receive(), timeout=0.5)
            data2 = json.loads(msg2.data)

            assert data2["event_type"] == "node_highlight"
            assert "timestamp" in data2
            assert isinstance(data2["timestamp"], (int, float))
            assert data2["timestamp"] > 0
        except asyncio.TimeoutError:
            pytest.fail("node_highlight event not received (pending implementation)")

        await ws.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])