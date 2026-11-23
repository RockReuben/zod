"""Spec tests for P4.2: Node highlighting on file-edit events.

These tests are written from the contract alone (spec mode), before implementation.
They use strict-flip expected-failure markers with reason "pending:P4.2".

Contract (from zod-control-center.md P4.2):
- On each file-edit event, map the path to a node and highlight that node
  with the agent's colour and name.
- Fade after 10 seconds (client-side, but server provides timestamp).
- Done when: Editing a mapped file in a live session lights the matching
  node within two seconds.

Interfaces involved:
- POST /events (external, untrusted) -> WebSocket broadcast (internal)
- check_and_emit_diagram_events (internal) -> emit_diagram_event (internal)
- diagram_map.resolve_file_path (internal) -> MappingResult
"""

import pytest
import json
import asyncio
import os
from pathlib import Path
from aiohttp.test_utils import TestClient, TestServer
from aiohttp import web, WSMsgType

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from server import create_app, connected_clients, TOKEN, check_and_emit_diagram_events, emit_diagram_event
from diagram_map import resolve_file_path, MappingResult, REPO_ROOT, normalize_file_path


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    """Use a temporary database for each test."""
    import server
    from diagram_map import REPO_ROOT
    import time

    # Update diagram file mtime to be current so no drift is detected
    diagram_path = REPO_ROOT / 'docs' / 'diagrams' / 'system-overview.md'
    if diagram_path.exists():
        os.utime(diagram_path, (time.time(), time.time()))

    original_db = server.DATABASE_PATH
    server.DATABASE_PATH = tmp_path / "test_events.db"
    server.init_db()
    yield
    server.DATABASE_PATH = original_db


@pytest.fixture
async def client():
    """Create a test client for the aiohttp app."""
    async with TestClient(TestServer(create_app())) as client:
        yield client


@pytest.fixture(autouse=True)
def clear_ws_clients():
    """Clear connected WebSocket clients before and after each test."""
    connected_clients.clear()
    yield
    connected_clients.clear()


# =============================================================================
# ENTRY POINT: POST /events -> WebSocket broadcast
# Trust: EXTERNAL (hook payload from agent)
# =============================================================================

class TestPostEventsFileEditMappedPath:
    """POST /events with file-edit tools (Write, Edit, MultiEdit) to mapped paths.

    matrix: POST /events -> WebSocket broadcast | file-edit tool + mapped path | P4.2
    Input class: Valid / typical
    """

    @pytest.mark.asyncio
    async def test_write_to_server_maps_to_server_node(self, client):
        """Write event to apps/server/** emits node_highlight for 'server' node."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-write-server-1",
                "source_app": "test-app",
                "agent_name": "backend-agent",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "apps/server/new_module.py", "content": "print('hello')"},
                "tool_output": {"success": True},
            }
        )
        assert response.status == 200

        # Receive main event
        msg1 = await ws.receive()
        data1 = json.loads(msg1.data)
        assert data1["event_type"] == "PostToolUse"
        assert data1["tool_name"] == "Write"

        # Receive node_highlight event
        msg2 = await asyncio.wait_for(ws.receive(), timeout=0.5)
        data2 = json.loads(msg2.data)
        assert data2["type"] == "event"
        assert data2["event_type"] == "node_highlight"
        assert data2["agent_name"] == "backend-agent"
        assert data2["tool_input"]["diagram"] == "docs/diagrams/system-overview.md"
        assert data2["tool_input"]["node"] == "server"
        assert "timestamp" in data2
        assert isinstance(data2["timestamp"], (int, float))

        await ws.close()

    @pytest.mark.asyncio
    async def test_edit_to_client_maps_to_client_node(self, client):
        """Edit event to apps/client/** emits node_highlight for 'client' node."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-edit-client-1",
                "source_app": "test-app",
                "agent_name": "frontend-agent",
                "type": "PostToolUse",
                "tool_name": "Edit",
                "tool_input": {"file_path": "apps/client/src/App.tsx", "old_string": "old", "new_string": "new"},
                "tool_output": {"success": True},
            }
        )
        assert response.status == 200

        msg1 = await ws.receive()  # main event
        msg2 = await asyncio.wait_for(ws.receive(), timeout=0.5)
        data2 = json.loads(msg2.data)

        assert data2["event_type"] == "node_highlight"
        assert data2["agent_name"] == "frontend-agent"
        assert data2["tool_input"]["diagram"] == "docs/diagrams/system-overview.md"
        assert data2["tool_input"]["node"] == "client"

        await ws.close()

    @pytest.mark.asyncio
    async def test_multiedit_to_hooks_maps_to_hooks_node(self, client):
        """MultiEdit event to .claude/hooks/** emits node_highlight for 'hooks' node."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-multiedit-hooks-1",
                "source_app": "test-app",
                "agent_name": "hooks-agent",
                "type": "PostToolUse",
                "tool_name": "MultiEdit",
                "tool_input": {"file_path": ".claude/hooks/send_event.py", "edits": [{"old_string": "a", "new_string": "b"}]},
                "tool_output": {"success": True},
            }
        )
        assert response.status == 200

        msg1 = await ws.receive()
        msg2 = await asyncio.wait_for(ws.receive(), timeout=0.5)
        data2 = json.loads(msg2.data)

        assert data2["event_type"] == "node_highlight"
        assert data2["agent_name"] == "hooks-agent"
        assert data2["tool_input"]["diagram"] == "docs/diagrams/system-overview.md"
        assert data2["tool_input"]["node"] == "hooks"

        await ws.close()

    @pytest.mark.asyncio
    async def test_write_to_diagrams_maps_to_database_node(self, client):
        """Write event to docs/diagrams/** emits node_highlight for 'database' node."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-write-diagrams-1",
                "source_app": "test-app",
                "agent_name": "diagram-agent",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "docs/diagrams/new-diagram.md", "content": "graph TD\nA --> B"},
                "tool_output": {"success": True},
            }
        )
        assert response.status == 200

        msg1 = await ws.receive()
        msg2 = await asyncio.wait_for(ws.receive(), timeout=0.5)
        data2 = json.loads(msg2.data)

        assert data2["event_type"] == "node_highlight"
        assert data2["agent_name"] == "diagram-agent"
        assert data2["tool_input"]["diagram"] == "docs/diagrams/system-overview.md"
        assert data2["tool_input"]["node"] == "database"

        await ws.close()

    @pytest.mark.asyncio
    async def test_write_to_plans_maps_to_planning_node(self, client):
        """Write event to docs/plans/** emits node_highlight for 'planning' node."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-write-plans-1",
                "source_app": "test-app",
                "agent_name": "planning-agent",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "docs/plans/my-plan/plan.md", "content": "# Plan"},
                "tool_output": {"success": True},
            }
        )
        assert response.status == 200

        msg1 = await ws.receive()
        msg2 = await asyncio.wait_for(ws.receive(), timeout=0.5)
        data2 = json.loads(msg2.data)

        assert data2["event_type"] == "node_highlight"
        assert data2["agent_name"] == "planning-agent"
        assert data2["tool_input"]["diagram"] == "docs/diagrams/system-overview.md"
        assert data2["tool_input"]["node"] == "planning"

        await ws.close()


class TestPostEventsFileEditUnmappedPath:
    """POST /events with file-edit tools to unmapped paths.

    matrix: POST /events -> WebSocket broadcast | file-edit tool + unmapped path | P4.2
    Input class: Valid / typical
    Expected: unmapped_edit event, NOT node_highlight
    """

    @pytest.mark.asyncio
    async def test_write_to_unmapped_path_emits_unmapped_edit_not_highlight(self, client):
        """Write to unmapped path emits unmapped_edit, not node_highlight."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-unmapped-1",
                "source_app": "test-app",
                "agent_name": "test-agent",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "random/unmapped/file.py", "content": "x"},
                "tool_output": {"success": True},
            }
        )
        assert response.status == 200

        msg1 = await ws.receive()
        data1 = json.loads(msg1.data)
        assert data1["event_type"] == "PostToolUse"

        # Should receive unmapped_edit event, not node_highlight
        msg2 = await asyncio.wait_for(ws.receive(), timeout=0.5)
        data2 = json.loads(msg2.data)
        assert data2["event_type"] == "unmapped_edit"
        assert data2["tool_input"]["file_path"] == "random/unmapped/file.py"

        # No further diagram events for this edit
        try:
            msg3 = await asyncio.wait_for(ws.receive(), timeout=0.2)
            data3 = json.loads(msg3.data)
            assert data3.get("event_type") not in ("node_highlight", "diagram_drift")
        except asyncio.TimeoutError:
            pass  # Expected - no more events

        await ws.close()


class TestPostEventsNonFileEditTools:
    """POST /events with non-file-edit tools (Read, Task, Bash, etc.).

    matrix: POST /events -> WebSocket broadcast | non-file-edit tool | P4.2
    Input class: Valid / typical
    Expected: No diagram events (unmapped_edit, diagram_drift, node_highlight)
    """

    @pytest.mark.asyncio
    async def test_read_tool_no_diagram_events(self, client):
        """Read tool does not emit any diagram events."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-read-1",
                "source_app": "test-app",
                "agent_name": "test-agent",
                "type": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": "apps/server/server.py"},
                "tool_output": {},
            }
        )
        assert response.status == 200

        msg1 = await ws.receive()
        data1 = json.loads(msg1.data)
        assert data1["event_type"] == "PreToolUse"
        assert data1["tool_name"] == "Read"

        # No diagram events should follow
        try:
            msg2 = await asyncio.wait_for(ws.receive(), timeout=0.2)
            data2 = json.loads(msg2.data)
            assert data2.get("event_type") not in ("unmapped_edit", "diagram_drift", "node_highlight")
        except asyncio.TimeoutError:
            pass

        await ws.close()

    @pytest.mark.asyncio
    async def test_task_tool_no_diagram_events(self, client):
        """Task tool does not emit any diagram events."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-task-1",
                "source_app": "test-app",
                "agent_name": "test-agent",
                "type": "PreToolUse",
                "tool_name": "Task",
                "tool_input": {"description": "do something", "prompt": "..."},
                "tool_output": {},
            }
        )
        assert response.status == 200

        msg1 = await ws.receive()
        data1 = json.loads(msg1.data)
        assert data1["tool_name"] == "Task"

        try:
            msg2 = await asyncio.wait_for(ws.receive(), timeout=0.2)
            data2 = json.loads(msg2.data)
            assert data2.get("event_type") not in ("unmapped_edit", "diagram_drift", "node_highlight")
        except asyncio.TimeoutError:
            pass

        await ws.close()

    @pytest.mark.asyncio
    async def test_bash_tool_no_diagram_events(self, client):
        """Bash tool does not emit any diagram events."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-bash-1",
                "source_app": "test-app",
                "agent_name": "test-agent",
                "type": "PreToolUse",
                "tool_name": "Bash",
                "tool_input": {"command": "ls"},
                "tool_output": {},
            }
        )
        assert response.status == 200

        msg1 = await ws.receive()
        data1 = json.loads(msg1.data)
        assert data1["tool_name"] == "Bash"

        try:
            msg2 = await asyncio.wait_for(ws.receive(), timeout=0.2)
            data2 = json.loads(msg2.data)
            assert data2.get("event_type") not in ("unmapped_edit", "diagram_drift", "node_highlight")
        except asyncio.TimeoutError:
            pass

        await ws.close()


class TestPostEventsMultipleAgentsSameNode:
    """Multiple agents editing the same node.

    matrix: POST /events -> WebSocket broadcast | concurrent agents same node | P4.2
    Input class: Valid / typical
    Expected: Each agent gets separate node_highlight with their agent_name
    """

    @pytest.mark.asyncio
    async def test_two_agents_same_node_different_highlights(self, client):
        """Two agents editing same node produce two node_highlight events with different agent_name."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        # Agent 1
        await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-multi-1",
                "source_app": "test-app",
                "agent_name": "agent-alpha",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "apps/server/module_a.py", "content": "a"},
                "tool_output": {"success": True},
            }
        )
        msg1_main = await ws.receive()
        msg1_hl = await asyncio.wait_for(ws.receive(), timeout=0.5)
        data1_hl = json.loads(msg1_hl.data)
        assert data1_hl["event_type"] == "node_highlight"
        assert data1_hl["agent_name"] == "agent-alpha"
        assert data1_hl["tool_input"]["node"] == "server"

        # Agent 2
        await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "p42-multi-2",
                "source_app": "test-app",
                "agent_name": "agent-beta",
                "type": "PostToolUse",
                "tool_name": "Write",
                "tool_input": {"file_path": "apps/server/module_b.py", "content": "b"},
                "tool_output": {"success": True},
            }
        )
        msg2_main = await ws.receive()
        msg2_hl = await asyncio.wait_for(ws.receive(), timeout=0.5)
        data2_hl = json.loads(msg2_hl.data)
        assert data2_hl["event_type"] == "node_highlight"
        assert data2_hl["agent_name"] == "agent-beta"
        assert data2_hl["tool_input"]["node"] == "server"

        await ws.close()


class TestPostEventsRapidEdits:
    """Rapid successive edits to the same node.

    matrix: POST /events -> WebSocket broadcast | rapid edits same node | P4.2
    Input class: Valid / typical (high frequency)
    Expected: Each edit produces a node_highlight event with fresh timestamp
    """

    @pytest.mark.asyncio
    async def test_rapid_edits_produce_multiple_highlights(self, client):
        """5 rapid edits produce 5 node_highlight events."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        for i in range(5):
            await client.post(
                "/events",
                headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
                json={
                    "session_id": f"p42-rapid-{i}",
                    "source_app": "test-app",
                    "agent_name": "rapid-agent",
                    "type": "PostToolUse",
                    "tool_name": "Edit",
                    "tool_input": {"file_path": "apps/server/server.py", "old_string": f"v{i}", "new_string": f"v{i+1}"},
                    "tool_output": {"success": True},
                }
            )
            msg_main = await ws.receive()
            msg_hl = await asyncio.wait_for(ws.receive(), timeout=0.5)
            data_hl = json.loads(msg_hl.data)
            assert data_hl["event_type"] == "node_highlight"
            assert data_hl["agent_name"] == "rapid-agent"
            assert data_hl["tool_input"]["node"] == "server"
            assert "timestamp" in data_hl

        await ws.close()


# =============================================================================
# INTERNAL: check_and_emit_diagram_events function
# Trust: INTERNAL (called from handle_events)
# =============================================================================

class TestCheckAndEmitDiagramEvents:
    """Direct unit tests for check_and_emit_diagram_events function.

    matrix: check_and_emit_diagram_events | file-edit tool input | P4.2
    Input class: Valid / typical
    """

    @pytest.mark.asyncio
    async def test_write_emits_node_highlight(self):
        """check_and_emit_diagram_events for Write to mapped path emits node_highlight."""
        import server
        connected_clients.clear()

        captured = []
        original_broadcast = server.broadcast_event

        async def capture(event_data):
            captured.append(event_data)

        server.broadcast_event = capture

        try:
            await check_and_emit_diagram_events(
                session_id="p42-check-write",
                source_app="test-app",
                agent_name="test-agent",
                tool_name="Write",
                tool_input={"file_path": "apps/server/new_file.py", "content": "test"}
            )

            # Wait for async broadcast
            await asyncio.sleep(0.1)

            # Should have broadcast at least one diagram event
            diagram_events = [e for e in captured if e.get("event_type") in ("unmapped_edit", "diagram_drift", "node_highlight")]
            node_highlights = [e for e in captured if e.get("event_type") == "node_highlight"]
            assert len(node_highlights) >= 1
            hl = node_highlights[0]
            assert hl["agent_name"] == "test-agent"
            assert hl["tool_input"]["diagram"] == "docs/diagrams/system-overview.md"
            assert hl["tool_input"]["node"] == "server"
            assert "timestamp" in hl
        finally:
            server.broadcast_event = original_broadcast

    @pytest.mark.asyncio
    async def test_edit_emits_node_highlight(self):
        """check_and_emit_diagram_events for Edit to mapped path emits node_highlight."""
        import server
        connected_clients.clear()

        captured = []
        original_broadcast = server.broadcast_event

        async def capture(event_data):
            captured.append(event_data)

        server.broadcast_event = capture

        try:
            await check_and_emit_diagram_events(
                session_id="p42-check-edit",
                source_app="test-app",
                agent_name="test-agent",
                tool_name="Edit",
                tool_input={"file_path": "apps/client/src/X.tsx", "old_string": "a", "new_string": "b"}
            )

            # Wait for async broadcast
            await asyncio.sleep(0.05)

            node_highlights = [e for e in captured if e.get("event_type") == "node_highlight"]
            assert len(node_highlights) >= 1
            hl = node_highlights[0]
            assert hl["tool_input"]["node"] == "client"
        finally:
            server.broadcast_event = original_broadcast

    @pytest.mark.asyncio
    async def test_multiedit_emits_node_highlight(self):
        """check_and_emit_diagram_events for MultiEdit to mapped path emits node_highlight."""
        import server
        connected_clients.clear()

        captured = []
        original_broadcast = server.broadcast_event

        async def capture(event_data):
            captured.append(event_data)

        server.broadcast_event = capture

        try:
            await check_and_emit_diagram_events(
                session_id="p42-check-multiedit",
                source_app="test-app",
                agent_name="test-agent",
                tool_name="MultiEdit",
                tool_input={"file_path": ".claude/hooks/script.py", "edits": []}
            )

            # Wait for async broadcast
            await asyncio.sleep(0.05)

            node_highlights = [e for e in captured if e.get("event_type") == "node_highlight"]
            assert len(node_highlights) >= 1
            hl = node_highlights[0]
            assert hl["tool_input"]["node"] == "hooks"
        finally:
            server.broadcast_event = original_broadcast

    @pytest.mark.asyncio
    async def test_non_edit_tools_no_diagram_events(self):
        """Non-file-edit tools do not emit diagram events."""
        import server
        connected_clients.clear()

        captured = []
        original_broadcast = server.broadcast_event

        async def capture(event_data):
            captured.append(event_data)

        server.broadcast_event = capture

        try:
            for tool_name, tool_input in [
                ("Read", {"file_path": "apps/server/server.py"}),
                ("Task", {"description": "x", "prompt": "y"}),
                ("Bash", {"command": "ls"}),
                ("Grep", {"pattern": "foo"}),
                ("Glob", {"pattern": "**/*.py"}),
            ]:
                await check_and_emit_diagram_events(
                    session_id=f"p42-check-{tool_name.lower()}",
                    source_app="test-app",
                    agent_name="test-agent",
                    tool_name=tool_name,
                    tool_input=tool_input
                )

            diagram_events = [e for e in captured if e.get("event_type") in ("unmapped_edit", "diagram_drift", "node_highlight")]
            assert len(diagram_events) == 0
        finally:
            server.broadcast_event = original_broadcast

    @pytest.mark.asyncio
    async def test_none_tool_name_no_diagram_events(self):
        """None tool_name does not emit diagram events."""
        import server
        connected_clients.clear()

        captured = []
        original_broadcast = server.broadcast_event

        async def capture(event_data):
            captured.append(event_data)

        server.broadcast_event = capture

        try:
            await check_and_emit_diagram_events(
                session_id="p42-check-none",
                source_app="test-app",
                agent_name="test-agent",
                tool_name=None,
                tool_input={}
            )

            diagram_events = [e for e in captured if e.get("event_type") in ("unmapped_edit", "diagram_drift", "node_highlight")]
            assert len(diagram_events) == 0
        finally:
            server.broadcast_event = original_broadcast


# =============================================================================
# INTERNAL: emit_diagram_event function
# Trust: INTERNAL (called from check_and_emit_diagram_events)
# =============================================================================

class TestEmitDiagramEvent:
    """Direct unit tests for emit_diagram_event function.

    matrix: emit_diagram_event | diagram event type + params | P4.2
    Input class: Valid / typical
    """

    @pytest.mark.asyncio
    async def test_emit_node_highlight_structure(self):
        """emit_diagram_event with node_highlight produces correct event structure."""
        import server
        connected_clients.clear()

        captured = []
        original_broadcast = server.broadcast_event

        async def capture(event_data):
            captured.append(event_data)

        server.broadcast_event = capture

        try:
            await emit_diagram_event(
                session_id="p42-emit-hl",
                source_app="test-app",
                agent_name="emit-agent",
                event_type="node_highlight",
                tool_name="Write",
                tool_input={"file_path": "apps/server/x.py", "diagram": "docs/diagrams/system-overview.md", "node": "server"},
                tool_output={}
            )

            # Wait for async broadcast task to complete
            await asyncio.sleep(0.05)

            assert len(captured) == 1
            event = captured[0]
            assert event["type"] == "event"
            assert event["event_type"] == "node_highlight"
            assert event["session_id"] == "p42-emit-hl"
            assert event["source_app"] == "test-app"
            assert event["agent_name"] == "emit-agent"
            assert event["tool_name"] == "Write"
            assert event["tool_input"]["file_path"] == "apps/server/x.py"
            assert event["tool_input"]["diagram"] == "docs/diagrams/system-overview.md"
            assert event["tool_input"]["node"] == "server"
            assert "timestamp" in event
            assert isinstance(event["timestamp"], (int, float))
        finally:
            server.broadcast_event = original_broadcast


# =============================================================================
# INTERNAL: diagram_map.resolve_file_path
# Trust: INTERNAL (pure function)
# =============================================================================

class TestResolveFilePath:
    """Tests for diagram_map.resolve_file_path pure function.

    matrix: resolve_file_path | file path string | P3.2/P4.2
    Input class: Valid / typical, Boundary, Empty/missing
    Note: These are already tested in test_diagram_map.py but we include
    key contract assertions for P4.2 here as well.
    """

    def test_server_path_maps_to_server_node(self):
        """apps/server/** maps to system-overview.md::server."""
        results = resolve_file_path("apps/server/server.py", REPO_ROOT)
        assert len(results) == 1
        assert results[0].diagram == "docs/diagrams/system-overview.md"
        assert results[0].node == "server"

    def test_client_path_maps_to_client_node(self):
        """apps/client/** maps to system-overview.md::client."""
        results = resolve_file_path("apps/client/src/App.tsx", REPO_ROOT)
        assert len(results) == 1
        assert results[0].diagram == "docs/diagrams/system-overview.md"
        assert results[0].node == "client"

    def test_hooks_path_maps_to_hooks_node(self):
        """.claude/hooks/** maps to system-overview.md::hooks."""
        results = resolve_file_path(".claude/hooks/send_event.py", REPO_ROOT)
        assert len(results) == 1
        assert results[0].diagram == "docs/diagrams/system-overview.md"
        assert results[0].node == "hooks"

    def test_diagrams_path_maps_to_database_node(self):
        """docs/diagrams/** maps to system-overview.md::database."""
        results = resolve_file_path("docs/diagrams/system-overview.md", REPO_ROOT)
        assert len(results) == 1
        assert results[0].diagram == "docs/diagrams/system-overview.md"
        assert results[0].node == "database"

    def test_plans_path_maps_to_planning_node(self):
        """docs/plans/** maps to system-overview.md::planning."""
        results = resolve_file_path("docs/plans/my-plan/plan.md", REPO_ROOT)
        assert len(results) == 1
        assert results[0].diagram == "docs/diagrams/system-overview.md"
        assert results[0].node == "planning"

    def test_unmapped_path_returns_empty(self):
        """Unmapped paths return empty list."""
        results = resolve_file_path("random/unmapped/file.py", REPO_ROOT)
        assert results == []

    def test_nested_server_path_maps_to_server_node(self):
        """Deeply nested server path still maps to server node."""
        results = resolve_file_path("apps/server/deep/nested/module.py", REPO_ROOT)
        assert len(results) == 1
        assert results[0].node == "server"

    def test_absolute_path_normalized_by_server(self):
        """Absolute path under repo root is normalized by server.normalize_file_path then mapped."""
        abs_path = str(REPO_ROOT / "apps" / "server" / "test.py")
        # resolve_file_path expects relative paths; server.py normalizes first
        normalized = normalize_file_path(abs_path)
        assert normalized == "apps/server/test.py"
        results = resolve_file_path(normalized, REPO_ROOT)
        assert len(results) == 1
        assert results[0].node == "server"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])