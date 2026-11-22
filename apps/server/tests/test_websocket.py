"""WebSocket tests for the Zod Control Center event server."""

import pytest
import json
import asyncio
from pathlib import Path
from aiohttp.test_utils import TestClient, TestServer
from aiohttp import web, WSMsgType

# Import the server module
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from server import create_app, connected_clients, broadcast_event, TOKEN


class TestWebSocket:
    """Tests for WebSocket endpoint."""

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

    @pytest.mark.asyncio
    async def test_websocket_connect_disconnect(self, client):
        """WebSocket connects and disconnects cleanly."""
        ws = await client.ws_connect("/ws")
        assert not ws.closed
        await ws.close()
        assert ws.closed

    @pytest.mark.asyncio
    async def test_websocket_broadcast_reaches_connected_clients(self, client):
        """Broadcast event reaches all connected WebSocket clients."""
        ws1 = await client.ws_connect("/ws")
        ws2 = await client.ws_connect("/ws")

        # Wait for connections to be registered
        await asyncio.sleep(0.01)

        # Broadcast an event
        event_data = {
            "type": "event",
            "event_id": 1,
            "session_id": "test-session",
            "source_app": "test-app",
            "agent_name": "test-agent",
            "event_type": "PreToolUse",
        }
        await broadcast_event(event_data)

        # Both clients should receive the message
        msg1 = await ws1.receive()
        msg2 = await ws2.receive()

        assert msg1.type == WSMsgType.TEXT
        assert msg2.type == WSMsgType.TEXT

        data1 = json.loads(msg1.data)
        data2 = json.loads(msg2.data)

        assert data1["event_id"] == 1
        assert data2["event_id"] == 1

        await ws1.close()
        await ws2.close()

    @pytest.mark.asyncio
    async def test_websocket_broadcast_no_clients(self):
        """Broadcast with no connected clients does nothing (no crash)."""
        event_data = {
            "type": "event",
            "event_id": 1,
            "session_id": "test-session",
            "source_app": "test-app",
            "agent_name": "test-agent",
            "event_type": "PreToolUse",
        }
        # Should not raise
        await broadcast_event(event_data)

    @pytest.mark.asyncio
    async def test_websocket_disconnected_client_removed(self, client):
        """Disconnected clients are removed from the connected set."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)
        assert len(connected_clients) == 1

        await ws.close()
        await asyncio.sleep(0.01)
        assert len(connected_clients) == 0

    @pytest.mark.asyncio
    async def test_websocket_echo_message(self, client):
        """WebSocket echoes text messages back (legacy behavior)."""
        ws = await client.ws_connect("/ws")
        await ws.send_str("hello")
        msg = await ws.receive()
        assert msg.type == WSMsgType.TEXT
        assert msg.data == "Echo: hello"
        await ws.close()

    @pytest.mark.asyncio
    async def test_websocket_close_message(self, client):
        """Sending 'close' message closes the WebSocket."""
        ws = await client.ws_connect("/ws")
        await ws.send_str("close")
        msg = await ws.receive()
        assert msg.type == WSMsgType.CLOSE
        assert ws.closed

    @pytest.mark.asyncio
    async def test_multiple_clients_broadcast(self, client):
        """Multiple clients all receive broadcasts."""
        clients = []
        for _ in range(5):
            ws = await client.ws_connect("/ws")
            clients.append(ws)

        await asyncio.sleep(0.01)

        event_data = {
            "type": "event",
            "event_id": 42,
            "session_id": "multi-test",
            "source_app": "multi-app",
            "agent_name": "multi-agent",
            "event_type": "PostToolUse",
        }
        await broadcast_event(event_data)

        # All clients should receive
        for ws in clients:
            msg = await ws.receive()
            assert msg.type == WSMsgType.TEXT
            data = json.loads(msg.data)
            assert data["event_id"] == 42

        for ws in clients:
            await ws.close()

    @pytest.mark.asyncio
    async def test_broadcast_handles_client_error_gracefully(self, client):
        """Broadcast handles client send errors without crashing."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        # Force close the client's underlying transport to simulate error
        await ws.close()
        await asyncio.sleep(0.01)

        # Broadcast should not raise even with a dead client in the set
        event_data = {
            "type": "event",
            "event_id": 99,
            "session_id": "err-test",
            "source_app": "err-app",
            "agent_name": "err-agent",
            "event_type": "Test",
        }
        await broadcast_event(event_data)
        # If we get here without exception, the test passes

    @pytest.mark.asyncio
    async def test_websocket_concurrent_connect_disconnect(self, client):
        """Rapid connect/disconnect cycles don't leak clients."""
        for _ in range(10):
            ws = await client.ws_connect("/ws")
            await ws.close()
            await asyncio.sleep(0.001)

        await asyncio.sleep(0.01)
        assert len(connected_clients) == 0


class TestWebSocketIntegration:
    """Integration tests: POST /events -> WebSocket broadcast."""

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

    @pytest.mark.asyncio
    async def test_post_event_broadcasts_to_websocket(self, client):
        """POST /events broadcasts the event to WebSocket clients."""
        # Connect WebSocket first
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        # Post an event
        response = await client.post(
            "/events",
            headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
            json={
                "session_id": "ws-test-session",
                "source_app": "ws-test-app",
                "agent_name": "ws-test-agent",
                "type": "PreToolUse",
                "tool_name": "Read",
                "tool_input": {"file_path": "/test/file.ts"},
            }
        )
        assert response.status == 200

        # Receive broadcast
        msg = await ws.receive()
        assert msg.type == WSMsgType.TEXT
        data = json.loads(msg.data)
        assert data["type"] == "event"
        assert data["session_id"] == "ws-test-session"
        assert data["source_app"] == "ws-test-app"
        assert data["agent_name"] == "ws-test-agent"
        assert data["event_type"] == "PreToolUse"
        assert data["tool_name"] == "Read"

        await ws.close()

    @pytest.mark.asyncio
    async def test_post_event_unauthorized_does_not_broadcast(self, client):
        """Unauthorized POST does not broadcast to WebSocket."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)

        # Post without auth
        response = await client.post(
            "/events",
            headers={"Authorization": "Bearer wrong", "Content-Type": "application/json"},
            json={"session_id": "unauth-test", "type": "Test"}
        )
        assert response.status == 401

        # Should not receive any broadcast (wait with timeout)
        try:
            msg = await asyncio.wait_for(ws.receive(), timeout=0.5)
            # If we get a message, it shouldn't be our event
            if msg.type == WSMsgType.TEXT:
                data = json.loads(msg.data)
                assert data.get("session_id") != "unauth-test"
        except asyncio.TimeoutError:
            # Timeout is expected - no broadcast received
            pass

        await ws.close()


# Mutation tests for WebSocket
class TestWebSocketMutationChecks:
    """Tests designed to catch WebSocket regressions."""

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
    async def test_broadcast_skips_closed_connections(self, client):
        """Closed connections should be removed during broadcast."""
        ws = await client.ws_connect("/ws")
        await asyncio.sleep(0.01)
        await ws.close()
        await asyncio.sleep(0.01)

        # This should not raise and should clean up the dead connection
        event_data = {"type": "event", "event_id": 1}
        await broadcast_event(event_data)

        assert len(connected_clients) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])