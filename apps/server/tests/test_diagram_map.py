#!/usr/bin/env python3
"""Tests for diagram_map module.

matrix: diagram-map-load | valid-typical | P3.2
matrix: diagram-map-load | empty-missing | P3.2
matrix: diagram-map-load | malformed | P3.2
matrix: diagram-map-load | hostile-content | P3.2
matrix: diagram-map-match | valid-typical | P3.2
matrix: diagram-map-match | boundary | P3.2
matrix: diagram-map-match | empty-missing | P3.2
matrix: diagram-map-match | out-of-order | P3.2
matrix: diagram-map-match | wrong-type | P3.2
matrix: diagram-map-drift | valid-typical | P3.3
matrix: diagram-map-drift | empty-missing | P3.3
matrix: diagram-map-extract | valid-typical | P3.3
"""

import sys
import tempfile
import time
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from diagram_map import (
    DiagramMapping,
    MappingResult,
    load_mappings,
    glob_specificity,
    match_path_to_mappings,
    resolve_file_path,
    check_diagram_drift,
    get_file_path_from_tool_input,
    REPO_ROOT,
)


class TestLoadMappings:
    """Tests for load_mappings function."""

    def test_load_valid_yaml(self):
        """Load a valid diagram-map.yaml."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("""
- glob: "apps/server/**"
  diagram: "docs/diagrams/system-overview.md"
  node: "server"
- glob: "apps/client/**"
  diagram: "docs/diagrams/system-overview.md"
  node: "client"
""")
            f.flush()
            path = Path(f.name)

        try:
            mappings = load_mappings(path)
            assert len(mappings) == 2
            assert mappings[0].glob == "apps/server/**"
            assert mappings[0].diagram == "docs/diagrams/system-overview.md"
            assert mappings[0].node == "server"
            assert mappings[1].glob == "apps/client/**"
            assert mappings[1].node == "client"
        finally:
            path.unlink()

    def test_load_empty_file(self):
        """Loading empty file returns empty list."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("")
            f.flush()
            path = Path(f.name)

        try:
            mappings = load_mappings(path)
            assert mappings == []
        finally:
            path.unlink()

    def test_load_nonexistent_file(self):
        """Loading nonexistent file returns empty list."""
        mappings = load_mappings(Path("/nonexistent/path.yaml"))
        assert mappings == []

    def test_load_malformed_yaml(self):
        """Malformed YAML returns empty list (fails closed)."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("""
- glob: "apps/server/**"
  diagram: "docs/diagrams/system-overview.md"
  node: "server"
- invalid yaml: [
""")
            f.flush()
            path = Path(f.name)

        try:
            mappings = load_mappings(path)
            assert mappings == []
        finally:
            path.unlink()

    def test_load_missing_fields(self):
        """Entries missing required fields are skipped."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write("""
- glob: "apps/server/**"
  diagram: "docs/diagrams/system-overview.md"
  node: "server"
- glob: "apps/client/**"
  # missing diagram and node
- diagram: "docs/diagrams/other.md"
  node: "other"
  # missing glob
""")
            f.flush()
            path = Path(f.name)

        try:
            mappings = load_mappings(path)
            assert len(mappings) == 1
            assert mappings[0].node == "server"
        finally:
            path.unlink()


class TestGlobSpecificity:
    """Tests for glob_specificity scoring."""

    def test_more_specific_wins(self):
        """More specific globs get higher scores."""
        assert glob_specificity("apps/server/special/*") > glob_specificity("apps/server/**")
        assert glob_specificity("apps/server/specific.py") > glob_specificity("apps/server/*")
        assert glob_specificity("apps/server/file?.py") > glob_specificity("apps/server/*")

    def test_literal_chars_score_highest(self):
        """Literal characters score highest."""
        assert glob_specificity("apps/server/specific.py") > glob_specificity("apps/server/*")
        assert glob_specificity("a") > glob_specificity("*")

    def test_double_star_lowest(self):
        """** has lowest specificity."""
        assert glob_specificity("**") < glob_specificity("*")
        assert glob_specificity("apps/**") < glob_specificity("apps/*")


class TestMatchPathToMappings:
    """Tests for match_path_to_mappings function."""

    def setup_method(self):
        """Set up test mappings."""
        self.mappings = [
            DiagramMapping("apps/server/**", "docs/diagrams/system-overview.md", "server"),
            DiagramMapping("apps/client/**", "docs/diagrams/system-overview.md", "client"),
            DiagramMapping(".claude/hooks/**", "docs/diagrams/system-overview.md", "hooks"),
            DiagramMapping("docs/diagrams/**", "docs/diagrams/system-overview.md", "database"),
            DiagramMapping("docs/plans/**", "docs/diagrams/system-overview.md", "planning"),
        ]

    def test_exact_match_first_entry(self):
        """Exact match to first entry."""
        results = match_path_to_mappings("apps/server/server.py", self.mappings)
        assert len(results) == 1
        assert results[0].node == "server"
        assert results[0].diagram == "docs/diagrams/system-overview.md"

    def test_exact_match_second_entry(self):
        """Exact match to second entry."""
        results = match_path_to_mappings("apps/client/src/App.tsx", self.mappings)
        assert len(results) == 1
        assert results[0].node == "client"

    def test_exact_match_third_entry(self):
        """Exact match to third entry."""
        results = match_path_to_mappings(".claude/hooks/send_event.py", self.mappings)
        assert len(results) == 1
        assert results[0].node == "hooks"

    def test_exact_match_fourth_entry(self):
        """Exact match to fourth entry."""
        results = match_path_to_mappings("docs/diagrams/system-overview.md", self.mappings)
        assert len(results) == 1
        assert results[0].node == "database"

    def test_exact_match_fifth_entry(self):
        """Exact match to fifth entry."""
        results = match_path_to_mappings("docs/plans/my-plan/plan.md", self.mappings)
        assert len(results) == 1
        assert results[0].node == "planning"

    def test_no_match(self):
        """Path with no matching glob returns empty list."""
        results = match_path_to_mappings("unknown/path/file.txt", self.mappings)
        assert results == []

    def test_nested_path(self):
        """Deeply nested path matches parent glob."""
        results = match_path_to_mappings("apps/server/utils/helpers/config.py", self.mappings)
        assert len(results) == 1
        assert results[0].node == "server"

    def test_specificity_wins(self):
        """More specific glob wins over less specific."""
        # Add a more specific mapping
        mappings_with_specific = self.mappings + [
            DiagramMapping("apps/server/special/**", "docs/diagrams/system-overview.md", "special-server"),
        ]
        results = match_path_to_mappings("apps/server/special/module.py", mappings_with_specific)
        assert len(results) == 1
        assert results[0].node == "special-server"

    def test_tiebreaker_file_order(self):
        """Same specificity: first in file wins (single best match returned)."""
        mappings_tie = [
            DiagramMapping("apps/**", "docs/diagrams/a.md", "first"),
            DiagramMapping("apps/**", "docs/diagrams/b.md", "second"),
        ]
        results = match_path_to_mappings("apps/server/file.py", mappings_tie)
        assert len(results) == 1
        assert results[0].node == "first"

    def test_multiple_same_specificity(self):
        """Multiple matches with same specificity: only first in file order returned."""
        mappings_multi = [
            DiagramMapping("apps/server/**", "docs/diagrams/a.md", "server"),
            DiagramMapping("apps/server/**", "docs/diagrams/b.md", "server-alt"),
        ]
        results = match_path_to_mappings("apps/server/file.py", mappings_multi)
        assert len(results) == 1
        assert results[0].node == "server"

    def test_path_with_backslashes(self):
        """Windows-style backslashes are normalized."""
        results = match_path_to_mappings("apps\\server\\file.py", self.mappings)
        assert len(results) == 1
        assert results[0].node == "server"

    def test_empty_path(self):
        """Empty path returns no matches."""
        results = match_path_to_mappings("", self.mappings)
        assert results == []


class TestResolveFilePath:
    """Integration tests for resolve_file_path using real diagram-map.yaml."""

    def test_with_real_map(self):
        """Test against actual repo diagram-map.yaml."""
        repo_root = Path(__file__).parent.parent.parent.parent
        results = resolve_file_path("apps/server/server.py", repo_root)
        assert len(results) == 1
        assert results[0].node == "server"

    def test_client_path(self):
        """Test client path."""
        repo_root = Path(__file__).parent.parent.parent.parent
        results = resolve_file_path("apps/client/src/components/TimelineLane.tsx", repo_root)
        assert len(results) == 1
        assert results[0].node == "client"

    def test_hooks_path(self):
        """Test hooks path."""
        repo_root = Path(__file__).parent.parent.parent.parent
        results = resolve_file_path(".claude/hooks/send_event.py", repo_root)
        assert len(results) == 1
        assert results[0].node == "hooks"

    def test_diagrams_path(self):
        """Test diagrams path."""
        repo_root = Path(__file__).parent.parent.parent.parent
        results = resolve_file_path("docs/diagrams/system-overview.md", repo_root)
        assert len(results) == 1
        assert results[0].node == "database"

    def test_plans_path(self):
        """Test plans path."""
        repo_root = Path(__file__).parent.parent.parent.parent
        results = resolve_file_path("docs/plans/zod-control-center.md", repo_root)
        assert len(results) == 1
        assert results[0].node == "planning"

    def test_unmapped_path(self):
        """Test unmapped path returns empty."""
        repo_root = Path(__file__).parent.parent.parent.parent
        results = resolve_file_path("random/file.txt", repo_root)
        assert results == []


class TestCheckDiagramDrift:
    """Tests for check_diagram_drift function."""

    def setup_method(self):
        """Set up temp directory structure for drift tests."""
        self.tmp_dir = Path(tempfile.mkdtemp())
        self.repo_root = self.tmp_dir

        # Create diagram-map.yaml
        map_file = self.repo_root / "diagram-map.yaml"
        map_file.write_text("""
- glob: "apps/server/**"
  diagram: "docs/diagrams/system-overview.md"
  node: "server"
- glob: "apps/client/**"
  diagram: "docs/diagrams/system-overview.md"
  node: "client"
""")

        # Create directory structure
        (self.repo_root / "apps" / "server").mkdir(parents=True)
        (self.repo_root / "docs" / "diagrams").mkdir(parents=True)

        # Create a diagram file
        diagram_file = self.repo_root / "docs" / "diagrams" / "system-overview.md"
        diagram_file.write_text("# System Overview\n```mermaid\nflowchart TD\n    server[Server]\n```")

    def teardown_method(self):
        """Clean up temp directory."""
        import shutil
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_drift_when_source_newer_than_diagram(self):
        """Drift warning when source file is newer than diagram."""
        # Create a source file
        source_file = self.repo_root / "apps" / "server" / "new_module.py"
        source_file.write_text("# New module")

        # Wait a bit to ensure different mtimes
        time.sleep(0.01)

        # Update the source file (make it newer)
        source_file.write_text("# New module updated")

        drift = check_diagram_drift("apps/server/new_module.py", self.repo_root)
        assert len(drift) == 1
        assert drift[0]["node"] == "server"
        assert drift[0]["diagram"] == "docs/diagrams/system-overview.md"
        assert drift[0]["file_path"] == "apps/server/new_module.py"
        assert "newer" in drift[0]["reason"]

    def test_no_drift_when_diagram_newer(self):
        """No drift when diagram is newer than source file."""
        # Create a source file
        source_file = self.repo_root / "apps" / "server" / "module.py"
        source_file.write_text("# Module")

        # Wait a bit
        time.sleep(0.01)

        # Update the diagram (make it newer)
        diagram_file = self.repo_root / "docs" / "diagrams" / "system-overview.md"
        diagram_file.write_text("# System Overview Updated\n```mermaid\nflowchart TD\n    server[Server]\n```")

        drift = check_diagram_drift("apps/server/module.py", self.repo_root)
        assert drift == []

    def test_no_drift_for_unmapped_path(self):
        """No drift for paths that don't match any mapping."""
        drift = check_diagram_drift("random/file.txt", self.repo_root)
        assert drift == []

    def test_no_drift_when_diagram_missing(self):
        """No drift when diagram file doesn't exist."""
        # Create a source file
        source_file = self.repo_root / "apps" / "server" / "module.py"
        source_file.write_text("# Module")

        # Remove diagram
        diagram_file = self.repo_root / "docs" / "diagrams" / "system-overview.md"
        diagram_file.unlink()

        drift = check_diagram_drift("apps/server/module.py", self.repo_root)
        assert drift == []


class TestGetFilePathFromToolInput:
    """Tests for get_file_path_from_tool_input function."""

    def test_write_tool(self):
        """Write tool has file_path in input."""
        result = get_file_path_from_tool_input("Write", {"file_path": "/path/to/file.py", "content": "x"})
        assert result == "/path/to/file.py"

    def test_edit_tool(self):
        """Edit tool has file_path in input."""
        result = get_file_path_from_tool_input("Edit", {"file_path": "/path/to/file.py", "old_string": "a", "new_string": "b"})
        assert result == "/path/to/file.py"

    def test_multiedit_tool(self):
        """MultiEdit tool has file_path in input."""
        result = get_file_path_from_tool_input("MultiEdit", {"file_path": "/path/to/file.py", "edits": []})
        assert result == "/path/to/file.py"

    def test_read_tool(self):
        """Read tool has file_path in input."""
        result = get_file_path_from_tool_input("Read", {"file_path": "/path/to/file.py"})
        assert result == "/path/to/file.py"

    def test_unknown_tool(self):
        """Unknown tool returns None."""
        result = get_file_path_from_tool_input("UnknownTool", {"file_path": "/path/to/file.py"})
        assert result is None

    def test_task_tool(self):
        """Task tool returns None (no direct file path)."""
        result = get_file_path_from_tool_input("Task", {"description": "Do something"})
        assert result is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])