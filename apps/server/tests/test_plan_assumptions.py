#!/usr/bin/env python3
"""
P6.4 SPEC TESTS: Server-side plan assumptions and planner reply endpoint

Contract:
- Plan folders have plan.md with Assumptions and Open Questions sections
- Server endpoint POST /plans/:name/reply accepts replies and forwards to planner
- All spec tests marked with pytest.mark.xfail(reason="pending:P6.4")
"""

import pytest
import json
import tempfile
import os
from pathlib import Path


# =============================================================================
# ENTRY POINT 1: Plan parser - extracts assumptions and open questions from plan.md
# Trust: INTERNAL (called by endpoint)
# -----------------------------------------------------------------------------

def parse_plan_assumptions(plan_markdown: str) -> dict:
    """
    Parse plan.md and extract assumptions and open questions.
    Returns: { "assumptions": [...], "open_questions": [...] }
    Each item: { "id": str, "text": str, "line_number": int }
    """
    raise NotImplementedError("pending:P6.4")


class TestPlanParser:
    """Test the plan parser for assumptions and open questions."""

    def test_extracts_assumptions_from_section(self):
        # matrix: plan parser | valid plan.md with assumptions | P6.4
        plan_md = """# Sample Plan

## Overview
Add a new endpoint.

## Assumptions
- Users authenticate via shared token
- No OAuth integration in MVP
- Validation is fast (< 1s)

## Open Questions
- Should we support API keys?

## Details
Implementation details here."""

        result = parse_plan_assumptions(plan_md)
        assumptions = result["assumptions"]
        assert len(assumptions) == 3
        assert assumptions[0]["text"] == "Users authenticate via shared token"
        assert assumptions[1]["text"] == "No OAuth integration in MVP"
        assert assumptions[2]["text"] == "Validation is fast (< 1s)"
        assert assumptions[0]["id"] == "assumption-0"

    def test_extracts_open_questions_from_section(self):
        # matrix: plan parser | valid plan.md with open questions | P6.4
        plan_md = """# Sample Plan

## Assumptions
- Users authenticate via shared token

## Open Questions
- Should we support API keys?
- Token expiration policy?
- Rate limiting needed?

## Details
Implementation details here."""

        result = parse_plan_assumptions(plan_md)
        questions = result["open_questions"]
        assert len(questions) == 3
        assert questions[0]["text"] == "Should we support API keys?"
        assert questions[1]["text"] == "Token expiration policy?"
        assert questions[2]["text"] == "Rate limiting needed?"

    def test_handles_missing_assumptions_section(self):
        # matrix: plan parser | plan.md missing Assumptions | P6.4
        plan_md = """# Sample Plan

## Overview
Add a new endpoint.

## Open Questions
- Should we support API keys?"""

        result = parse_plan_assumptions(plan_md)
        assert len(result["assumptions"]) == 0
        assert len(result["open_questions"]) == 1

    def test_handles_missing_open_questions_section(self):
        # matrix: plan parser | plan.md missing Open Questions | P6.4
        plan_md = """# Sample Plan

## Overview
Add a new endpoint.

## Assumptions
- Users authenticate via shared token"""

        result = parse_plan_assumptions(plan_md)
        assert len(result["assumptions"]) == 1
        assert len(result["open_questions"]) == 0

    def test_handles_empty_plan(self):
        # matrix: plan parser | empty/malformed plan.md | P6.4
        result = parse_plan_assumptions("")
        assert result["assumptions"] == []
        assert result["open_questions"] == []

    def test_ignores_bullets_outside_sections(self):
        # matrix: plan parser | bullets in other sections | P6.4
        plan_md = """# Sample Plan

## Details
- This should not be extracted
- Nor this

## Assumptions
- This should be extracted

## Open Questions
- This should also be extracted"""

        result = parse_plan_assumptions(plan_md)
        assert len(result["assumptions"]) == 1
        assert len(result["open_questions"]) == 1
        assert result["assumptions"][0]["text"] == "This should be extracted"
        assert result["open_questions"][0]["text"] == "This should also be extracted"

    def test_handles_numbered_lists(self):
        # matrix: plan parser | numbered lists | P6.4
        plan_md = """# Sample Plan

## Assumptions
1. First assumption
2. Second assumption

## Open Questions
1. First question?
2. Second question?"""

        result = parse_plan_assumptions(plan_md)
        assert len(result["assumptions"]) == 2
        assert len(result["open_questions"]) == 2

    def test_assigns_unique_ids(self):
        # matrix: plan parser | ID assignment | P6.4
        plan_md = """# Sample Plan

## Assumptions
- Assumption 1
- Assumption 2

## Open Questions
- Question 1?"""

        result = parse_plan_assumptions(plan_md)
        assert result["assumptions"][0]["id"] == "assumption-0"
        assert result["assumptions"][1]["id"] == "assumption-1"
        assert result["open_questions"][0]["id"] == "question-0"


# =============================================================================
# ENTRY POINT 2: Plan file loading - loads plan.md from plan folder
# Trust: EXTERNAL (file system boundary)
# -----------------------------------------------------------------------------

def load_plan_markdown(plan_name: str) -> str:
    """
    Load plan.md from docs/plans/<plan_name>/plan.md
    Returns the markdown content as string.
    """
    raise NotImplementedError("pending:P6.4")


class TestPlanLoader:
    """Test loading plan.md from the plan folder."""

    def test_loads_plan_markdown(self, tmp_path):
        # matrix: plan loader | valid plan folder | P6.4
        # Create temp plan folder
        plan_dir = tmp_path / "docs" / "plans" / "test-plan"
        plan_dir.mkdir(parents=True)
        plan_file = plan_dir / "plan.md"
        plan_file.write_text("# Test Plan\n\n## Assumptions\n- Test assumption\n\n## Open Questions\n- Test question?")

        # Temporarily patch the base path
        import apps.server.server as server_module
        original_root = server_module.REPO_ROOT
        server_module.REPO_ROOT = tmp_path
        try:
            content = load_plan_markdown("test-plan")
            assert "Test assumption" in content
            assert "Test question?" in content
        finally:
            server_module.REPO_ROOT = original_root

    def test_raises_for_nonexistent_plan(self, tmp_path):
        # matrix: plan loader | non-existent plan | P6.4
        import apps.server.server as server_module
        original_root = server_module.REPO_ROOT
        server_module.REPO_ROOT = tmp_path
        try:
            with pytest.raises(FileNotFoundError):
                load_plan_markdown("nonexistent")
        finally:
            server_module.REPO_ROOT = original_root


# =============================================================================
# ENTRY POINT 3: Planner reply endpoint - POST /plans/:name/reply
# Trust: EXTERNAL (server boundary)
# -----------------------------------------------------------------------------

# This will be tested via the aiohttp test client
class TestPlannerReplyEndpoint:
    """Test the planner reply HTTP endpoint."""

    @pytest.fixture
    async def app(self):
        from apps.server.server import create_app
        return create_app()

    @pytest.fixture
    async def client(self, aiohttp_client, app):
        return await aiohttp_client(app)

    async def test_accepts_valid_reply_payload(self, client):
        # matrix: server reply endpoint | valid payload | P6.4
        payload = {
            "itemId": "assumption-0",
            "itemType": "assumption",
            "reply": "Test reply from user"
        }
        resp = await client.post(
            "/plans/sample-plan/reply",
            json=payload,
            headers={"Authorization": "Bearer zod-control-center-token"}
        )
        assert resp.status == 200
        data = await resp.json()
        assert data["status"] == "reply_received"

    async def test_rejects_missing_itemId(self, client):
        # matrix: server reply endpoint | missing itemId | P6.4
        payload = {
            "itemType": "assumption",
            "reply": "Test reply"
        }
        resp = await client.post(
            "/plans/sample-plan/reply",
            json=payload,
            headers={"Authorization": "Bearer zod-control-center-token"}
        )
        assert resp.status == 400

    async def test_rejects_invalid_itemType(self, client):
        # matrix: server reply endpoint | invalid itemType | P6.4
        payload = {
            "itemId": "assumption-0",
            "itemType": "invalid",
            "reply": "Test reply"
        }
        resp = await client.post(
            "/plans/sample-plan/reply",
            json=payload,
            headers={"Authorization": "Bearer zod-control-center-token"}
        )
        assert resp.status == 400

    async def test_requires_authentication(self, client):
        # matrix: server reply endpoint | no auth | P6.4
        payload = {
            "itemId": "assumption-0",
            "itemType": "assumption",
            "reply": "Test reply"
        }
        resp = await client.post(
            "/plans/sample-plan/reply",
            json=payload
        )
        assert resp.status == 401

    async def test_returns_404_for_nonexistent_plan(self, client):
        # matrix: server reply endpoint | plan not found | P6.4
        payload = {
            "itemId": "assumption-0",
            "itemType": "assumption",
            "reply": "Test reply"
        }
        resp = await client.post(
            "/plans/nonexistent/reply",
            json=payload,
            headers={"Authorization": "Bearer zod-control-center-token"}
        )
        assert resp.status == 404


# =============================================================================
# CONTRACT VERIFICATION: Sample plan has assumptions and open questions
# -----------------------------------------------------------------------------

class TestSamplePlanContract:
    """Verify the sample plan meets the contract requirements."""

    def test_sample_plan_has_assumptions(self):
        # matrix: sample plan | assumptions verification | P6.4
        # Read actual sample plan
        plan_path = Path(__file__).parent.parent.parent / "docs" / "plans" / "sample-plan" / "plan.md"
        content = plan_path.read_text()

        # Check Assumptions section exists with items
        assert "## Assumptions" in content
        # Count bullet points in Assumptions section
        assumptions_section = content.split("## Assumptions")[1].split("## ")[0]
        bullet_points = [l for l in assumptions_section.split("\n") if l.strip().startswith("-")]
        assert len(bullet_points) >= 1  # At least one assumption
        assert any("diagrams-check.py" in bp for bp in bullet_points)
        assert any("fast" in bp for bp in bullet_points)
        assert any("syntax" in bp for bp in bullet_points)

    def test_sample_plan_has_open_questions(self):
        # matrix: sample plan | open questions verification | P6.4
        plan_path = Path(__file__).parent.parent.parent / "docs" / "plans" / "sample-plan" / "plan.md"
        content = plan_path.read_text()

        # Check Open Questions section exists with items
        assert "## Open Questions" in content
        questions_section = content.split("## Open Questions")[1].split("## ")[0]
        bullet_points = [l for l in questions_section.split("\n") if l.strip().startswith("-")]
        assert len(bullet_points) >= 1  # At least one question
        assert any("PlantUML" in bp for bp in bullet_points)
        assert any("Rate limiting" in bp for bp in bullet_points)


# =============================================================================
# ROBUSTNESS INVARIANTS
# -----------------------------------------------------------------------------

class TestPlanAssumptionsRobustness:
    """Robustness invariants for unspecified behavior."""

    def test_does_not_crash_on_malformed_markdown(self):
        # matrix: plan parser | malformed markdown | invariant
        # Input class: Malformed
        # Robustness invariant: Does not crash
        try:
            result = parse_plan_assumptions("## Assumptions\n- item\n## Open Questions\n- question\n# No closing")
            assert "assumptions" in result
            assert "open_questions" in result
        except Exception:
            pytest.fail("Parser crashed on malformed markdown")

    def test_handles_unicode_in_plan(self):
        # matrix: plan parser | unicode content | invariant
        # Input class: Unicode
        plan_md = """# Plan

## Assumptions
- Unicode: 🎉 test

## Open Questions
- Question: ¿Cómo?"""

        result = parse_plan_assumptions(plan_md)
        assert len(result["assumptions"]) == 1
        assert "🎉" in result["assumptions"][0]["text"]
        assert len(result["open_questions"]) == 1
        assert "¿Cómo?" in result["open_questions"][0]["text"]


# =============================================================================
# MARK ALL TESTS AS PENDING P6.4
// =============================================================================

# Apply pending marker to all test methods
pytestmark = pytest.mark.xfail(reason="pending:P6.4", strict=False)