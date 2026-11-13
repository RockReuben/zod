#!/usr/bin/env python3
"""Hook forwarder script for Claude Code.

Reads the hook payload from stdin, adds the source app identifier,
and POSTs it to the event server.

No LLM calls. Pure event forwarding.
"""

import json
import sys
import urllib.request
import urllib.error

# Configuration - these should match the server
SERVER_URL = "http://127.0.0.1:8081/events"
TOKEN = "zod-control-center-token"


def forward_event(payload: dict):
    """Forward a hook event to the server."""
    # Add source app and agent info
    payload["source_app"] = payload.get("source_app", "claude-code")
    payload["agent_type"] = payload.get("agent_type", "unknown")

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
            return result
    except urllib.error.HTTPError as e:
        print(f"Error forwarding event: {e.code} {e.reason}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Failed to forward event: {e}", file=sys.stderr)
        return None


def main():
    """Read hook payload from stdin and forward it."""
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        print("Error: Invalid JSON payload from hook", file=sys.stderr)
        sys.exit(1)

    result = forward_event(payload)
    if result is None:
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
