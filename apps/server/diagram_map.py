#!/usr/bin/env python3
"""Diagram map module for mapping file paths to diagram nodes.

Reads diagram-map.yaml and provides functions to resolve file paths
to zero or more diagram nodes using glob matching.
"""

import fnmatch
import json
import os
from pathlib import Path
from typing import NamedTuple

import yaml

# Repo root for diagram mapping
REPO_ROOT = Path(__file__).parent.parent.parent


def normalize_file_path(file_path: str, repo_root: Path | None = None) -> str | None:
    """Normalize a file path to be relative to repo root.

    Handles relative paths and absolute paths under repo root.
    Resolves path traversal (..) and verifies the path stays within repo root.
    Returns None if the path is outside repo root or traversal escapes.
    """
    if repo_root is None:
        repo_root = REPO_ROOT

    path = Path(file_path)
    repo_root_resolved = repo_root.resolve()

    # If relative, resolve against repo_root and verify it stays within
    if not path.is_absolute():
        resolved = (repo_root_resolved / path).resolve()
        try:
            relative = resolved.relative_to(repo_root_resolved)
            return str(relative).replace("\\", "/")
        except ValueError:
            # Traversal escaped repo root (e.g., apps/server/../../../etc/passwd)
            return None

    # If absolute, resolve and verify it's under repo_root
    try:
        resolved = path.resolve()
        relative = resolved.relative_to(repo_root_resolved)
        return str(relative).replace("\\", "/")
    except ValueError:
        # Path is not under repo root
        return None


class DiagramMapping(NamedTuple):
    """A single mapping entry from diagram-map.yaml."""
    glob: str
    diagram: str
    node: str


class MappingResult(NamedTuple):
    """Result of mapping a file path to diagram nodes."""
    diagram: str
    node: str


def load_mappings(map_path: Path) -> list[DiagramMapping]:
    """Load mappings from diagram-map.yaml.

    Args:
        map_path: Path to the diagram-map.yaml file.

    Returns:
        List of DiagramMapping entries in file order.
    """
    if not map_path.exists():
        return []

    try:
        with open(map_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except yaml.YAMLError:
        # Fail closed: malformed YAML returns empty list
        return []

    if not data:
        return []

    mappings = []
    for entry in data:
        if isinstance(entry, dict) and "glob" in entry and "diagram" in entry and "node" in entry:
            mappings.append(DiagramMapping(
                glob=entry["glob"],
                diagram=entry["diagram"],
                node=entry["node"],
            ))

    return mappings


def glob_specificity(glob: str) -> int:
    """Calculate specificity score for a glob pattern.

    Higher score = more specific.
    - Literal characters add to specificity
    - ** is least specific (matches any directories)
    - * is more specific (matches within a directory)
    - ? is even more specific (single character)
    """
    score = 0
    i = 0
    while i < len(glob):
        if glob[i] == '*':
            if i + 1 < len(glob) and glob[i + 1] == '*':
                # ** - matches any directories
                score += 1
                i += 2
            else:
                # * - matches within directory
                score += 5
                i += 1
        elif glob[i] == '?':
            # ? - matches single character
            score += 10
            i += 1
        elif glob[i] == '[':
            # [...] - character class
            score += 15
            while i < len(glob) and glob[i] != ']':
                i += 1
            i += 1
        else:
            # Literal character
            score += 20
            i += 1
    return score


def match_path_to_mappings(file_path: str, mappings: list[DiagramMapping]) -> list[MappingResult]:
    """Match a file path to diagram mappings.

    Uses glob matching with most-specific-glob-wins algorithm.
    Ties are broken by file order (first match wins).

    Args:
        file_path: Relative path from repo root (e.g., "apps/server/server.py")
        mappings: List of DiagramMapping entries in file order.

    Returns:
        List of MappingResult (diagram, node) for matching entries.
        Returns empty list if no match.
    """
    # Normalize path separators
    file_path = file_path.replace("\\", "/")

    matches = []
    for idx, mapping in enumerate(mappings):
        # Use fnmatch for glob matching
        # fnmatch translates glob to regex
        if fnmatch.fnmatch(file_path, mapping.glob):
            specificity = glob_specificity(mapping.glob)
            matches.append((specificity, idx, mapping))

    if not matches:
        return []

    # Sort by specificity descending, then by file order ascending
    matches.sort(key=lambda x: (-x[0], x[1]))

    # Return only the single most specific match (first in file order for ties)
    best_specificity, best_idx, best_mapping = matches[0]
    return [MappingResult(diagram=best_mapping.diagram, node=best_mapping.node)]


def resolve_file_path(file_path: str, repo_root: Path | None = None) -> list[MappingResult]:
    """Resolve a file path to diagram nodes.

    This is the main entry point. It loads diagram-map.yaml from the repo root
    and matches the file path against it.

    Args:
        file_path: Relative path from repo root (e.g., "apps/server/server.py")
        repo_root: Optional explicit repo root. Defaults to current working directory.

    Returns:
        List of MappingResult (diagram, node) for matching entries.
        Returns empty list if no match.
    """
    if repo_root is None:
        repo_root = Path.cwd()

    map_path = repo_root / "diagram-map.yaml"
    mappings = load_mappings(map_path)
    return match_path_to_mappings(file_path, mappings)


def check_diagram_drift(file_path: str, repo_root: Path | None = None) -> list[dict]:
    """Check if a mapped file edit should trigger a diagram_drift warning.

    A drift warning is emitted when:
    - The file matches a mapping in diagram-map.yaml
    - The corresponding diagram file exists
    - The diagram file's mtime is older than the file's mtime (or we don't have a record of it being updated)

    Args:
        file_path: Relative path from repo root (e.g., "apps/server/server.py")
        repo_root: Optional explicit repo root. Defaults to current working directory.

    Returns:
        List of drift warnings, each with diagram path, node, and file path.
        Empty list if no drift or no mapping.
    """
    if repo_root is None:
        repo_root = Path.cwd()

    results = resolve_file_path(file_path, repo_root)
    if not results:
        return []

    drift_warnings = []
    for result in results:
        diagram_path = repo_root / result.diagram
        if diagram_path.exists():
            # Simple check: if the source file is newer than the diagram,
            # the diagram may be out of date
            try:
                file_mtime = (repo_root / file_path).stat().st_mtime
                diagram_mtime = diagram_path.stat().st_mtime
                if file_mtime > diagram_mtime:
                    drift_warnings.append({
                        "diagram": result.diagram,
                        "node": result.node,
                        "file_path": file_path,
                        "reason": "source file newer than diagram"
                    })
            except OSError:
                # File doesn't exist or stat failed - no drift info
                pass

    return drift_warnings


def get_file_path_from_tool_input(tool_name: str, tool_input: dict) -> str | None:
    """Extract file path from a tool input dict based on tool name.

    Args:
        tool_name: The tool name (e.g., "Write", "Edit", "MultiEdit", "Read")
        tool_input: The tool input dictionary

    Returns:
        The file path if found, None otherwise.
    """
    if tool_name in ("Write", "Edit", "MultiEdit"):
        # These tools have file_path in their input
        return tool_input.get("file_path")
    elif tool_name == "Read":
        return tool_input.get("file_path")
    elif tool_name == "Task":
        # Task tool might have file references in description
        return None
    return None


if __name__ == "__main__":
    import sys

    # Simple CLI for testing
    if len(sys.argv) > 1:
        for path in sys.argv[1:]:
            results = resolve_file_path(path)
            if results:
                for r in results:
                    print(f"{path} -> {r.diagram} :: {r.node}")
            else:
                print(f"{path} -> NO MATCH")

            # Also check for drift
            drift = check_diagram_drift(path)
            if drift:
                for d in drift:
                    print(f"  DRIFT: {d['diagram']} :: {d['node']} (file: {d['file_path']}) - {d['reason']}")
    else:
        # Test with some example paths
        test_paths = [
            "apps/server/server.py",
            "apps/client/src/components/TimelineLane.tsx",
            ".claude/hooks/send_event.py",
            "docs/diagrams/system-overview.md",
            "docs/plans/my-plan/plan.md",
            "unknown/path/file.txt",
        ]
        for path in test_paths:
            results = resolve_file_path(path)
            if results:
                for r in results:
                    print(f"{path} -> {r.diagram} :: {r.node}")
            else:
                print(f"{path} -> NO MATCH")

            drift = check_diagram_drift(path)
            if drift:
                for d in drift:
                    print(f"  DRIFT: {d['diagram']} :: {d['node']} (file: {d['file_path']}) - {d['reason']}")