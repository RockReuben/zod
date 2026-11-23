#!/usr/bin/env python3
"""Diagram map module for mapping file paths to diagram nodes.

Reads diagram-map.yaml and provides functions to resolve file paths
to zero or more diagram nodes using glob matching.
"""

import fnmatch
import os
from pathlib import Path
from typing import NamedTuple

import yaml


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