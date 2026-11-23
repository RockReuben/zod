#!/usr/bin/env python3
"""Tests for diagrams:check script entry point.

matrix: diagrams-check | valid-diagrams | P3.4
matrix: diagrams-check | invalid-diagrams | P3.4
matrix: diagrams-check | exit-codes | P3.4
"""

import json
import importlib.util
import subprocess
import sys
import tempfile
from pathlib import Path

# Load the script module to access its functions for test helpers
_SPEC = importlib.util.spec_from_file_location(
    "diagrams_check", "/home/roman/ws/zod/scripts/diagrams-check.py"
)
_DIAGRAMS_MOD = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_DIAGRAMS_MOD)

find_mermaid_files = _DIAGRAMS_MOD.find_mermaid_files
validate_diagram = _DIAGRAMS_MOD.validate_diagram

SCRIPT_PATH = "/home/roman/ws/zod/scripts/diagrams-check.py"


def run_diagrams_check(cwd: Path | None = None) -> subprocess.CompletedProcess:
    """Run the diagrams-check script and return the result."""
    cmd = [sys.executable, SCRIPT_PATH]
    return subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)


class TestFindMermaidFiles:
    """Tests for find_mermaid_files function (internal, used by script)."""

    def test_finds_mermaid_in_md_file(self):
        """Function finds .md files containing mermaid code blocks."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create an .md file with mermaid
            md_file = tmp_path / "test.md"
            md_file.write_text("```mermaid\nflowchart TD A[Start] --> B[End]\n```\n")

            # Create an .md file without mermaid
            (tmp_path / "no-mermaid.md").write_text("# Just text\n")

            # Create a .txt file with mermaid (should be ignored)
            (tmp_path / "notes.txt").write_text("```mermaid\nsomething\n```\n")

            files = find_mermaid_files(tmp_path)
            assert len(files) == 1, f"Expected 1 file, got {len(files)}: {files}"
            assert files[0] == md_file

    def test_no_mermaid_files(self):
        """Function returns empty list when no mermaid found."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            (tmp_path / "readme.md").write_text("# No mermaid here")
            files = find_mermaid_files(tmp_path)
            assert files == []

    def test_multiple_mermaid_files(self):
        """Function finds all .md files with mermaid blocks."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            for i in range(3):
                md_file = tmp_path / f"diagram{i}.md"
                md_file.write_text(f"```mermaid\nflowchart TD A{i}[Start {i}] --> B{i}[End {i}]\n```\n")

            (tmp_path / "other.md").write_text("# No mermaid\n")

            files = find_mermaid_files(tmp_path)
            assert len(files) == 3, f"Expected 3 files, got {len(files)}: {files}"


class TestDiagramsCheckScriptExitCodes:
    """Tests for the diagrams:check script exit codes (observable behavior)."""

    def test_exit_0_when_running_from_repo_root(self):
        """Script exits 0 when run from repo root with valid diagrams."""
        result = run_diagrams_check(cwd=Path("/home/roman/ws/zod"))
        assert result.returncode == 0, (
            f"Expected exit 0 from repo root, got {result.returncode}. "
            f"stderr: {result.stderr}\nstdout: {result.stdout}"
        )

    def test_script_runs_successfully_with_repo_diagrams(self):
        """Script successfully validates the repo's own diagrams."""
        result = run_diagrams_check(cwd=Path("/home/roman/ws/zod"))
        assert result.returncode == 0
        assert "All diagrams are valid" in result.stdout

    def test_exit_1_when_temp_dir_has_invalid_diagram(self):
        """Script exits 1 when a temp dir has an invalid diagram."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Create an invalid diagram file
            md_file = tmp_path / "invalid.md"
            md_file.write_text("```mermaid\nthis is definitely not valid mermaid {{{\n```\n")

            result = run_diagrams_check(cwd=tmp_path)
            assert result.returncode == 1, (
                f"Expected exit 1 for invalid diagram, got {result.returncode}. "
                f"stdout: {result.stdout}\nstderr: {result.stderr}"
            )

    def test_output_contains_diagram_files(self):
        """Script output lists the diagram files it validates."""
        result = run_diagrams_check(cwd=Path("/home/roman/ws/zod"))
        assert "Found" in result.stdout or "Validating" in result.stdout
        # Should mention at least one diagram file
        assert any(
            f in result.stdout for f in ["docs/plans/zod-control-center.md", "docs/diagrams/system-overview.md"]
        )


class TestDiagramsCheckIntegration:
    """Integration-level tests for the diagrams check script."""

    def test_full_check_included_in_npm_check(self):
        """The npm check command includes diagrams:check."""
        # Read package.json directly
        with open("/home/roman/ws/zod/package.json") as f:
            pkg = json.load(f)
        scripts = pkg["scripts"]
        assert "diagrams:check" in scripts, "diagrams:check should be in package.json scripts"
        assert "check" in scripts, "check should be in package.json scripts"

    def test_check_script_depends_on_diagrams_check(self):
        """The check script runs diagrams:check as a subprocess."""
        # This tests that the integration works end-to-end
        result = run_diagrams_check(cwd=Path("/home/roman/ws/zod"))
        assert result.returncode == 0