#!/usr/bin/env python3
"""Test script to post sample events for timeline verification."""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# Load .env
ENV_PATH = Path(__file__).parent / ".env"
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key, value)

SERVER_URL = "http://127.0.0.1:8081/events"
TOKEN = os.environ.get("ZOD_TOKEN", "zod-control-center-token")


def post_event(payload: dict) -> bool:
    """Post a single event to the server."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        SERVER_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TOKEN}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            print(f"  ✓ {payload['session_id']} | {payload['type']} | {payload.get('tool_name', '—')}")
            return True
    except urllib.error.HTTPError as e:
        print(f"  ✗ {payload['session_id']} | HTTP {e.code}: {e.reason}")
        return False
    except Exception as e:
        print(f"  ✗ {payload['session_id']} | {e}")
        return False


def main():
    events = [
        # Session 1: pkg-auth, auth-agent
        {
            "session_id": "sess-1",
            "source_app": "pkg-auth",
            "agent_name": "auth-agent",
            "type": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "/src/auth/login.ts"},
            "timestamp": 1700000000,
        },
        {
            "session_id": "sess-1",
            "source_app": "pkg-auth",
            "agent_name": "auth-agent",
            "type": "PostToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "/src/auth/login.ts"},
            "tool_output": {"success": True},
            "timestamp": 1700000001,
        },
        {
            "session_id": "sess-1",
            "source_app": "pkg-auth",
            "agent_name": "auth-agent",
            "type": "PreToolUse",
            "tool_name": "Write",
            "tool_input": {"file_path": "/src/auth/token.ts", "content": "..."},
            "timestamp": 1700000002,
        },
        {
            "session_id": "sess-1",
            "source_app": "pkg-auth",
            "agent_name": "auth-agent",
            "type": "Stop",
            "tool_name": "Stop",
            "timestamp": 1700000003,
        },
        # Session 2: pkg-db, db-agent
        {
            "session_id": "sess-2",
            "source_app": "pkg-db",
            "agent_name": "db-agent",
            "type": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "/src/db/schema.sql"},
            "timestamp": 1700000005,
        },
        {
            "session_id": "sess-2",
            "source_app": "pkg-db",
            "agent_name": "db-agent",
            "type": "PostToolUse",
            "tool_name": "Write",
            "tool_input": {"file_path": "/src/db/migration.ts", "content": "..."},
            "timestamp": 1700000006,
        },
        {
            "session_id": "sess-2",
            "source_app": "pkg-db",
            "agent_name": "db-agent",
            "type": "SubagentStart",
            "tool_name": "Task",
            "tool_input": {"description": "Run migrations"},
            "timestamp": 1700000007,
        },
        # Session 3: pkg-api, api-agent
        {
            "session_id": "sess-3",
            "source_app": "pkg-api",
            "agent_name": "api-agent",
            "type": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "/src/api/routes.ts"},
            "timestamp": 1700000010,
        },
    ]

    print(f"Posting {len(events)} test events to {SERVER_URL}...\n")
    success = 0
    for event in events:
        if post_event(event):
            success += 1

    print(f"\nDone: {success}/{len(events)} events posted successfully")


if __name__ == "__main__":
    main()