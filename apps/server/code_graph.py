#!/usr/bin/env python3
"""
Code Graph Engine for Codebase View.

Builds a real-time graph of the repository's file structure with:
- AST/regex-based import/export extraction
- SHA-256 fingerprinting for sync validation
- Incremental delta updates
- watchfiles integration for external change detection
"""

import asyncio
import hashlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
import ast

# watchfiles for filesystem watching (async)
try:
    import watchfiles
    WATCHFILES_AVAILABLE = True
except ImportError:
    WATCHFILES_AVAILABLE = False
    watchfiles = None

from diagram_map import REPO_ROOT, normalize_file_path


# Excluded directories and patterns
EXCLUDED_DIRS = {'.git', 'node_modules', '__pycache__', 'var', '.venv', 'venv', 'env', 'dist', 'build', '.next', '.cache'}
EXCLUDED_FILE_PATTERNS = [r'\.env', r'\.pyc$', r'\.pyo$', r'~$', r'\.swp$', r'\.swo$', r'\.DS_Store$']


def should_exclude(path: Path) -> bool:
    """Check if a path should be excluded from scanning."""
    # Check directory parts
    for part in path.parts:
        if part in EXCLUDED_DIRS:
            return True
    # Check file patterns
    name = path.name
    for pattern in EXCLUDED_FILE_PATTERNS:
        if re.search(pattern, name):
            return True
    return False


def get_language(file_path: Path) -> str:
    """Determine language from file extension."""
    suffix = file_path.suffix.lower()
    lang_map = {
        '.py': 'python',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.json': 'json',
        '.md': 'markdown',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.toml': 'toml',
        '.ini': 'ini',
        '.cfg': 'ini',
        '.sh': 'shell',
        '.bash': 'shell',
        '.zsh': 'shell',
        '.dockerfile': 'dockerfile',
        '.sql': 'sql',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.sass': 'sass',
        '.less': 'less',
        '.graphql': 'graphql',
        '.gql': 'graphql',
    }
    return lang_map.get(suffix, 'text')


def count_loc(file_path: Path) -> int:
    """Count non-empty, non-comment lines of code."""
    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        return 0

    lines = content.splitlines()
    count = 0
    in_block_comment = False

    for line in lines:
        stripped = line.strip()

        # Handle block comments
        if in_block_comment:
            if '*/' in stripped:
                in_block_comment = False
            continue

        if not stripped:
            continue

        # Check for block comment start
        if stripped.startswith('/*') or stripped.startswith('"""') or stripped.startswith("'''"):
            in_block_comment = True
            if '*/' in stripped or stripped.count('"""') >= 2 or stripped.count("'''") >= 2:
                in_block_comment = False
            continue

        # Single-line comments
        if stripped.startswith('//') or stripped.startswith('#'):
            continue

        count += 1

    return count


def extract_ts_imports_exports(content: str) -> tuple[list[str], list[str]]:
    """Extract imports and exports from TypeScript/JavaScript using regex."""
    imports = []
    exports = []

    # import ... from '...'
    import_from_pattern = re.compile(r'import\s+(?:[^"\'\n]+\s+from\s+)?[\'"]([^\'"]+)[\'"]')
    for match in import_from_pattern.finditer(content):
        imports.append(match.group(1))

    # import '...' (side-effect imports)
    import_side_effect = re.compile(r'import\s+[\'"]([^\'"]+)[\'"]')
    for match in import_side_effect.finditer(content):
        imports.append(match.group(1))

    # export { ... } from '...'
    export_from_pattern = re.compile(r'export\s+\{[^}]+\}\s+from\s+[\'"]([^\'"]+)[\'"]')
    for match in export_from_pattern.finditer(content):
        exports.append(match.group(1))

    # export ... (named/default)
    export_pattern = re.compile(r'export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)\s+(\w+)')
    for match in export_pattern.finditer(content):
        exports.append(match.group(1))

    # export { a, b, c }
    export_brace_pattern = re.compile(r'export\s+\{([^}]+)\}')
    for match in export_brace_pattern.finditer(content):
        items = [x.strip() for x in match.group(1).split(',')]
        exports.extend(items)

    return imports, exports


def extract_py_imports_exports(file_path: Path) -> tuple[list[str], list[str]]:
    """Extract imports and exports from Python using AST."""
    imports = []
    exports = []

    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        tree = ast.parse(content)
    except Exception:
        return imports, exports

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            module = node.module or ''
            for alias in node.names:
                if module:
                    imports.append(f"{module}.{alias.name}")
                else:
                    imports.append(alias.name)
        elif isinstance(node, ast.FunctionDef) or isinstance(node, ast.ClassDef):
            # Public functions/classes (not starting with _)
            if not node.name.startswith('_'):
                exports.append(node.name)
        elif isinstance(node, ast.Assign):
            # Module-level constants (UPPER_CASE)
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id.isupper():
                    exports.append(target.id)

    return imports, exports


@dataclass
class CodeNode:
    """A node in the code graph (file or directory)."""
    id: str
    path: str
    name: str
    type: str  # 'file' | 'dir'
    language: str
    loc: int
    imports: list[str] = field(default_factory=list)
    exports: list[str] = field(default_factory=list)
    mtime: float = 0.0
    depth: int = 0
    parent: str | None = None
    children: list[str] = field(default_factory=list)
    agent_activity: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'path': self.path,
            'name': self.name,
            'type': self.type,
            'language': self.language,
            'loc': self.loc,
            'imports': self.imports,
            'exports': self.exports,
            'mtime': self.mtime,
            'depth': self.depth,
            'parent': self.parent,
            'children': self.children,
            'agent_activity': self.agent_activity,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'CodeNode':
        return cls(**data)


@dataclass
class CodeEdge:
    """An edge in the code graph (import/reference relationship)."""
    id: str
    source: str  # node id
    target: str  # node id
    type: str  # 'import' | 'reference' | 'hierarchy'
    label: str = ''

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'source': self.source,
            'target': self.target,
            'type': self.type,
            'label': self.label,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'CodeEdge':
        return cls(**data)


@dataclass
class GraphDelta:
    """Incremental graph update."""
    added_nodes: list[CodeNode] = field(default_factory=list)
    removed_node_ids: list[str] = field(default_factory=list)
    updated_nodes: list[CodeNode] = field(default_factory=list)
    added_edges: list[CodeEdge] = field(default_factory=list)
    removed_edge_ids: list[str] = field(default_factory=list)
    updated_edges: list[CodeEdge] = field(default_factory=list)
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            'added_nodes': [n.to_dict() for n in self.added_nodes],
            'removed_node_ids': self.removed_node_ids,
            'updated_nodes': [n.to_dict() for n in self.updated_nodes],
            'added_edges': [e.to_dict() for e in self.added_edges],
            'removed_edge_ids': self.removed_edge_ids,
            'updated_edges': [e.to_dict() for e in self.updated_edges],
            'timestamp': self.timestamp,
        }

    def has_changes(self) -> bool:
        return any([
            self.added_nodes,
            self.removed_node_ids,
            self.updated_nodes,
            self.added_edges,
            self.removed_edge_ids,
            self.updated_edges,
        ])


class CodeGraph:
    """
    Main code graph data structure.

    Maintains nodes, edges, and a deterministic SHA-256 fingerprint
    for client synchronization validation.
    """

    def __init__(self, repo_root: Path | None = None):
        self.repo_root = repo_root or REPO_ROOT
        self.nodes: dict[str, CodeNode] = {}
        self.edges: dict[str, CodeEdge] = {}
        self._fingerprint: str = ''
        self._scan_task: asyncio.Task | None = None
        self._watcher_task: asyncio.Task | None = None
        self._delta_callbacks: list[callable] = []

    def compute_fingerprint(self) -> str:
        """Compute deterministic SHA-256 fingerprint of the graph."""
        # Sort nodes and edges for deterministic serialization
        sorted_nodes = sorted(
            [n.to_dict() for n in self.nodes.values()],
            key=lambda x: x['id']
        )
        sorted_edges = sorted(
            [e.to_dict() for e in self.edges.values()],
            key=lambda x: x['id']
        )
        canonical = json.dumps({'nodes': sorted_nodes, 'edges': sorted_edges}, separators=(',', ':'), sort_keys=True)
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()

    @property
    def fingerprint(self) -> str:
        if not self._fingerprint:
            self._fingerprint = self.compute_fingerprint()
        return self._fingerprint

    def invalidate_fingerprint(self):
        self._fingerprint = ''

    def generate_node_id(self, path: str) -> str:
        """Generate stable node ID from path."""
        return hashlib.sha256(path.encode('utf-8')).hexdigest()[:16]

    def get_or_create_node(self, path: str, node_type: str) -> CodeNode:
        """Get existing node or create new one."""
        node_id = self.generate_node_id(path)
        if node_id in self.nodes:
            return self.nodes[node_id]
        return CodeNode(
            id=node_id,
            path=path,
            name=Path(path).name or path,
            type=node_type,
            language='',
            loc=0,
        )

    def add_node(self, node: CodeNode):
        """Add a node to the graph."""
        self.nodes[node.id] = node
        self.invalidate_fingerprint()

    def remove_node(self, node_id: str) -> bool:
        """Remove a node and its edges."""
        if node_id not in self.nodes:
            return False
        # Remove connected edges
        edges_to_remove = [eid for eid, e in self.edges.items() if e.source == node_id or e.target == node_id]
        for eid in edges_to_remove:
            del self.edges[eid]
        del self.nodes[node_id]
        self.invalidate_fingerprint()
        return True

    def add_edge(self, edge: CodeEdge):
        """Add an edge to the graph."""
        self.edges[edge.id] = edge
        self.invalidate_fingerprint()

    def remove_edge(self, edge_id: str) -> bool:
        """Remove an edge."""
        if edge_id in self.edges:
            del self.edges[edge_id]
            self.invalidate_fingerprint()
            return True
        return False

    def apply_delta(self, delta: GraphDelta) -> str:
        """Apply a delta and return new fingerprint."""
        for node in delta.added_nodes:
            self.add_node(node)
        for node_id in delta.removed_node_ids:
            self.remove_node(node_id)
        for node in delta.updated_nodes:
            if node.id in self.nodes:
                self.nodes[node.id] = node
                self.invalidate_fingerprint()
        for edge in delta.added_edges:
            self.add_edge(edge)
        for edge_id in delta.removed_edge_ids:
            self.remove_edge(edge_id)
        for edge in delta.updated_edges:
            if edge.id in self.edges:
                self.edges[edge.id] = edge
                self.invalidate_fingerprint()
        return self.fingerprint

    def to_dict(self) -> dict:
        """Serialize full graph for snapshot."""
        return {
            'nodes': {nid: node.to_dict() for nid, node in self.nodes.items()},
            'edges': {eid: edge.to_dict() for eid, edge in self.edges.items()},
            'fingerprint': self.fingerprint,
        }

    def on_delta(self, callback: callable):
        """Register a callback for delta broadcasts."""
        self._delta_callbacks.append(callback)

    async def broadcast_delta(self, delta: GraphDelta):
        """Call all registered delta callbacks."""
        for callback in self._delta_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(delta)
                else:
                    callback(delta)
            except Exception as e:
                print(f"Error in delta callback: {e}", file=sys.stderr)

    async def scan_repo(self) -> GraphDelta:
        """Scan the repository and build/update the graph."""
        delta = GraphDelta()
        new_nodes: dict[str, CodeNode] = {}

        # Walk the repo
        for file_path in self.repo_root.rglob('*'):
            if not file_path.is_file():
                continue
            if should_exclude(file_path):
                continue

            # Get relative path
            try:
                rel_path = file_path.relative_to(self.repo_root)
            except ValueError:
                continue
            rel_path_str = str(rel_path).replace('\\', '/')

            # Get mtime
            try:
                mtime = file_path.stat().st_mtime
            except OSError:
                continue

            # Check if node exists and is unchanged
            node_id = self.generate_node_id(rel_path_str)
            existing_node = self.nodes.get(node_id)
            # Use 1 second threshold for filesystem timestamp granularity
            if existing_node and abs(existing_node.mtime - mtime) < 1.0:
                # Unchanged, keep existing
                new_nodes[node_id] = existing_node
                continue

            # Create/update node
            language = get_language(file_path)
            loc = count_loc(file_path) if language != 'text' else 0

            # Extract imports/exports (with size limit to prevent unbounded memory)
            imports = []
            exports = []
            MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
            try:
                file_size = file_path.stat().st_size
                if file_size <= MAX_FILE_SIZE:
                    content = file_path.read_text(encoding='utf-8', errors='ignore')
                    if language in ('typescript', 'javascript'):
                        imports, exports = extract_ts_imports_exports(content)
                    elif language == 'python':
                        imports, exports = extract_py_imports_exports(file_path)
            except Exception:
                pass

            # Calculate depth
            depth = len(rel_path.parts) - 1

            # Determine parent
            parent = None
            if depth > 0:
                parent_path = str(rel_path.parent).replace('\\', '/')
                parent = self.generate_node_id(parent_path)

            node = CodeNode(
                id=node_id,
                path=rel_path_str,
                name=rel_path.name,
                type='file',
                language=language,
                loc=loc,
                imports=imports,
                exports=exports,
                mtime=mtime,
                depth=depth,
                parent=parent,
            )
            new_nodes[node_id] = node

        # Build directory nodes (hierarchy)
        all_paths = set()
        for node in new_nodes.values():
            path = node.path
            parts = path.split('/')
            for i in range(len(parts)):
                dir_path = '/'.join(parts[:i+1])
                all_paths.add(dir_path)

        for dir_path in sorted(all_paths):
            if dir_path == '':
                continue
            node_id = self.generate_node_id(dir_path)
            depth = len(dir_path.split('/')) - 1
            parent = None
            if depth > 0:
                parent_path = str(Path(dir_path).parent).replace('\\', '/')
                parent = self.generate_node_id(parent_path)

            # Check if this is actually a file (from new_nodes)
            is_file = any(n.path == dir_path for n in new_nodes.values())

            if is_file:
                continue  # Already created as file node

            existing_node = self.nodes.get(node_id)
            if existing_node and existing_node.type == 'dir':
                # Update existing directory node
                existing_node.parent = parent
                existing_node.depth = depth
                new_nodes[node_id] = existing_node
            else:
                node = CodeNode(
                    id=node_id,
                    path=dir_path,
                    name=Path(dir_path).name,
                    type='dir',
                    language='',
                    loc=0,
                    mtime=0,
                    depth=depth,
                    parent=parent,
                )
                new_nodes[node_id] = node

        # Build hierarchy (children lists)
        children_map: dict[str, list[str]] = {}
        for node in new_nodes.values():
            if node.parent:
                children_map.setdefault(node.parent, []).append(node.id)
        for node in new_nodes.values():
            node.children = children_map.get(node.id, [])

        # Build hierarchy edges from directory structure (directory -> children)
        # This is already handled by directory node creation above
        # File nodes don't need their own hierarchy edges (would duplicate)
        # Import edges removed for MVP - requires proper module resolution

        # Compute delta
        # Added nodes
        for nid, node in new_nodes.items():
            if nid not in self.nodes:
                delta.added_nodes.append(node)
            elif self.nodes[nid] != node:
                delta.updated_nodes.append(node)

        # Removed nodes
        for nid in self.nodes:
            if nid not in new_nodes:
                delta.removed_node_ids.append(nid)

        # Edges are only hierarchy edges (created during directory node construction)
        # Import edges disabled for MVP
        # No edge delta computation needed for hierarchy edges since they're rebuilt from node.parent

        # Apply delta to self
        self.nodes = new_nodes
        self.invalidate_fingerprint()

        return delta

    async def start_initial_scan(self):
        """Start initial repo scan as background task."""
        if self._scan_task and not self._scan_task.done():
            return
        self._scan_task = asyncio.create_task(self._run_initial_scan())

    async def _run_initial_scan(self):
        """Run initial scan and broadcast snapshot."""
        print("[code_graph] Starting initial repository scan...", file=sys.stderr)
        start = time.time()
        delta = await self.scan_repo()
        elapsed = time.time() - start
        print(f"[code_graph] Initial scan complete in {elapsed:.2f}s: {len(self.nodes)} nodes, {len(self.edges)} edges", file=sys.stderr)
        # Broadcast snapshot via delta callbacks
        await self.broadcast_delta(delta)

    async def start_watcher(self):
        """Start filesystem watcher for external changes."""
        if not WATCHFILES_AVAILABLE:
            print("[code_graph] watchfiles not available, skipping filesystem watcher", file=sys.stderr)
            return

        if self._watcher_task and not self._watcher_task.done():
            return

        async def watch_loop():
            print("[code_graph] Starting filesystem watcher...", file=sys.stderr)
            try:
                async for changes in watchfiles.awatch(
                    str(self.repo_root),
                    watch_filter=watchfiles.DefaultFilter(),
                    debounce=250,
                ):
                    # Filter out excluded paths
                    relevant_changes = []
                    for change_type, path in changes:
                        p = Path(path)
                        if should_exclude(p):
                            continue
                        relevant_changes.append((change_type, path))

                    if not relevant_changes:
                        continue

                    print(f"[code_graph] Detected {len(relevant_changes)} relevant changes", file=sys.stderr)
                    # Re-scan and broadcast delta
                    delta = await self.scan_repo()
                    if delta.has_changes():
                        await self.broadcast_delta(delta)
            except Exception as e:
                print(f"[code_graph] Watcher error: {e}", file=sys.stderr)

        self._watcher_task = asyncio.create_task(watch_loop())

    def stop_watcher(self):
        """Stop the filesystem watcher."""
        if self._watcher_task:
            self._watcher_task.cancel()
            self._watcher_task = None

    async def shutdown(self):
        """Shutdown all background tasks."""
        self.stop_watcher()
        if self._scan_task:
            self._scan_task.cancel()
            try:
                await self._scan_task
            except asyncio.CancelledError:
                pass


# Global instance
_code_graph: CodeGraph | None = None


def get_code_graph() -> CodeGraph:
    """Get or create the global CodeGraph instance."""
    global _code_graph
    if _code_graph is None:
        _code_graph = CodeGraph()
    return _code_graph


async def initialize_code_graph():
    """Initialize the code graph (start scan and watcher)."""
    graph = get_code_graph()
    await graph.start_initial_scan()
    await graph.start_watcher()


async def shutdown_code_graph():
    """Shutdown the code graph."""
    graph = get_code_graph()
    await graph.shutdown()


if __name__ == '__main__':
    # CLI test
    async def test():
        graph = CodeGraph()
        delta = await graph.scan_repo()
        print(f"Nodes: {len(graph.nodes)}")
        print(f"Edges: {len(graph.edges)}")
        print(f"Fingerprint: {graph.fingerprint}")
        print(f"Delta: {delta.to_dict()}")

    asyncio.run(test())