#!/usr/bin/env python3
"""Send mock events to test diagram highlighting."""
import asyncio
import json
import aiohttp
import os

# Get token from .env
with open('.env') as f:
    for line in f:
        if line.startswith('ZOD_TOKEN='):
            TOKEN = line.strip().split('=', 1)[1]
            break

BASE_URL = "http://127.0.0.1:8081"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

async def send_event(session, event):
    """Send a single event to the server."""
    async with session.post(f"{BASE_URL}/events", headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}, json=event) as resp:
        result = await resp.json()
        print(f"  → {event['tool_name']} on {event['tool_input'].get('file_path', 'N/A')}: {result}")

async def main():
    print("🚀 Sending mock events to test diagram highlighting...")
    print("=" * 60)

    async with aiohttp.ClientSession() as session:
        # Test 1: Write to apps/server (should highlight 'server' node BLUE)
        print("\n📝 Test 1: Write to apps/server/**")
        await send_event(session, {
            "session_id": "mock-test-1",
            "source_app": "test-app",
            "agent_name": "backend-agent",
            "type": "PostToolUse",
            "tool_name": "Write",
            "tool_input": {"file_path": "apps/server/new_feature.py", "content": "print('hello')"},
            "tool_output": {"success": True}
        })
        await asyncio.sleep(0.5)

        # Test 2: Write to apps/client (should highlight 'client' node BLUE)
        print("\n📝 Test 2: Write to apps/client/**")
        await send_event(session, {
            "session_id": "mock-test-2",
            "source_app": "test-app",
            "agent_name": "frontend-agent",
            "type": "PostToolUse",
            "tool_name": "Write",
            "tool_input": {"file_path": "apps/client/src/NewComponent.tsx", "content": "export const C = () => <div/>" },
            "tool_output": {"success": True}
        })
        await asyncio.sleep(0.5)

        # Test 3: Write to .claude/hooks (should highlight 'hooks' node ORANGE)
        print("\n📝 Test 3: Write to .claude/hooks/**")
        await send_event(session, {
            "session_id": "mock-test-3",
            "source_app": "test-app",
            "agent_name": "hooks-agent",
            "type": "PostToolUse",
            "tool_name": "Write",
            "tool_input": {"file_path": ".claude/hooks/custom_hook.py", "content": "print('hook')"},
            "tool_output": {"success": True}
        })
        await asyncio.sleep(0.5)

        # Test 4: Write to docs/diagrams (should highlight 'database' node PINK)
        print("\n📝 Test 4: Write to docs/diagrams/**")
        await send_event(session, {
            "session_id": "mock-test-4",
            "source_app": "test-app",
            "agent_name": "diagram-agent",
            "type": "PostToolUse",
            "tool_name": "Write",
            "tool_input": {"file_path": "docs/diagrams/new-diagram.md", "content": "graph TD\nA --> B"},
            "tool_output": {"success": True}
        })
        await asyncio.sleep(0.5)

        # Test 5: Write to docs/plans (should highlight 'planning' node GREY)
        print("\n📝 Test 5: Write to docs/plans/**")
        await send_event(session, {
            "session_id": "mock-test-5",
            "source_app": "test-app",
            "agent_name": "planning-agent",
            "type": "PostToolUse",
            "tool_name": "Write",
            "tool_input": {"file_path": "docs/plans/new-plan/plan.md", "content": "# New Plan"},
            "tool_output": {"success": True}
        })
        await asyncio.sleep(0.5)

        # Test 6: Read events (if ZOD_TRACK_READS=true, should highlight CYAN)
        print("\n📖 Test 6: Read from apps/server/** (requires ZOD_TRACK_READS=true)")
        await send_event(session, {
            "session_id": "mock-test-6",
            "source_app": "test-app",
            "agent_name": "backend-agent",
            "type": "PreToolUse",
            "tool_name": "Read",
            "tool_input": {"file_path": "apps/server/server.py"},
            "tool_output": {}
        })
        await asyncio.sleep(0.5)

        # Test 7: Unmapped path (should show warning, no highlight)
        print("\n⚠️ Test 7: Write to unmapped path (should show 'Unmapped' warning)")
        await send_event(session, {
            "session_id": "mock-test-7",
            "source_app": "test-app",
            "agent_name": "test-agent",
            "type": "PostToolUse",
            "tool_name": "Write",
            "tool_input": {"file_path": "random/unmapped/file.py", "content": "x"},
            "tool_output": {"success": True}
        })

        print("\n" + "=" * 60)
        print("✅ All mock events sent!")
        print("\n📋 Check browser for:")
        print("  • Architecture diagram visible in center pane")
        print("  • Subtle dot grid background")
        print("  • Blue highlights on server/client/hooks/database/planning nodes")
        print("  • Cyan highlights on read events (if ZOD_TRACK_READS=true)")
        print("  • Highlights fade after 10 seconds")
        print("  • 'Unmapped' warning for test 7")
        print("  • Timeline on right showing all events")

if __name__ == "__main__":
    asyncio.run(main())