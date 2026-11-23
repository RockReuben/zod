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
"""

import sys
import tempfile
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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])