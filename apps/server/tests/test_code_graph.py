#!/usr/bin/env python3
"""Tests for code_graph.py"""

import asyncio
import json
import tempfile
import time
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest

from code_graph import (
    CodeGraph,
    CodeNode,
    CodeEdge,
    GraphDelta,
    should_exclude,
    get_language,
    count_loc,
    extract_ts_imports_exports,
    extract_py_imports_exports,
)


class TestHelpers:
    """Tests for helper functions."""

    def test_should_exclude_git_dir(self):
        assert should_exclude(Path('.git/config'))
        assert should_exclude(Path('src/.git/ignore'))

    def test_should_exclude_node_modules(self):
        assert should_exclude(Path('node_modules/package/index.js'))
        assert should_exclude(Path('src/node_modules/test.js'))

    def test_should_exclude_pycache(self):
        assert should_exclude(Path('__pycache__/module.cpython-310.pyc'))
        assert should_exclude(Path('src/__pycache__/test.pyc'))

    def test_should_exclude_var(self):
        assert should_exclude(Path('var/events.db'))
        assert should_exclude(Path('src/var/log.txt'))

    def test_should_exclude_env_files(self):
        assert should_exclude(Path('.env'))
        assert should_exclude(Path('.env.local'))
        assert should_exclude(Path('src/.env.production'))

    def test_should_not_exclude_normal_files(self):
        assert not should_exclude(Path('src/main.py'))
        assert not should_exclude(Path('apps/server/server.py'))
        assert not should_exclude(Path('docs/diagrams/system-overview.md'))

    def test_get_language(self):
        assert get_language(Path('test.py')) == 'python'
        assert get_language(Path('test.ts')) == 'typescript'
        assert get_language(Path('test.tsx')) == 'typescript'
        assert get_language(Path('test.js')) == 'javascript'
        assert get_language(Path('test.jsx')) == 'javascript'
        assert get_language(Path('test.json')) == 'json'
        assert get_language(Path('test.md')) == 'markdown'
        assert get_language(Path('test.yaml')) == 'yaml'
        assert get_language(Path('test.yml')) == 'yaml'
        assert get_language(Path('test.unknown')) == 'text'

    def test_count_loc_python(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write("""# Comment
def hello():
    '''Docstring'''
    return 42  # inline comment

class Test:
    pass

# Another comment
""")
            f.flush()
            assert count_loc(Path(f.name)) == 4  # def, return, class, pass (empty lines/comments excluded)

    def test_count_loc_typescript(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as f:
            f.write("""// Comment
import { foo } from 'bar';

export function hello(): number {
    /* block comment */
    return 42;
}

export const CONST = 'value';
""")
            f.flush()
            assert count_loc(Path(f.name)) == 5

    def test_extract_ts_imports_exports(self):
        content = """
import { foo } from 'bar';
import baz from './baz';
import './side-effect';
export function hello() {}
export const WORLD = 1;
export { something } from 'other';
export { a, b, c };
"""
        imports, exports = extract_ts_imports_exports(content)
        assert 'bar' in imports
        assert './baz' in imports
        assert './side-effect' in imports
        assert 'hello' in exports
        assert 'WORLD' in exports
        assert 'something' in exports
        assert 'a' in exports
        assert 'b' in exports
        assert 'c' in exports

    def test_extract_py_imports_exports(self):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write("""
import os
from pathlib import Path
from typing import List, Dict

def public_function():
    pass

def _private_function():
    pass

class PublicClass:
    pass

class _PrivateClass:
    pass

CONSTANT = 42
""")
            f.flush()
            imports, exports = extract_py_imports_exports(Path(f.name))
            assert 'os' in imports
            assert 'pathlib.Path' in imports
            assert 'typing.List' in imports
            assert 'typing.Dict' in imports
            assert 'public_function' in exports
            assert '_private_function' not in exports
            assert 'PublicClass' in exports
            assert '_PrivateClass' not in exports
            assert 'CONSTANT' in exports


class TestCodeNode:
    """Tests for CodeNode."""

    def test_to_dict(self):
        node = CodeNode(
            id='abc123',
            path='src/main.py',
            name='main.py',
            type='file',
            language='python',
            loc=100,
            imports=['os', 'sys'],
            exports=['main'],
            mtime=time.time(),
            depth=1,
            parent='src',
            children=[],
            agent_activity=[{'agent_name': 'test-agent', 'event_type': 'write', 'timestamp': time.time()}],
        )
        d = node.to_dict()
        assert d['id'] == 'abc123'
        assert d['path'] == 'src/main.py'
        assert d['agent_activity'][0]['agent_name'] == 'test-agent'

    def test_from_dict(self):
        data = {
            'id': 'abc123',
            'path': 'src/main.py',
            'name': 'main.py',
            'type': 'file',
            'language': 'python',
            'loc': 100,
            'imports': ['os'],
            'exports': ['main'],
            'mtime': 1234567890.0,
            'depth': 1,
            'parent': 'src',
            'children': [],
            'agent_activity': [],
        }
        node = CodeNode.from_dict(data)
        assert node.id == 'abc123'
        assert node.path == 'src/main.py'


class TestCodeEdge:
    """Tests for CodeEdge."""

    def test_to_dict(self):
        edge = CodeEdge(
            id='edge1',
            source='node1',
            target='node2',
            type='import',
            label='os',
        )
        d = edge.to_dict()
        assert d['source'] == 'node1'
        assert d['type'] == 'import'

    def test_from_dict(self):
        data = {'id': 'edge1', 'source': 'node1', 'target': 'node2', 'type': 'import', 'label': 'os'}
        edge = CodeEdge.from_dict(data)
        assert edge.source == 'node1'


class TestGraphDelta:
    """Tests for GraphDelta."""

    def test_has_changes_empty(self):
        delta = GraphDelta()
        assert not delta.has_changes()

    def test_has_changes_added_node(self):
        node = CodeNode(id='n1', path='a.py', name='a.py', type='file', language='python', loc=10)
        delta = GraphDelta(added_nodes=[node])
        assert delta.has_changes()

    def test_has_changes_removed_node(self):
        delta = GraphDelta(removed_node_ids=['n1'])
        assert delta.has_changes()

    def test_to_dict(self):
        node = CodeNode(id='n1', path='a.py', name='a.py', type='file', language='python', loc=10)
        edge = CodeEdge(id='e1', source='n1', target='n2', type='import', label='foo')
        delta = GraphDelta(
            added_nodes=[node],
            removed_node_ids=['n2'],
            updated_nodes=[node],
            added_edges=[edge],
            removed_edge_ids=['e2'],
            updated_edges=[edge],
            timestamp=1234567890.0,
        )
        d = delta.to_dict()
        assert len(d['added_nodes']) == 1
        assert d['removed_node_ids'] == ['n2']
        assert len(d['added_edges']) == 1
        assert d['timestamp'] == 1234567890.0


class TestCodeGraph:
    """Tests for CodeGraph."""

    def test_generate_node_id_deterministic(self):
        graph = CodeGraph()
        id1 = graph.generate_node_id('src/main.py')
        id2 = graph.generate_node_id('src/main.py')
        assert id1 == id2
        assert len(id1) == 16  # SHA-256 truncated to 16 chars

    def test_add_remove_node(self):
        graph = CodeGraph()
        node = CodeNode(id='n1', path='a.py', name='a.py', type='file', language='python', loc=10)
        graph.add_node(node)
        assert 'n1' in graph.nodes
        assert graph.remove_node('n1')
        assert 'n1' not in graph.nodes
        assert not graph.remove_node('n1')  # already removed

    def test_add_remove_edge(self):
        graph = CodeGraph()
        edge = CodeEdge(id='e1', source='n1', target='n2', type='import', label='foo')
        graph.add_edge(edge)
        assert 'e1' in graph.edges
        assert graph.remove_edge('e1')
        assert 'e1' not in graph.edges
        assert not graph.remove_edge('e1')

    def test_apply_delta(self):
        graph = CodeGraph()
        node1 = CodeNode(id='n1', path='a.py', name='a.py', type='file', language='python', loc=10)
        node2 = CodeNode(id='n2', path='b.py', name='b.py', type='file', language='python', loc=20)
        edge = CodeEdge(id='e1', source='n1', target='n2', type='import', label='foo')

        delta = GraphDelta(added_nodes=[node1, node2], added_edges=[edge])
        fp = graph.apply_delta(delta)

        assert 'n1' in graph.nodes
        assert 'n2' in graph.nodes
        assert 'e1' in graph.edges
        assert fp == graph.fingerprint

    def test_fingerprint_deterministic(self):
        """Same graph structure should produce same fingerprint."""
        graph1 = CodeGraph()
        node1 = CodeNode(id='n1', path='a.py', name='a.py', type='file', language='python', loc=10)
        node2 = CodeNode(id='n2', path='b.py', name='b.py', type='file', language='python', loc=20)
        graph1.add_node(node1)
        graph1.add_node(node2)

        graph2 = CodeGraph()
        graph2.add_node(node1)
        graph2.add_node(node2)

        assert graph1.fingerprint == graph2.fingerprint

    def test_fingerprint_changes_on_mutation(self):
        graph = CodeGraph()
        node1 = CodeNode(id='n1', path='a.py', name='a.py', type='file', language='python', loc=10)
        graph.add_node(node1)
        fp1 = graph.fingerprint

        node2 = CodeNode(id='n2', path='b.py', name='b.py', type='file', language='python', loc=20)
        graph.add_node(node2)
        fp2 = graph.fingerprint

        assert fp1 != fp2

    def test_to_dict(self):
        graph = CodeGraph()
        node = CodeNode(id='n1', path='a.py', name='a.py', type='file', language='python', loc=10)
        graph.add_node(node)
        d = graph.to_dict()
        assert 'nodes' in d
        assert 'edges' in d
        assert 'fingerprint' in d
        assert 'n1' in d['nodes']

    @pytest.mark.asyncio
    async def test_scan_repo_basic(self):
        """Test scanning a small test fixture."""
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)
            # Create test structure
            (tmpdir / 'src').mkdir()
            (tmpdir / 'src' / 'main.py').write_text('def main():\n    return 42\n')
            (tmpdir / 'src' / 'utils.py').write_text('import os\n\ndef helper():\n    return os.getcwd()\n')
            (tmpdir / 'README.md').write_text('# Test\n')

            graph = CodeGraph(repo_root=tmpdir)
            delta = await graph.scan_repo()

            # Should find 2 Python files + 1 markdown + 1 dir
            assert len(graph.nodes) >= 4
            assert len(delta.added_nodes) >= 4
            assert graph.fingerprint

    @pytest.mark.asyncio
    async def test_apply_delta_add_file(self):
        """Test incremental add updates fingerprint."""
        graph = CodeGraph()
        fp1 = graph.fingerprint

        node = CodeNode(id='n1', path='new.py', name='new.py', type='file', language='python', loc=10)
        delta = GraphDelta(added_nodes=[node])
        graph.apply_delta(delta)

        fp2 = graph.fingerprint
        assert fp1 != fp2
        assert 'n1' in graph.nodes

    @pytest.mark.asyncio
    async def test_apply_delta_remove_file(self):
        """Test incremental remove updates fingerprint."""
        graph = CodeGraph()
        node = CodeNode(id='n1', path='a.py', name='a.py', type='file', language='python', loc=10)
        graph.add_node(node)
        fp1 = graph.fingerprint

        delta = GraphDelta(removed_node_ids=['n1'])
        graph.apply_delta(delta)

        fp2 = graph.fingerprint
        assert fp1 != fp2
        assert 'n1' not in graph.nodes


if __name__ == '__main__':
    pytest.main([__file__, '-v'])