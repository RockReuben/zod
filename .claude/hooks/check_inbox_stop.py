#!/usr/bin/env python3
"""Stop hook for inbox delivery.

Reads the Stop hook payload from stdin, checks the server for waiting
messages for this agent, and if found, blocks the stop and injects
the message as additional context.

If no message or server error, fails open (exits 0 with empty JSON).
"""

import json
import os
import shlex
import sys
import urllib.request
import urllib.error
from pathlib import Path

# Load .env file if it exists
ENV_PATH = Path(__file__).parent.parent.parent / ".env"
if ENV_PATH.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(ENV_PATH)
    except ImportError:
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                value = value.strip().strip('"').strip("'")
                os.environ.setdefault(key, value)

# Configuration - these should match the server
SERVER_URL = "http://127.0.0.1:8081/messages/consume"
TOKEN = os.environ.get("ZOD_TOKEN", "zod-control-center-token")


def consume_message(target: str) -> dict | None:
    """Check server for waiting message for target agent."""
    payload = json.dumps({"target": target}).encode("utf-8")

    req = urllib.request.Request(
        SERVER_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TOKEN}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result.get("message")
    except urllib.error.HTTPError as e:
        print(f"HTTP error consuming message: {e.code} {e.reason}", file=sys.stderr)
        return None
    except urllib.error.URLError as e:
        print(f"URL error consuming message: {e.reason}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Failed to consume message: {e}", file=sys.stderr)
        return None


def main():
    """Read Stop hook payload from stdin and check for waiting messages."""
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        print("Error: Invalid JSON payload from hook", file=sys.stderr)
        # Fail open - don't block stopping
        print("{}")
        sys.exit(0)

    # Extract agent name from hook payload
    agent_name = payload.get("agent_name", "unknown")
    session_id = payload.get("session_id", "unknown")
    hook_event_name = payload.get("hook_event_name", "")

    # Only process Stop events
    if hook_event_name != "Stop":
        print("{}")
        sys.exit(0)

    # Check for waiting message
    message = consume_message(agent_name)

    if message:
        # Message found - block stop and inject as context
        text = message.get("text", "")
        output = {
            "decision": "block",
            "reason": "Inbox message waiting",
            "hookSpecificOutput": {
                "hookEventName": "Stop",
                "additionalContext": text,
            },
        }
        print(json.dumps(output))
        sys.exit(0)
    else:
        # No message or error - fail open
        print("{}")
        sys.exit(0)


if __name__ == "__main__":
    main()