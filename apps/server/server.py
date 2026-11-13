#!/usr/bin/env python3
"""Event server for the Zod Control Center.

Listens for hook events from Claude Code agents, stores them in SQLite,
and broadcasts them over WebSocket to connected UI clients.

Security:
- Binds to 127.0.0.1 only
- Requires a shared bearer token
"""

import asyncio
import json
import os
import sqlite3
import uuid
from pathlib import Path
from aiohttp import web

# Configuration
HOST = "127.0.0.1"
PORT = 8081
TOKEN = "zod-control-center-token"

# Paths relative to repo root
REPO_ROOT = Path(__file__).parent.parent.parent
DATABASE_PATH = REPO_ROOT / "var" / "events.db"
EVENTS_DIR = REPO_ROOT / "var"

# Ensure directories exist
EVENTS_DIR.mkdir(parents=True, exist_ok=True)


def init_db():
    """Initialize the SQLite database."""
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            session_id TEXT NOT NULL,
            source_app TEXT NOT NULL,
            agent_name TEXT,
            event_type TEXT NOT NULL,
            tool_name TEXT,
            tool_input TEXT,
            tool_output TEXT,
            timestamp REAL,
            transcript_path TEXT,
            created_at REAL DEFAULT (CAST(strftime('%s', 'now') AS REAL))
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


async def handle_events(request):
    """POST /events endpoint - receive hook events."""
    # Check authentication
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer ") or auth_header.split(" ")[1] != TOKEN:
        return web.json_response({"error": "Unauthorized"}, status=401)

    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    # Extract fields from payload
    session_id = payload.get("session_id", str(uuid.uuid4()))
    source_app = payload.get("source_app", "unknown")
    agent_name = payload.get("agent_name", "unknown")
    event_type = payload.get("type", "unknown")

    # Store in database
    conn = sqlite3.connect(str(DATABASE_PATH))
    try:
        conn.execute(
            """
            INSERT INTO events (uuid, session_id, source_app, agent_name, event_type, tool_name, tool_input, tool_output, timestamp, transcript_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                str(uuid.uuid4()),
                session_id,
                source_app,
                agent_name,
                event_type,
                payload.get("tool_name"),
                json.dumps(payload.get("tool_input", {})),
                json.dumps(payload.get("tool_output", {})),
                payload.get("timestamp"),
                payload.get("transcript_path"),
            ),
        )
        conn.commit()
        last_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    except Exception as e:
        conn.close()
        return web.json_response({"error": str(e)}, status=500)
    conn.close()

    # Broadcast to WebSocket clients
    event_data = {
        "type": "event",
        "event_id": last_id,
        "session_id": session_id,
        "source_app": source_app,
        "agent_name": agent_name,
        "event_type": event_type,
        "tool_name": payload.get("tool_name"),
        "tool_input": payload.get("tool_input", {}),
        "tool_output": payload.get("tool_output", {}),
        "timestamp": payload.get("timestamp"),
        "transcript_path": payload.get("transcript_path"),
    }
    asyncio.create_task(broadcast_event(event_data))

    return web.json_response(
        {"status": "stored", "event_id": last_id, "session_id": session_id},
        status=200,
    )


async def handle_messages(request):
    """POST /messages endpoint - send messages to agents."""
    # Check authentication
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer ") or auth_header.split(" ")[1] != TOKEN:
        return web.json_response({"error": "Unauthorized"}, status=401)

    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    target = payload.get("target", "")
    text = payload.get("text", "")

    # Store message in database
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.execute(
        """
        INSERT INTO messages (uuid, target, text, session_id, created_at)
        VALUES (?, ?, ?, ?, CAST(strftime('%s', 'now') AS REAL))
    """,
        (str(uuid.uuid4()), target, text, payload.get("session_id")),
    )
    conn.commit()
    conn.close()

    return web.json_response(
        {"status": "message_received", "target": target, "text_length": len(text)},
        status=200,
    )


async def handle_get_messages(request):
    """GET /messages/:target endpoint - retrieve messages for a target."""
    target = request.match_info.get("target", "")

    conn = sqlite3.connect(str(DATABASE_PATH))
    rows = conn.execute(
        """
        SELECT session_id, text, created_at FROM messages
        WHERE target = ?
        ORDER BY created_at DESC
        LIMIT 50
    """,
        (target,),
    ).fetchall()
    conn.close()

    messages = [
        {"session_id": row[0], "text": row[1], "created_at": row[2]} for row in rows
    ]
    return web.json_response({"messages": messages}, status=200)


async def handle_get_diagrams(request):
    """GET /diagrams/:name endpoint - return diagram file."""
    name = request.match_info.get("name", "system-overview")

    diagram_path = PROJECT_ROOT / "docs" / "diagrams" / f"{name}.md"

    if not diagram_path.exists():
        return web.json_response({"error": "Diagram not found"}, status=404)

    try:
        content = diagram_path.read_text(encoding="utf-8")
        return web.Response(text=content, content_type="text/markdown")
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


connected_clients: set = set()


async def broadcast_event(event_data: dict):
    """Broadcast an event to all connected WebSocket clients."""
    if not connected_clients:
        return

    message = json.dumps(event_data)
    disconnected = set()
    for ws in connected_clients:
        try:
            await ws.send_str(message)
        except Exception:
            disconnected.add(ws)

    connected_clients.difference_update(disconnected)


async def websocket_handler(request):
    """WebSocket handler for real-time event broadcasting."""
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    connected_clients.add(ws)

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                if msg.data == "close":
                    break
                await ws.send_str(f"Echo: {msg.data}")
            elif msg.type == web.WSMsgType.ERROR:
                break
    except Exception:
        pass
    finally:
        connected_clients.discard(ws)
        await ws.close()

    return ws


async def main():
    """Start the event server."""
    app = web.Application()

    # Routes
    app.router.add_post("/events", handle_events)
    app.router.add_post("/messages", handle_messages)
    app.router.add_get("/messages/{target}", handle_get_messages)
    app.router.add_get("/diagrams/{name}", handle_get_diagrams)
    app.router.add_get("/ws", websocket_handler)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()

    print(f"🛰️  Zod Control Center server running at http://{HOST}:{PORT}")
    print(f"📡 WebSocket endpoint: ws://{HOST}:{PORT}/ws")
    print(f"🔐 Token: {TOKEN}")
    print(f"🗄️  Database: {DATABASE_PATH}")

    # Keep running
    try:
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        pass
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())