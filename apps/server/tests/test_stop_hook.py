"""Tests for the Stop hook script (P5.3 check_inbox_stop.py)."""

import pytest
import json
import subprocess
import sys
import os
from pathlib import Path

HOOK_SCRIPT = Path(__file__).parent.parent.parent.parent / ".claude/hooks/check_inbox_stop.py"


class TestStopHookScript:
    """Tests for check_inbox_stop.py script execution."""

    def run_hook(self, payload: dict, env: dict | None = None) -> tuple[int, str, str]:
        """Run the hook script with given payload via stdin."""
        proc_env = {"ZOD_TOKEN": "test-token"}
        if env:
            proc_env.update(env)
        # Preserve current environment (especially PATH) and add our vars
        full_env = {**dict(os.environ), **proc_env}
        result = subprocess.run(
            [sys.executable, str(HOOK_SCRIPT)],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            env=full_env,
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()

    def test_invalid_json_exits_zero(self):
        """Invalid JSON on stdin exits 0 (fail open) and outputs empty JSON."""
        result = subprocess.run(
            [sys.executable, str(HOOK_SCRIPT)],
            input="not valid json",
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert result.stdout.strip() == "{}"

    def test_non_stop_event_exits_zero(self):
        """Non-Stop hook events exit 0 with empty JSON."""
        returncode, stdout, _ = self.run_hook({
            "session_id": "test-session",
            "agent_name": "test-agent",
            "hook_event_name": "PreToolUse",
        })
        assert returncode == 0
        assert stdout == "{}"

    def test_stop_event_no_server_exits_zero(self):
        """Stop event with unreachable server exits 0 (fail open)."""
        returncode, stdout, stderr = self.run_hook({
            "session_id": "test-session",
            "agent_name": "test-agent",
            "hook_event_name": "Stop",
        })
        assert returncode == 0
        assert stdout == "{}"
        # Should log error to stderr
        assert "error" in stderr.lower() or "failed" in stderr.lower()

    def test_stop_event_missing_agent_name(self):
        """Stop event with missing agent_name uses 'unknown' and fails open."""
        returncode, stdout, _ = self.run_hook({
            "session_id": "test-session",
            "hook_event_name": "Stop",
        })
        assert returncode == 0
        assert stdout == "{}"

    def test_output_format_on_message_found(self):
        """When message found, output matches Q2 contract format."""
        # This test would need a mock server - skipped for unit test
        # Integration test would verify full flow
        pass


class TestStopHookIntegration:
    """Integration tests for Stop hook with running server."""

    @pytest.fixture
    def server_url(self):
        """Base URL for test server."""
        return "http://127.0.0.1:8081"

    def test_full_flow_requires_running_server(self, server_url):
        """Full integration test requires running server - marked as manual."""
        pytest.skip("Integration test - requires running server")

    # Example of how manual test would work:
    # 1. Start server: python3 apps/server/server.py
    # 2. Post message: curl -X POST http://127.0.0.1:8081/messages -H "Authorization: Bearer test" -d '{"target":"test-agent","text":"Check the build"}'
    # 3. Run hook: echo '{"session_id":"s1","agent_name":"test-agent","hook_event_name":"Stop"}' | python3 .claude/hooks/check_inbox_stop.py
    # 4. Verify output contains: "decision": "block", "additionalContext": "Check the build"
    # 5. Run hook again: should output {} (message already delivered)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])