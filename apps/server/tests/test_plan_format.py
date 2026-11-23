#!/usr/bin/env python3
"""
Spec tests for P6.1: Plan folder format definition.

matrix: docs/plans/README.md | valid/typical | P6.1
matrix: docs/plans/README.md | empty/missing | P6.1
matrix: docs/plans/README.md | malformed | P6.1
matrix: docs/plans/<name>/plan.md | valid/typical | P6.1
matrix: docs/plans/<name>/proposed-diagram.md | valid-diagrams | P6.1
matrix: docs/plans/<name>/proposed-diagram.md | invalid-diagrams | P6.1
matrix: docs/plans/<name>/tasks.md | valid/typical | P6.1
matrix: docs/plans/<name>/tasks.md | missing-node-tags | P6.1
matrix: docs/plans/<name>/ | boundary (minimal plan) | P6.1
matrix: diagrams:check | plan-folder-validation | P6.1
"""

import pytest
import subprocess
import sys
from pathlib import Path


# Module-level xfail for tests that depend on validator module not yet implemented
# The README and sample plan already exist, so basic format tests should PASS


class TestPlanFormatReadme:
    """Tests for docs/plans/README.md documenting the plan folder format."""

    def test_readme_exists(self):
        """docs/plans/README.md exists."""
        # matrix: docs/plans/README.md | valid/typical | P6.1
        readme = Path("/home/roman/ws/zod/docs/plans/README.md")
        assert readme.exists(), "docs/plans/README.md should exist"

    def test_readme_documents_three_files(self):
        """README documents plan.md, proposed-diagram.md, and tasks.md."""
        # matrix: docs/plans/README.md | valid/typical | P6.1
        readme = Path("/home/roman/ws/zod/docs/plans/README.md")
        content = readme.read_text()
        assert "plan.md" in content, "README should document plan.md"
        assert "proposed-diagram.md" in content, "README should document proposed-diagram.md"
        assert "tasks.md" in content, "README should document tasks.md"

    def test_readme_documents_plan_md_purpose(self):
        """README explains plan.md is the written plan."""
        # matrix: docs/plans/README.md | valid/typical | P6.1
        readme = Path("/home/roman/ws/zod/docs/plans/README.md")
        content = readme.read_text()
        assert "written plan" in content.lower() or "plan content" in content.lower()

    def test_readme_documents_proposed_diagram_purpose(self):
        """README explains proposed-diagram.md is the Mermaid after the change."""
        # matrix: docs/plans/README.md | valid/typical | P6.1
        readme = Path("/home/roman/ws/zod/docs/plans/README.md")
        content = readme.read_text()
        assert "mermaid" in content.lower() and "proposed" in content.lower()

    def test_readme_documents_tasks_md_purpose(self):
        """README explains tasks.md contains task list with node ID tags."""
        # matrix: docs/plans/README.md | valid/typical | P6.1
        readme = Path("/home/roman/ws/zod/docs/plans/README.md")
        content = readme.read_text()
        assert "task" in content.lower() and "node" in content.lower()

    def test_readme_includes_example_structure(self):
        """README includes an example plan folder structure."""
        # matrix: docs/plans/README.md | valid/typical | P6.1
        readme = Path("/home/roman/ws/zod/docs/plans/README.md")
        content = readme.read_text()
        assert "docs/plans/" in content
        assert "plan.md" in content
        assert "proposed-diagram.md" in content
        assert "tasks.md" in content

    def test_readme_documents_node_id_tag_format(self):
        """README documents how tasks are tagged with node IDs from diagram-map.yaml."""
        # matrix: docs/plans/README.md | valid/typical | P6.1
        readme = Path("/home/roman/ws/zod/docs/plans/README.md")
        content = readme.read_text()
        assert "node" in content.lower() and ("id" in content.lower() or "tag" in content.lower())

    def test_readme_documents_kebab_case_naming(self):
        """README documents that plan folder names must use kebab-case."""
        # matrix: docs/plans/README.md | valid/typical | P6.1
        readme = Path("/home/roman/ws/zod/docs/plans/README.md")
        content = readme.read_text()
        assert "kebab-case" in content.lower()

    def test_readme_lists_valid_node_ids(self):
        """README lists valid node IDs from diagram-map.yaml."""
        # matrix: docs/plans/README.md | valid/typical | P6.1
        readme = Path("/home/roman/ws/zod/docs/plans/README.md")
        content = readme.read_text()
        for node_id in ["server", "client", "hooks", "database", "planning"]:
            assert node_id in content, f"README should list node ID: {node_id}"

    def test_readme_documents_multiple_node_tags(self):
        """README documents that tasks can tag multiple nodes."""
        # matrix: docs/plans/README.md | valid/typical | P6.1
        readme = Path("/home/roman/ws/zod/docs/plans/README.md")
        content = readme.read_text()
        assert "multiple" in content.lower() or "node: server, client" in content


class TestSamplePlanValidation:
    """Tests for the hand-written sample plan that must pass diagrams:check (Done-when check)."""

    def test_sample_plan_exists_in_repo(self):
        """A hand-written sample plan exists under docs/plans/ in the repo."""
        # matrix: docs/plans/<name>/ | valid/typical | P6.1
        plans_dir = Path("/home/roman/ws/zod/docs/plans")
        # Look for any subdirectory that could be a sample plan (not the main plan file)
        sample_dirs = [d for d in plans_dir.iterdir() if d.is_dir() and d.name != "__pycache__"]
        assert len(sample_dirs) >= 1, "At least one sample plan folder should exist under docs/plans/"

    def test_sample_plan_has_three_files(self):
        """Sample plan has plan.md, proposed-diagram.md, and tasks.md."""
        # matrix: docs/plans/<name>/ | valid/typical | P6.1
        plans_dir = Path("/home/roman/ws/zod/docs/plans")
        sample_dirs = [d for d in plans_dir.iterdir() if d.is_dir() and d.name != "__pycache__"]
        assert sample_dirs, "Sample plan directory should exist"
        sample = sample_dirs[0]
        assert (sample / "plan.md").exists(), f"{sample}/plan.md should exist"
        assert (sample / "proposed-diagram.md").exists(), f"{sample}/proposed-diagram.md should exist"
        assert (sample / "tasks.md").exists(), f"{sample}/tasks.md should exist"

    def test_sample_plan_proposed_diagram_passes_check(self):
        """The sample plan's proposed-diagram.md passes npm run diagrams:check."""
        # matrix: diagrams:check | plan-folder-validation | P6.1
        # This is the Done-when check for P6.1
        result = subprocess.run(
            [sys.executable, "/home/roman/ws/zod/scripts/diagrams-check.py"],
            cwd="/home/roman/ws/zod",
            capture_output=True,
            text=True
        )
        assert result.returncode == 0, f"diagrams:check failed on sample plan: {result.stderr}"

    def test_sample_plan_tasks_have_node_tags(self):
        """Sample plan's tasks.md includes node ID tags for each task."""
        # matrix: docs/plans/<name>/tasks.md | valid/typical | P6.1
        plans_dir = Path("/home/roman/ws/zod/docs/plans")
        sample_dirs = [d for d in plans_dir.iterdir() if d.is_dir() and d.name != "__pycache__"]
        assert sample_dirs, "Sample plan directory should exist"
        tasks_file = sample_dirs[0] / "tasks.md"
        content = tasks_file.read_text()
        assert "node:" in content, "tasks.md should contain node ID tags"
        # Check that valid node IDs are used
        for node_id in ["server", "client", "planning"]:
            assert f"node: {node_id}" in content, f"tasks.md should use node: {node_id}"

    def test_sample_plan_plan_md_has_required_sections(self):
        """Sample plan's plan.md has Overview, Assumptions, Open Questions, Details sections."""
        # matrix: docs/plans/<name>/plan.md | valid/typical | P6.1
        plans_dir = Path("/home/roman/ws/zod/docs/plans")
        sample_dirs = [d for d in plans_dir.iterdir() if d.is_dir() and d.name != "__pycache__"]
        assert sample_dirs, "Sample plan directory should exist"
        plan_file = sample_dirs[0] / "plan.md"
        content = plan_file.read_text()
        for section in ["Overview", "Assumptions", "Open Questions", "Details"]:
            assert section in content, f"plan.md should have {section} section"

    def test_sample_plan_proposed_diagram_has_mermaid(self):
        """Sample plan's proposed-diagram.md contains valid Mermaid diagram."""
        # matrix: docs/plans/<name>/proposed-diagram.md | valid-diagrams | P6.1
        plans_dir = Path("/home/roman/ws/zod/docs/plans")
        sample_dirs = [d for d in plans_dir.iterdir() if d.is_dir() and d.name != "__pycache__"]
        assert sample_dirs, "Sample plan directory should exist"
        diagram_file = sample_dirs[0] / "proposed-diagram.md"
        content = diagram_file.read_text()
        assert "```mermaid" in content
        assert "flowchart" in content or "graph" in content


class TestPlanFormatValidationLogic:
    """Tests for the plan format validation logic that will be implemented.

    These tests are PENDING because the validator module doesn't exist yet.
    """

    @pytest.mark.xfail(reason="pending:P6.1: Plan validator module not yet implemented", strict=True)
    def test_plan_validator_exists(self):
        """A plan format validator function/module exists and is importable."""
        # matrix: docs/plans/<name>/ | valid/typical | P6.1
        import importlib.util
        validator_path = "/home/roman/ws/zod/apps/server/plan_validator.py"
        assert Path(validator_path).exists(), "Plan validator module should exist"
        spec = importlib.util.spec_from_file_location("plan_validator", validator_path)
        assert spec is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        assert hasattr(module, "validate_plan_folder") or hasattr(module, "PlanValidator")

    @pytest.mark.xfail(reason="pending:P6.1: Plan validator module not yet implemented", strict=True)
    def test_plan_validator_rejects_missing_plan_md(self):
        """Validator rejects plan folder missing plan.md."""
        # matrix: docs/plans/<name>/plan.md | missing | P6.1
        import sys
        sys.path.insert(0, "/home/roman/ws/zod/apps/server")
        import plan_validator
        with pytest.raises(Exception) as exc_info:
            plan_validator.validate_plan_folder("/nonexistent/path")
        assert "plan.md" in str(exc_info.value).lower() or "missing" in str(exc_info.value).lower()

    @pytest.mark.xfail(reason="pending:P6.1: Plan validator module not yet implemented", strict=True)
    def test_plan_validator_rejects_missing_proposed_diagram(self):
        """Validator rejects plan folder missing proposed-diagram.md."""
        # matrix: docs/plans/<name>/proposed-diagram.md | missing | P6.1
        import sys
        sys.path.insert(0, "/home/roman/ws/zod/apps/server")
        import plan_validator
        import tempfile
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            plan_dir = tmp_path / "test-plan"
            plan_dir.mkdir()
            (plan_dir / "plan.md").write_text("# Plan\n")
            (plan_dir / "tasks.md").write_text("# Tasks\n")
            with pytest.raises(Exception) as exc_info:
                plan_validator.validate_plan_folder(str(plan_dir))
            assert "proposed-diagram" in str(exc_info.value).lower()

    @pytest.mark.xfail(reason="pending:P6.1: Plan validator module not yet implemented", strict=True)
    def test_plan_validator_rejects_missing_tasks_md(self):
        """Validator rejects plan folder missing tasks.md."""
        # matrix: docs/plans/<name>/tasks.md | missing | P6.1
        import sys
        sys.path.insert(0, "/home/roman/ws/zod/apps/server")
        import plan_validator
        import tempfile
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            plan_dir = tmp_path / "test-plan"
            plan_dir.mkdir()
            (plan_dir / "plan.md").write_text("# Plan\n")
            (plan_dir / "proposed-diagram.md").write_text("```mermaid\nflowchart TD A-->B\n```\n")
            with pytest.raises(Exception) as exc_info:
                plan_validator.validate_plan_folder(str(plan_dir))
            assert "tasks.md" in str(exc_info.value).lower()

    @pytest.mark.xfail(reason="pending:P6.1: Plan validator module not yet implemented", strict=True)
    def test_plan_validator_rejects_invalid_mermaid(self):
        """Validator rejects proposed-diagram.md with invalid Mermaid syntax."""
        # matrix: docs/plans/<name>/proposed-diagram.md | invalid-diagrams | P6.1
        import sys
        sys.path.insert(0, "/home/roman/ws/zod/apps/server")
        import plan_validator
        import tempfile
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            plan_dir = tmp_path / "test-plan"
            plan_dir.mkdir()
            (plan_dir / "plan.md").write_text("# Plan\n")
            (plan_dir / "proposed-diagram.md").write_text("```mermaid\nnot valid {{{ \n```\n")
            (plan_dir / "tasks.md").write_text("# Tasks\n")
            with pytest.raises(Exception) as exc_info:
                plan_validator.validate_plan_folder(str(plan_dir))
            assert "mermaid" in str(exc_info.value).lower() or "diagram" in str(exc_info.value).lower()

    @pytest.mark.xfail(reason="pending:P6.1: Plan validator module not yet implemented", strict=True)
    def test_plan_validator_accepts_valid_plan(self):
        """Validator accepts a complete valid plan folder."""
        # matrix: docs/plans/<name>/ | valid/typical | P6.1
        import sys
        sys.path.insert(0, "/home/roman/ws/zod/apps/server")
        import plan_validator
        import tempfile
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            plan_dir = tmp_path / "test-plan"
            plan_dir.mkdir()
            (plan_dir / "plan.md").write_text("# Plan\n\nContent\n")
            (plan_dir / "proposed-diagram.md").write_text("```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```\n")
            (plan_dir / "tasks.md").write_text("# Tasks\n\n- [ ] Task 1 (node: server)\n")
            result = plan_validator.validate_plan_folder(str(plan_dir))
            assert result is True or result.valid is True


class TestPlanFormatIntegration:
    """Integration tests for the full plan folder format."""

    def test_full_check_includes_plan_validation(self):
        """The npm run check command validates plan folders (via diagrams:check)."""
        # matrix: diagrams:check | plan-folder-validation | P6.1
        import json
        with open("/home/roman/ws/zod/package.json") as f:
            pkg = json.load(f)
        assert "diagrams:check" in pkg["scripts"]
        assert "check" in pkg["scripts"]
        check_script = pkg["scripts"]["check"]
        assert "diagrams:check" in check_script or "diagrams-check.py" in check_script

    def test_diagrams_check_validates_plan_folders(self):
        """diagrams:check script validates proposed-diagram.md files in plan folders."""
        # matrix: diagrams:check | plan-folder-validation | P6.1
        # This tests that the existing diagrams-check.py finds plan folder diagrams
        import subprocess
        result = subprocess.run(
            [sys.executable, "/home/roman/ws/zod/scripts/diagrams-check.py"],
            cwd="/home/roman/ws/zod",
            capture_output=True,
            text=True
        )
        # Should find and validate diagrams in plan folders
        assert result.returncode == 0
        # Output should mention plan folder diagrams if they exist
        plans_dir = Path("/home/roman/ws/zod/docs/plans")
        sample_dirs = [d for d in plans_dir.iterdir() if d.is_dir() and d.name != "__pycache__"]
        if sample_dirs:
            # At least one plan folder diagram should be validated
            assert "proposed-diagram" in result.stdout or "plan" in result.stdout.lower()


# Open Question candidates (affects Done-when: yes|no)
# These are recorded as test comments for the test-maker to report

"""
Open Question 1 [affects Done-when: yes]:
- Entry point: docs/plans/README.md | malformed
- Question: Should the README specify exact front-matter or required sections in plan.md (e.g., title, overview, assumptions, open questions)?
- Options: A) Minimal - just document the three files; B) Structured - require specific sections in plan.md
- Invariant-only test written: yes (test_readme_documents_three_files) - README already documents recommended sections

Open Question 2 [affects Done-when: yes]:
- Entry point: docs/plans/<name>/tasks.md | missing-node-tags
- Question: What is the exact syntax for node ID tags in tasks.md?
- Options: A) `(node: server)` at end of line; B) `[node: server]` bracket syntax; C) `#node:server` hashtag; D) YAML front-matter per task
- Answer: The README specifies `(node: <node-id>)` syntax - this is documented
- Invariant-only test written: yes (test_sample_plan_tasks_have_node_tags - tests actual syntax)

Open Question 3 [affects Done-when: no]:
- Entry point: docs/plans/<name>/proposed-diagram.md | valid-diagrams
- Question: Can proposed-diagram.md contain multiple Mermaid diagrams (e.g., one for current, one for proposed)?
- Options: A) Single diagram only; B) Multiple allowed
- Answer: README says "one or more Mermaid diagrams" - multiple allowed
- Invariant-only test written: yes (test_sample_plan_proposed_diagram_has_mermaid)

Open Question 4 [affects Done-when: no]:
- Entry point: docs/plans/<name>/ | boundary
- Question: Should plan folder names be restricted to kebab-case only, or allow any valid directory name?
- Options: A) Strict kebab-case; B) Any valid filesystem name
- Answer: README says "Plan folder names MUST use kebab-case"
- Invariant-only test written: yes (test_readme_documents_kebab_case_naming)

Open Question 5 [affects Done-when: yes]:
- Entry point: diagrams:check | plan-folder-validation
- Question: Should diagrams:check validate ALL .md files under docs/plans/ (including plan.md and tasks.md) or only proposed-diagram.md files?
- Options: A) Only proposed-diagram.md files; B) All .md files in docs/
- Answer: Current implementation validates all .md files under docs/ containing mermaid blocks
- Invariant-only test written: yes (test_diagrams_check_validates_plan_folders)

Open Question 6 [affects Done-when: yes]:
- Entry point: diagrams:check | plan-folder-validation
- Question: The existing diagrams-check.py script has a bug when run from a temp directory (Path.cwd() issue). Should this be fixed as part of P6.1 or is it a separate bug?
- Options: A) Fix in P6.1 (part of plan folder validation); B) Separate bug fix (P3.4 was marked done)
- Note: The test_sample_plan_proposed_diagram_passes_check runs from repo root and passes, so for the Done-when check this is not blocking
- Invariant-only test written: yes (test_sample_plan_proposed_diagram_passes_check passes)

Open Question 7 [affects Done-when: yes]:
- Entry point: apps/server/plan_validator.py | valid/typical
- Question: Should the plan validation logic be a standalone module (plan_validator.py) or integrated into an existing module?
- Options: A) New module plan_validator.py; B) In diagram_map.py; C) In server.py
- Invariant-only test written: yes (test_plan_validator_exists - pending until implemented)
"""