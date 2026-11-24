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
import re
import sqlite3
import sys
import time
import uuid
from pathlib import Path
from aiohttp import web
import aiohttp_cors

from diagram_map import (
    resolve_file_path,
    check_diagram_drift,
    get_file_path_from_tool_input,
    REPO_ROOT,
    normalize_file_path,
    match_directory_to_mappings,
)

from code_graph import (
    get_code_graph,
    initialize_code_graph,
    shutdown_code_graph,
    GraphDelta,
)

# Load .env file if it exists
ENV_PATH = Path(__file__).parent.parent.parent / ".env"
if ENV_PATH.exists():
    try:
        from dotenv import load_dotenv

        load_dotenv(ENV_PATH)
    except ImportError:
        # Fallback: simple parser for KEY=VALUE lines
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                # Strip quotes if present
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)

# Configuration
HOST = "127.0.0.1"
PORT = 8081
TOKEN = os.environ.get("ZOD_TOKEN", "zod-control-center-token")
# Track file reads (Read tool) for diagram highlights - disabled by default
TRACK_FILE_READS = os.environ.get("ZOD_TRACK_READS", "false").lower() == "true"
# Track file searches (Grep, Glob tools) for diagram highlights - disabled by default
TRACK_FILE_SEARCHES = os.environ.get("ZOD_TRACK_SEARCHES", "false").lower() == "true"

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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            target TEXT NOT NULL,
            text TEXT NOT NULL,
            session_id TEXT,
            created_at REAL DEFAULT (CAST(strftime('%s', 'now') AS REAL)),
            delivered INTEGER DEFAULT 0,
            delivered_at REAL
        )
        """
    )
    # Migration for existing databases: add delivered and delivered_at columns if missing
    try:
        conn.execute("ALTER TABLE messages ADD COLUMN delivered INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # Column already exists
    try:
        conn.execute("ALTER TABLE messages ADD COLUMN delivered_at REAL")
    except sqlite3.OperationalError:
        pass  # Column already exists

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uuid TEXT NOT NULL,
            session_id TEXT NOT NULL,
            agent_name TEXT NOT NULL,
            question_text TEXT NOT NULL,
            answer_text TEXT,
            status TEXT DEFAULT 'pending',
            created_at REAL DEFAULT (CAST(strftime('%s', 'now') AS REAL)),
            answered_at REAL
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


def check_auth(request):
    """Check bearer token authentication."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer ") or auth_header.split(" ")[1] != TOKEN:
        return False
    return True


async def handle_events(request):
    """POST /events endpoint - receive hook events."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    # Extract fields from payload
    session_id = payload.get("session_id", str(uuid.uuid4()))
    source_app = payload.get("source_app", "unknown")
    # Map hook fields: hook sends agent_id/agent_type, we use agent_name
    agent_name = payload.get("agent_name") or payload.get("agent_id") or payload.get("agent_type", "unknown")
    # Map hook field: hook sends hook_event_name, we use event_type
    event_type = payload.get("type") or payload.get("hook_event_name", "unknown")
    tool_name = payload.get("tool_name")
    tool_input = payload.get("tool_input", {})
    tool_output = payload.get("tool_output", {})

    # Store in database
    conn = sqlite3.connect(str(DATABASE_PATH))
    try:
        event_uuid = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO events (uuid, session_id, source_app, agent_name, event_type, tool_name, tool_input, tool_output, timestamp, transcript_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                event_uuid,
                session_id,
                source_app,
                agent_name,
                event_type,
                tool_name,
                json.dumps(tool_input),
                json.dumps(tool_output),
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
        "uuid": event_uuid,
        "session_id": session_id,
        "source_app": source_app,
        "agent_name": agent_name,
        "event_type": event_type,
        "tool_name": tool_name,
        "tool_input": tool_input,
        "tool_output": tool_output,
        "timestamp": payload.get("timestamp"),
        "transcript_path": payload.get("transcript_path"),
    }
    asyncio.create_task(broadcast_event(event_data))

    # Check for file edit events and emit diagram-related events
    await check_and_emit_diagram_events(
        session_id, source_app, agent_name, tool_name, tool_input
    )

    return web.json_response(
        {"status": "stored", "event_id": last_id, "session_id": session_id},
        status=200,
    )


async def check_and_emit_diagram_events(
    session_id: str,
    source_app: str,
    agent_name: str,
    tool_name: str | None,
    tool_input: dict,
):
    """Check if a tool event should trigger unmapped_edit or diagram_drift events."""
    if not tool_name:
        return

    # File modification tools that we track
    file_edit_tools = {"Write", "Edit", "MultiEdit"}
    # Also track reads if enabled
    file_read_tools = {"Read"} if TRACK_FILE_READS else set()
    # Track file search tools (Grep, Glob) if enabled
    file_search_tools = {"Grep", "Glob"} if TRACK_FILE_SEARCHES else set()
    tracked_tools = file_edit_tools | file_read_tools | file_search_tools
    if tool_name not in tracked_tools:
        return

    # Extract file path from tool input
    file_path = get_file_path_from_tool_input(tool_name, tool_input)
    if not file_path:
        return

    # Normalize path (hook payloads may have absolute paths)
    # We need relative path from repo root
    file_path = normalize_file_path(file_path, REPO_ROOT)
    if not file_path:
        return

    # Determine event type based on tool
    is_read = tool_name == "Read"
    is_search = tool_name in ("Grep", "Glob")
    if is_search:
        highlight_event_type = "node_highlight_search"
    elif is_read:
        highlight_event_type = "node_highlight_read"
    else:
        highlight_event_type = "node_highlight"

    if is_search:
        # For search tools, use directory matching
        # Load mappings and match the directory
        map_path = REPO_ROOT / "diagram-map.yaml"
        from diagram_map import load_mappings
        mappings = load_mappings(map_path)
        results = match_directory_to_mappings(file_path, mappings)
    else:
        # For read/write tools, use file path matching
        results = resolve_file_path(file_path, REPO_ROOT)

    if not results:
        # No mapping found - emit unmapped_edit event (only for writes)
        if not is_read and not is_search:
            await emit_diagram_event(
                session_id=session_id,
                source_app=source_app,
                agent_name=agent_name,
                event_type="unmapped_edit",
                tool_name=tool_name,
                tool_input={"file_path": file_path},
                tool_output={},
            )
    else:
        # File/directory is mapped - check for diagram drift (only for writes)
        if not is_read and not is_search:
            drift_warnings = check_diagram_drift(file_path, REPO_ROOT)
            for drift in drift_warnings:
                await emit_diagram_event(
                    session_id=session_id,
                    source_app=source_app,
                    agent_name=agent_name,
                    event_type="diagram_drift",
                    tool_name=tool_name,
                    tool_input={
                        "file_path": file_path,
                        "diagram": drift["diagram"],
                        "node": drift["node"],
                        "reason": drift["reason"],
                    },
                    tool_output={},
                )

        # Emit node_highlight event for the mapped node
        # Use the first (most specific) match
        best_match = results[0]
        await emit_diagram_event(
            session_id=session_id,
            source_app=source_app,
            agent_name=agent_name,
            event_type=highlight_event_type,
            tool_name=tool_name,
            tool_input={
                "file_path": file_path,
                "diagram": best_match.diagram,
                "node": best_match.node,
            },
            tool_output={},
        )


async def emit_diagram_event(
    session_id: str,
    source_app: str,
    agent_name: str,
    event_type: str,
    tool_name: str | None,
    tool_input: dict,
    tool_output: dict,
):
    """Emit a diagram-related event (unmapped_edit or diagram_drift)."""
    import time

    conn = sqlite3.connect(str(DATABASE_PATH))
    try:
        event_uuid = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO events (uuid, session_id, source_app, agent_name, event_type, tool_name, tool_input, tool_output, timestamp, transcript_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                event_uuid,
                session_id,
                source_app,
                agent_name,
                event_type,
                tool_name,
                json.dumps(tool_input),
                json.dumps(tool_output),
                time.time(),
                None,
            ),
        )
        conn.commit()
        event_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    except Exception as e:
        conn.close()
        # Log error but don't fail the main request
        print(f"Error emitting diagram event: {e}", file=sys.stderr)
        return
    conn.close()

    # Broadcast to WebSocket clients
    event_data = {
        "type": "event",
        "event_id": event_id,
        "uuid": event_uuid,
        "session_id": session_id,
        "source_app": source_app,
        "agent_name": agent_name,
        "event_type": event_type,
        "tool_name": tool_name,
        "tool_input": tool_input,
        "tool_output": tool_output,
        "timestamp": time.time(),
        "transcript_path": None,
    }
    asyncio.create_task(broadcast_event(event_data))


async def handle_get_events(request):
    """GET /events endpoint - retrieve historical events for a session."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    session_id = request.query.get("session_id")
    if not session_id:
        return web.json_response(
            {"error": "session_id query parameter required"}, status=400
        )

    try:
        limit = int(request.query.get("limit", "1000"))
        offset = int(request.query.get("offset", "0"))
    except ValueError:
        return web.json_response({"error": "Invalid limit or offset"}, status=400)

    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row

    # Get total count
    total_row = conn.execute(
        "SELECT COUNT(*) as count FROM events WHERE session_id = ?",
        (session_id,),
    ).fetchone()
    total = total_row["count"] if total_row else 0

    # Get events ordered by timestamp ASC
    rows = conn.execute(
        """
        SELECT id, uuid, session_id, source_app, agent_name, event_type, tool_name,
               tool_input, tool_output, timestamp, transcript_path, created_at
        FROM events
        WHERE session_id = ?
        ORDER BY COALESCE(timestamp, created_at, id) ASC
        LIMIT ? OFFSET ?
        """,
        (session_id, limit, offset),
    ).fetchall()
    conn.close()

    events = []
    for row in rows:
        events.append(
            {
                "event_id": row["id"],
                "uuid": row["uuid"],
                "session_id": row["session_id"],
                "source_app": row["source_app"],
                "agent_name": row["agent_name"],
                "event_type": row["event_type"],
                "tool_name": row["tool_name"],
                "tool_input": json.loads(row["tool_input"]) if row["tool_input"] else {},
                "tool_output": json.loads(row["tool_output"])
                if row["tool_output"]
                else {},
                "timestamp": row["timestamp"],
                "transcript_path": row["transcript_path"],
                "created_at": row["created_at"],
            }
        )

    return web.json_response({"events": events, "total": total}, status=200)


async def handle_get_sessions(request):
    """GET /sessions endpoint - list all distinct sessions with metadata."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row

    rows = conn.execute(
        """
        SELECT
            session_id,
            MAX(agent_name) as agent_name,
            MAX(source_app) as source_app,
            COUNT(*) as event_count,
            MIN(COALESCE(timestamp, created_at)) as start_time,
            MAX(COALESCE(timestamp, created_at)) as end_time
        FROM events
        GROUP BY session_id
        ORDER BY start_time DESC
        """
    ).fetchall()
    conn.close()

    sessions = []
    for row in rows:
        sessions.append(
            {
                "session_id": row["session_id"],
                "agent_name": row["agent_name"] or "unknown",
                "source_app": row["source_app"] or "unknown",
                "event_count": row["event_count"],
                "start_time": row["start_time"],
                "end_time": row["end_time"],
            }
        )

    return web.json_response({"sessions": sessions}, status=200)


# Regex to match @name mentions in message text
# Allows alphanumeric, underscore, hyphen, and dot (common in agent/package names)
MENTION_PATTERN = re.compile(r'@([\w\-\.]+)')


async def handle_messages(request):
    """POST /messages endpoint - send messages to agents.

    Routing rules:
    - If target is empty/missing, default to "lead"
    - If text contains @name, route to that name (first match wins)
    - @name in text overrides explicit target field
    """
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    target = (payload.get("target") or "").strip()
    text = payload.get("text", "")

    # Parse @name mentions from text
    mentions = MENTION_PATTERN.findall(text)
    if mentions:
        # First @name mention wins, overrides explicit target
        target = mentions[0]

    # Default to "lead" if no target after mention parsing
    if not target:
        target = "lead"

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


async def handle_consume_message(request):
    """POST /messages/consume endpoint - consume oldest undelivered message for a target."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    target = payload.get("target", "")
    if not target:
        return web.json_response({"error": "target field required"}, status=400)

    now = time.time()

    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row

    # Atomic consume: UPDATE the oldest undelivered message and RETURNING the row
    # This avoids race conditions between SELECT and UPDATE
    row = conn.execute(
        """
        UPDATE messages
        SET delivered = 1, delivered_at = ?
        WHERE id = (
            SELECT id
            FROM messages
            WHERE delivered = 0 AND (target = ? OR target = 'lead')
            ORDER BY created_at ASC, id ASC
            LIMIT 1
        )
        RETURNING id, uuid, target, text, session_id, created_at
        """,
        (now, target),
    ).fetchone()

    conn.commit()
    conn.close()

    if row:
        message = {
            "id": row["id"],
            "uuid": row["uuid"],
            "target": row["target"],
            "text": row["text"],
            "session_id": row["session_id"],
            "created_at": row["created_at"],
        }
        return web.json_response({"message": message}, status=200)
    else:
        return web.json_response({"message": None}, status=200)


async def handle_post_question(request):
    """POST /questions endpoint - agent posts a question."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    session_id = payload.get("session_id", "")
    agent_name = payload.get("agent_name", "")
    question_text = payload.get("question", "")

    if not session_id or not agent_name or not question_text:
        return web.json_response(
            {"error": "session_id, agent_name, and question are required"},
            status=400,
        )

    conn = sqlite3.connect(str(DATABASE_PATH))
    q_uuid = str(uuid.uuid4())
    conn.execute(
        """
        INSERT INTO questions (uuid, session_id, agent_name, question_text)
        VALUES (?, ?, ?, ?)
        """,
        (q_uuid, session_id, agent_name, question_text),
    )
    conn.commit()
    q_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
    conn.close()

    # Broadcast to WebSocket clients
    event_data = {
        "type": "question",
        "question_id": q_id,
        "uuid": q_uuid,
        "session_id": session_id,
        "agent_name": agent_name,
        "question_text": question_text,
        "status": "pending",
        "created_at": time.time(),
    }
    asyncio.create_task(broadcast_event(event_data))

    return web.json_response(
        {"question_id": q_id, "uuid": q_uuid}, status=200
    )


async def handle_get_question_answer(request):
    """GET /questions/:id/answer endpoint - agent retrieves answer."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    q_id = request.match_info.get("id", "")
    if not q_id:
        return web.json_response({"error": "question id required"}, status=400)

    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT answer_text, status, answered_at FROM questions WHERE id = ?",
        (q_id,),
    ).fetchone()
    conn.close()

    if not row:
        return web.json_response({"error": "Question not found"}, status=404)

    return web.json_response(
        {
            "answer": row["answer_text"],
            "status": row["status"],
            "answered_at": row["answered_at"],
        },
        status=200,
    )


async def handle_post_question_answer(request):
    """POST /questions/:id/answer endpoint - UI/user posts answer."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    q_id = request.match_info.get("id", "")
    if not q_id:
        return web.json_response({"error": "question id required"}, status=400)

    try:
        payload = await request.json()
    except json.JSONDecodeError:
        return web.json_response({"error": "Invalid JSON"}, status=400)

    answer_text = payload.get("answer", "")
    if not answer_text:
        return web.json_response({"error": "answer is required"}, status=400)

    import time
    now = time.time()

    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT id FROM questions WHERE id = ?", (q_id,)
    ).fetchone()

    if not row:
        conn.close()
        return web.json_response({"error": "Question not found"}, status=404)

    conn.execute(
        """
        UPDATE questions SET answer_text = ?, status = 'answered', answered_at = ? WHERE id = ?
        """,
        (answer_text, now, q_id),
    )
    conn.commit()
    conn.close()

    # Broadcast answer to WebSocket clients
    event_data = {
        "type": "question_answer",
        "question_id": q_id,
        "answer_text": answer_text,
        "answered_at": now,
    }
    asyncio.create_task(broadcast_event(event_data))

    return web.json_response({"status": "answered", "question_id": int(q_id)}, status=200)


async def handle_get_questions(request):
    """GET /questions endpoint - list questions (for UI polling)."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    status_filter = request.query.get("status", "pending")

    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row

    if status_filter == "all":
        rows = conn.execute(
            """
            SELECT id, uuid, session_id, agent_name, question_text, answer_text, status, created_at, answered_at
            FROM questions
            ORDER BY created_at DESC
            """
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id, uuid, session_id, agent_name, question_text, answer_text, status, created_at, answered_at
            FROM questions
            WHERE status = ?
            ORDER BY created_at DESC
            """,
            (status_filter,),
        ).fetchall()
    conn.close()

    questions = []
    for row in rows:
        questions.append(
            {
                "id": row["id"],
                "uuid": row["uuid"],
                "session_id": row["session_id"],
                "agent_name": row["agent_name"],
                "question_text": row["question_text"],
                "answer_text": row["answer_text"],
                "status": row["status"],
                "created_at": row["created_at"],
                "answered_at": row["answered_at"],
            }
        )

    return web.json_response({"questions": questions}, status=200)


async def handle_get_diagrams(request):
    """GET /diagrams/:name endpoint - return diagram file."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    name = request.match_info.get("name", "system-overview")

    # Validate name to prevent path traversal
    if ".." in name or "/" in name or "\\" in name:
        return web.json_response({"error": "Invalid diagram name"}, status=400)

    diagram_path = REPO_ROOT / "docs" / "diagrams" / f"{name}.md"

    # Additional safety: ensure resolved path is under docs/diagrams
    try:
        diagram_path.resolve().relative_to((REPO_ROOT / "docs" / "diagrams").resolve())
    except ValueError:
        return web.json_response({"error": "Invalid diagram name"}, status=400)

    if not diagram_path.exists():
        return web.json_response({"error": "Diagram not found"}, status=404)

    try:
        content = diagram_path.read_text(encoding="utf-8")
        return web.Response(text=content, content_type="text/markdown")
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


async def handle_get_code_graph(request):
    """GET /code-graph endpoint - return full code graph snapshot."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    graph = get_code_graph()
    return web.json_response(graph.to_dict())


async def handle_get_code_graph_fingerprint(request):
    """GET /code-graph/fingerprint endpoint - return just the fingerprint."""
    if not check_auth(request):
        return web.json_response({"error": "Unauthorized"}, status=401)

    graph = get_code_graph()
    return web.json_response({"fingerprint": graph.fingerprint})


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


# Code Graph WebSocket clients
code_graph_clients: set = set()


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


async def code_graph_websocket_handler(request):
    """WebSocket handler for code graph real-time updates.

    Auth via query parameter ?token=... since browsers don't support custom headers on WebSocket.
    """
    # Check token from query parameter (for WebSocket) or Authorization header (for HTTP)
    token = request.query.get("token")
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]

    if not token or token != TOKEN:
        return web.json_response({"error": "Unauthorized"}, status=401)

    ws = web.WebSocketResponse()
    await ws.prepare(request)
    code_graph_clients.add(ws)

    graph = get_code_graph()

    # Send initial snapshot
    snapshot = graph.to_dict()
    try:
        await ws.send_str(json.dumps({"type": "graph_snapshot", **snapshot}))
    except Exception:
        pass

    # Register delta callback for this client
    async def on_delta(delta: GraphDelta):
        try:
            await ws.send_str(json.dumps({"type": "graph_delta", **delta.to_dict()}))
        except Exception:
            pass

    graph.on_delta(on_delta)

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                if msg.data == "close":
                    break
                # Handle client messages (e.g., fingerprint check)
                try:
                    data = json.loads(msg.data)
                    if data.get("type") == "fingerprint_check":
                        client_fp = data.get("fingerprint")
                        server_fp = graph.fingerprint
                        if client_fp != server_fp:
                            await ws.send_str(json.dumps({
                                "type": "graph_fingerprint",
                                "fingerprint": server_fp,
                            }))
                except json.JSONDecodeError:
                    pass
            elif msg.type == web.WSMsgType.ERROR:
                break
    except Exception:
        pass
    finally:
        code_graph_clients.discard(ws)
        # Remove delta callback to prevent memory leak
        try:
            graph._delta_callbacks.remove(on_delta)
        except ValueError:
            pass
        await ws.close()

    return ws


async def main():
    """Start the event server."""
    # Initialize code graph (scan + watcher)
    await initialize_code_graph()

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()

    print(f"🛰️  Zod Control Center server running at http://{HOST}:{PORT}")
    print(f"📡 WebSocket endpoint: ws://{HOST}:{PORT}/ws")
    print(f"📊 Code Graph WS: ws://{HOST}:{PORT}/ws/code-graph")
    print(f"🔐 Token: {TOKEN[:8]}... (truncated)")
    print(f"🗄️  Database: {DATABASE_PATH}")

    # Keep running
    try:
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        pass
    finally:
        await shutdown_code_graph()
        await runner.cleanup()


def create_app():
    """Create a fresh aiohttp application for testing."""
    app = web.Application()
    app.router.add_post("/events", handle_events)
    app.router.add_get("/events", handle_get_events)
    app.router.add_get("/sessions", handle_get_sessions)
    app.router.add_post("/messages", handle_messages)
    app.router.add_get("/messages/{target}", handle_get_messages)
    app.router.add_post("/messages/consume", handle_consume_message)
    app.router.add_post("/questions", handle_post_question)
    app.router.add_get("/questions", handle_get_questions)
    app.router.add_get("/questions/{id}/answer", handle_get_question_answer)
    app.router.add_post("/questions/{id}/answer", handle_post_question_answer)
    app.router.add_get("/diagrams/{name}", handle_get_diagrams)
    app.router.add_get("/ws", websocket_handler)
    # Code Graph endpoints
    app.router.add_get("/code-graph", handle_get_code_graph)
    app.router.add_get("/code-graph/fingerprint", handle_get_code_graph_fingerprint)
    app.router.add_get("/ws/code-graph", code_graph_websocket_handler)

    # Configure CORS for the client at localhost:5173
    cors = aiohttp_cors.setup(
        app,
        defaults={
            "http://127.0.0.1:5173": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*",
            ),
            "http://localhost:5173": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*",
            ),
        },
    )
    # Apply CORS to all routes
    for route in list(app.router.routes()):
        cors.add(route)

    return app


# Create the aiohttp application at module level for testing
# (after all handlers are defined)
app = create_app()
if __name__ == "__main__":
    asyncio.run(main())
