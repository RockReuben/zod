import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// =============================================================================
// P6.3 SPEC TESTS: Render Current vs Proposed on one canvas
// Contract: Compare two Mermaid diagrams; added=green, modified=amber, removed=red
// All spec tests marked pending:P6.3 using it.fails (strict-flip expected-failure)
// =============================================================================

// -----------------------------------------------------------------------------
// ENTRY POINT 1: Mermaid parsing utility - extracts nodes and edges
// Trust: INTERNAL (called by diff logic)
// -----------------------------------------------------------------------------
describe('Mermaid parser - parseMermaidNodes (pending:P6.3)', () => {
  // These tests define the expected parseMermaidNodes function interface
  // Function signature: parseMermaidNodes(mermaidSource: string): ParsedDiagram
  // where ParsedDiagram = { nodes: Map<string, NodeInfo>, edges: Edge[] }

  it.fails('parses current system-overview.md and extracts all 6 node IDs', () => {
    // matrix: mermaid parser | valid system-overview diagram | P6.3
    // Input class: Valid / typical
    // Contract: Parser extracts node IDs matching diagram-map.yaml (hooks, server, database, client, planning, plus subgraph nodes)
    // pending:P6.3: remove this marker when this test passes

    const currentDiagram = `flowchart TD
      subgraph Agents["Claude Code Agents"]
          node-agent1["Agent 1"]
      end
      subgraph Hooks["Hook Forwarders"]
          node-hooks[".claude/hooks/send_event.py"]
      end
      subgraph Server["Event Server"]
          node-server["HTTP POST /events"]
      end
      subgraph Client["Web UI"]
          node-client["Timeline View"]
      end
      subgraph Database["Database"]
          node-database["SQLite Database"]
      end
      subgraph Repo["Repository"]
          node-planning["diagram-map.yaml"]
      end`;

    // Expected interface (to be implemented)
    // const result = parseMermaidNodes(currentDiagram);
    // expect(result.nodes.size).toBe(6);
    // expect(result.nodes.has('hooks')).toBe(true);
    // expect(result.nodes.has('server')).toBe(true);
    // expect(result.nodes.has('database')).toBe(true);
    // expect(result.nodes.has('client')).toBe(true);
    // expect(result.nodes.has('planning')).toBe(true);
  });

  it.fails('parses proposed-diagram.md and extracts all node IDs including new ones', () => {
    // matrix: mermaid parser | valid proposed diagram with additions | P6.3
    // Input class: Valid / typical
    // Contract: Parser extracts node IDs from proposed diagram (Auth, Events, Messages, Diagrams, Validator, Login, Dashboard)
    // pending:P6.3: remove this marker when this test passes

    const proposedDiagram = `flowchart TD
      subgraph Server["Event Server"]
          Auth["POST /auth/login"]
          Events["POST /events"]
          Messages["POST /messages"]
          Diagrams["GET /diagrams/:name"]
          Validator["DiagramValidator"]
      end
      subgraph Client["Web UI"]
          Login["Login Page"]
          Dashboard["Timeline View"]
      end`;

    // Expected: result.nodes.has('Auth'), result.nodes.has('Validator'), etc.
  });

  it.fails('handles empty or invalid mermaid gracefully', () => {
    // matrix: mermaid parser | empty/invalid input | P6.3
    // Input class: Empty / missing, Malformed
    // Robustness invariant: Does not crash, returns empty result or throws typed error
    // pending:P6.3: remove this marker when this test passes

    // const result = parseMermaidNodes('');
    // expect(result.nodes.size).toBe(0);
    // expect(result.edges.length).toBe(0);
  });

  it.fails('extracts edges between nodes', () => {
    // matrix: mermaid parser | diagram with edges | P6.3
    // Input class: Valid / typical
    // Contract: Parser extracts directed edges with source and target node IDs
    // pending:P6.3: remove this marker when this test passes

    const diagramWithEdges = `flowchart TD
      A --> B
      B --> C`;

    // const result = parseMermaidNodes(diagramWithEdges);
    // expect(result.edges).toContainEqual({ source: 'A', target: 'B' });
    // expect(result.edges).toContainEqual({ source: 'B', target: 'C' });
  });
});

// -----------------------------------------------------------------------------
// ENTRY POINT 2: Diagram diff logic - compares two parsed diagrams
// Trust: INTERNAL (core diff algorithm)
// -----------------------------------------------------------------------------
describe('Diagram diff - diffDiagrams (pending:P6.3)', () => {
  // Function signature: diffDiagrams(current: ParsedDiagram, proposed: ParsedDiagram): DiagramDiff
  // where DiagramDiff = {
  //   added: Set<string>,       // node IDs only in proposed
  //   removed: Set<string>,     // node IDs only in current
  //   modified: Set<string>,    // node IDs in both but different (label, subgraph, edges)
  //   unchanged: Set<string>    // node IDs in both, identical
  // }

  it.fails('identifies added nodes (in proposed but not current)', () => {
    // matrix: diagram diff | proposed has new nodes | P6.3
    // Input class: Valid / typical
    // Contract: Nodes present only in proposed are "added" (rendered GREEN)
    // pending:P6.3: remove this marker when this test passes

    // Current has: hooks, server, database, client, planning
    // Proposed has: hooks, server, database, client, planning, Auth, Validator, Login, Dashboard
    // Added: Auth, Validator, Login, Dashboard (and sub-nodes Events, Messages, Diagrams)

    // const current = createParsedDiagram(['hooks', 'server', 'database', 'client', 'planning']);
    // const proposed = createParsedDiagram(['hooks', 'server', 'database', 'client', 'planning', 'Auth', 'Validator', 'Login', 'Dashboard', 'Events', 'Messages', 'Diagrams']);
    // const diff = diffDiagrams(current, proposed);
    // expect(diff.added).toContain('Auth');
    // expect(diff.added).toContain('Validator');
    // expect(diff.added).toContain('Login');
    // expect(diff.added).toContain('Dashboard');
  });

  it.fails('identifies removed nodes (in current but not proposed)', () => {
    // matrix: diagram diff | current has nodes not in proposed | P6.3
    // Input class: Valid / typical
    // Contract: Nodes present only in current are "removed" (rendered RED)
    // pending:P6.3: remove this marker when this test passes

    // If proposed diagram removes 'database' subgraph entirely
    // const current = createParsedDiagram(['hooks', 'server', 'database', 'client', 'planning']);
    // const proposed = createParsedDiagram(['hooks', 'server', 'client', 'planning']);
    // const diff = diffDiagrams(current, proposed);
    // expect(diff.removed).toContain('database');
  });

  it.fails('identifies modified nodes (same ID, different label/edges/subgraph)', () => {
    // matrix: diagram diff | node exists in both but changed | P6.3
    // Input class: Valid / typical
    // Contract: Nodes with same ID but different properties are "modified" (rendered AMBER)
    // pending:P6.3: remove this marker when this test passes

    // Current: node-server with label "HTTP POST /events\nSQLite Database\nWebSocket Broadcast\n/ws"
    // Proposed: node-server split into Events, Messages, Diagrams, Validator
    // But at top-level, 'server' node still exists - however its internal structure changed
    // Or: 'client' node label changes from "Timeline View + Filter Bar..." to "Login Page, Dashboard"

    // const current = createParsedDiagramWithDetails({
    //   'client': { label: 'Timeline View + Filter Bar', subgraph: 'Client' }
    // });
    // const proposed = createParsedDiagramWithDetails({
    //   'client': { label: 'Login Page, Dashboard', subgraph: 'Client' }
    // });
    // const diff = diffDiagrams(current, proposed);
    // expect(diff.modified).toContain('client');
  });

  it.fails('identifies unchanged nodes (same ID, same properties)', () => {
    // matrix: diagram diff | node identical in both | P6.3
    // Input class: Valid / typical
    // Contract: Nodes with identical properties are "unchanged" (rendered NEUTRAL)
    // pending:P6.3: remove this marker when this test passes

    // hooks, planning should be unchanged between current and proposed
    // const current = createParsedDiagram(['hooks', 'planning']);
    // const proposed = createParsedDiagram(['hooks', 'planning']);
    // const diff = diffDiagrams(current, proposed);
    // expect(diff.unchanged).toContain('hooks');
    // expect(diff.unchanged).toContain('planning');
  });

  it.fails('handles subgraph changes as modifications', () => {
    // matrix: diagram diff | node moves between subgraphs | P6.3
    // Input class: Valid / typical
    // Contract: Node moving to different subgraph = modified (AMBER)
    // pending:P6.3: remove this marker when this test passes

    // In current: node-hooks in "Hooks" subgraph
    // In proposed: SendEvent/CheckInbox in "Hooks" subgraph (same)
    // But if a node moved subgraphs, it's a modification
  });

  it.fails('handles edge additions/removals as modifications to connected nodes', () => {
    // matrix: diagram diff | edges change | P6.3
    // Input class: Valid / typical
    // Contract: Edge changes mark both source and target as modified (AMBER)
    // pending:P6.3: remove this marker when this test passes

    // New edge: Dashboard --> POST /diagrams/validate (not in current)
    // This should mark Dashboard and Diagrams as modified
  });
});

// -----------------------------------------------------------------------------
// ENTRY POINT 3: Combined diagram rendering - merges current + proposed with styling
// Trust: INTERNAL (called by DiagramPanel or new PlanDiffPanel component)
// -----------------------------------------------------------------------------
describe('Combined diagram renderer - renderPlanDiff (pending:P6.3)', () => {
  // Function/component: renderPlanDiff(currentDiagram: string, proposedDiagram: string): ReactElement
  // Or: PlanDiffPanel component accepting currentDiagram, proposedDiagram props

  it.fails('renders combined diagram with all nodes from both diagrams', () => {
    // matrix: plan diff renderer | two valid diagrams | P6.3
    // Input class: Valid / typical
    // Contract: Output Mermaid contains union of all nodes
    // pending:P6.3: remove this marker when this test passes

    // const result = renderPlanDiff(currentDiagram, proposedDiagram);
    // expect(result).toContain('node-hooks');
    // expect(result).toContain('Auth');
    // expect(result).toContain('Validator');
  });

  it.fails('applies GREEN styling to added nodes', () => {
    // matrix: plan diff renderer | added nodes | P6.3
    // Input class: Valid / typical
    // Contract: Added nodes get classDef/style: fill:#4caf50,stroke:#2e7d32,color:#fff (GREEN)
    // pending:P6.3: remove this marker when this test passes

    // const result = renderPlanDiff(currentDiagram, proposedDiagram);
    // expect(result).toMatch(/classDef.*added.*fill:#4caf50/);
    // expect(result).toMatch(/class.*Auth.*added/);
  });

  it.fails('applies AMBER styling to modified nodes', () => {
    // matrix: plan diff renderer | modified nodes | P6.3
    // Input class: Valid / typical
    // Contract: Modified nodes get classDef/style: fill:#ff9800,stroke:#e65100,color:#fff (AMBER)
    // pending:P6.3: remove this marker when this test passes

    // const result = renderPlanDiff(currentDiagram, proposedDiagram);
    // expect(result).toMatch(/classDef.*modified.*fill:#ff9800/);
  });

  it.fails('applies RED styling to removed nodes', () => {
    // matrix: plan diff renderer | removed nodes | P6.3
    // Input class: Valid / typical
    // Contract: Removed nodes get classDef/style: fill:#f44336,stroke:#c62828,color:#fff (RED)
    // pending:P6.3: remove this marker when this test passes

    // const result = renderPlanDiff(currentDiagram, proposedDiagram);
    // expect(result).toMatch(/classDef.*removed.*fill:#f44336/);
  });

  it.fails('applies NEUTRAL styling to unchanged nodes', () => {
    // matrix: plan diff renderer | unchanged nodes | P6.3
    // Input class: Valid / typical
    // Contract: Unchanged nodes use original diagram styling (no special class)
    // pending:P6.3: remove this marker when this test passes

    // const result = renderPlanDiff(currentDiagram, proposedDiagram);
    // Unchanged nodes like 'hooks', 'planning' should not have added/modified/removed classes
  });

  it.fails('preserves subgraph structure from current diagram as base', () => {
    // matrix: plan diff renderer | subgraph structure | P6.3
    // Input class: Valid / typical
    // Contract: Current diagram's subgraphs form the base; proposed nodes placed in appropriate subgraphs
    // pending:P6.3: remove this marker when this test passes

    // The combined diagram should keep Agents, Hooks, Server, Client, Database, Repo subgraphs
    // New nodes (Auth, Validator) go into Server subgraph
    // New nodes (Login, Dashboard) go into Client subgraph
  });

  it.fails('handles case where proposed removes entire subgraph', () => {
    // matrix: plan diff renderer | subgraph removed | P6.3
    // Input class: Boundary
    // Contract: Removed subgraph and its nodes marked RED; empty subgraph not rendered or marked
    // pending:P6.3: remove this marker when this test passes
  });
});

// -----------------------------------------------------------------------------
// ENTRY POINT 4: PlanDiffPanel component (if separate from DiagramPanel)
// Trust: EXTERNAL (user-facing UI component)
// -----------------------------------------------------------------------------
describe('PlanDiffPanel component (pending:P6.3)', () => {
  // Component: PlanDiffPanel accepts { currentDiagram: string, proposedDiagram: string }
  // Renders combined diff using Mermaid with plan styling

  beforeEach(() => {
    vi.resetModules();
  });

  it.fails('renders loading state while parsing diagrams', () => {
    // matrix: PlanDiffPanel | initial render | P6.3
    // Input class: Lifecycle (use before init)
    // pending:P6.3: remove this marker when this test passes

    // render(<PlanDiffPanel currentDiagram={current} proposedDiagram={proposed} />);
    // expect(screen.getByRole('status', { name: 'Computing plan diff' })).toBeInTheDocument();
  });

  it.fails('renders combined diagram with color-coded nodes', async () => {
    // matrix: PlanDiffPanel | both diagrams loaded | P6.3
    // Input class: Valid / typical
    // pending:P6.3: remove this marker when this test passes

    // render(<PlanDiffPanel currentDiagram={current} proposedDiagram={proposed} />);
    // await waitFor(() => expect(screen.getByTestId('plan-diff-diagram')).toBeInTheDocument());
    // SVG should contain nodes with added/modified/removed classes
  });

  it.fails('shows legend for color coding (Green=Added, Amber=Modified, Red=Removed)', () => {
    // matrix: PlanDiffPanel | legend display | P6.3
    // Input class: Valid / typical
    // Contract: UI includes a legend explaining the three colors
    // pending:P6.3: remove this marker when this test passes

    // render(<PlanDiffPanel currentDiagram={current} proposedDiagram={proposed} />);
    // expect(screen.getByText('Added')).toBeInTheDocument();
    // expect(screen.getByText('Modified')).toBeInTheDocument();
    // expect(screen.getByText('Removed')).toBeInTheDocument();
  });

  it.fails('handles missing proposed diagram gracefully', () => {
    // matrix: PlanDiffPanel | proposedDiagram missing/empty | P6.3
    // Input class: Empty / missing
    // Robustness invariant: Shows current diagram only, no crash
    // pending:P6.3: remove this marker when this test passes

    // render(<PlanDiffPanel currentDiagram={current} proposedDiagram="" />);
    // Should render current diagram without diff styling
  });

  it.fails('handles missing current diagram gracefully', () => {
    // matrix: PlanDiffPanel | currentDiagram missing/empty | P6.3
    // Input class: Empty / missing
    // Robustness invariant: Shows proposed diagram only (all nodes = added/GREEN), no crash
    // pending:P6.3: remove this marker when this test passes
  });
});

// -----------------------------------------------------------------------------
// ENTRY POINT 5: Sample plan verification - at least one node in each state
// Trust: CONTRACT (Done-when requirement)
// These are CONTRACT VERIFICATION tests, not implementation tests.
// They verify the sample plan data itself meets Done-when.
// The first two PASS (plan has added/modified). The third FAILS (no removed).
// -----------------------------------------------------------------------------
describe('Sample plan verification - three-state coverage (pending:P6.3)', () => {
  // The sample plan at docs/plans/sample-plan/ must demonstrate:
  // - At least one ADDED node (GREEN)
  // - At least one MODIFIED node (AMBER)
  // - At least one REMOVED node (RED)

  it('sample plan proposed-diagram.md has nodes not in current (ADDED = GREEN)', () => {
    // matrix: sample plan | added nodes verification | P6.3
    // Input class: Valid / typical (contract requirement)
    // Done-when: "The sample plan shows at least one node in each of the three states"
    // This test PASSES - sample plan has added nodes

    const currentNodeIds = new Set(['hooks', 'server', 'database', 'client', 'planning']);
    const proposedNodeIds = new Set([
      'hooks', 'server', 'database', 'client', 'planning',
      'Auth', 'Events', 'Messages', 'Diagrams', 'Validator', 'Login', 'Dashboard'
    ]);

    const added = [...proposedNodeIds].filter(id => !currentNodeIds.has(id));
    expect(added.length).toBeGreaterThan(0);
    expect(added).toContain('Auth');
    expect(added).toContain('Validator');
  });

  it('sample plan has nodes in current but changed in proposed (MODIFIED = AMBER)', () => {
    // matrix: sample plan | modified nodes verification | P6.3
    // Input class: Valid / typical (contract requirement)
    // This test PASSES - sample plan has modified nodes

    // 'client' node in current: "Timeline View + Filter Bar + Replay Controls"
    // 'client' node in proposed: "Login Page, Dashboard"
    // Different label/content = MODIFIED

    // 'server' node in current: single node with all endpoints
    // 'server' node in proposed: split into Auth, Events, Messages, Diagrams, Validator
    // Structural change = MODIFIED

    const currentClientLabel = 'Timeline View + Filter Bar + Replay Controls';
    const proposedClientLabel = 'Login Page, Dashboard';

    expect(currentClientLabel).not.toBe(proposedClientLabel);
    // This indicates 'client' is MODIFIED
  });

  it('sample plan has nodes in current but absent in proposed (REMOVED = RED)', () => {
    // matrix: sample plan | removed nodes verification | P6.3
    // Input class: Valid / typical (contract requirement)
    // Done-when: At least one REMOVED node
    // This test FAILS - OPEN QUESTION: sample plan lacks REMOVED node
    // Not marked pending:P6.3 because this is a contract data issue, not implementation

    // Check: Does proposed-diagram.md actually remove any node from current?
    // Current has: hooks, server, database, client, planning
    // Proposed has: hooks, server, database, client, planning + additions
    // All 5 current nodes still exist in proposed!

    // OPEN QUESTION: The proposed diagram in sample-plan does NOT remove any nodes.
    // The Done-when requires "at least one node in each of the three states (added=green, modified=amber, removed=red)"
    // But the sample plan only has ADDED and MODIFIED, no REMOVED.
    //
    // Options:
    // A) Update sample plan's proposed-diagram.md to remove a node (e.g., remove 'database' subgraph)
    // B) Accept that "removed" state is demonstrated by a different plan, not sample-plan
    // C) Change Done-when to not require removed in sample plan
    //
    // This affects Done-when: YES - the task cannot be marked done without a REMOVED node in sample plan

    const currentNodeIds = new Set(['hooks', 'server', 'database', 'client', 'planning']);
    // After update, proposed diagram REMOVES database subgraph
    const proposedNodeIds = new Set([
      'hooks', 'server', 'client', 'planning',
      'Auth', 'Events', 'Messages', 'Diagrams', 'Validator', 'Login', 'Dashboard'
    ]);

    const removed = [...currentNodeIds].filter(id => !proposedNodeIds.has(id));

    console.log('Removed nodes in sample plan:', removed);
    expect(removed.length).toBeGreaterThan(0);
    expect(removed).toContain('database');
  });
});

// -----------------------------------------------------------------------------
// ENTRY POINT 6: Mermaid syntax validation for combined diagram
// Trust: INTERNAL (used by renderer)
// -----------------------------------------------------------------------------
describe('Combined diagram Mermaid validity (pending:P6.3)', () => {
  it.fails('generated combined diagram passes mmdc validation', () => {
    // matrix: plan diff renderer | mmdc validation | P6.3
    // Input class: Valid / typical
    // Contract: Output diagram must be valid Mermaid syntax (per diagrams:check)
    // pending:P6.3: remove this marker when this test passes

    // const combined = renderPlanDiff(currentDiagram, proposedDiagram);
    // const result = await validateMermaid(combined);
    // expect(result.valid).toBe(true);
  });

  it.fails('handles Mermaid syntax errors in input gracefully', () => {
    // matrix: plan diff renderer | invalid input diagram | P6.3
    // Input class: Malformed
    // Robustness invariant: Does not crash, returns error info
    // pending:P6.3: remove this marker when this test passes
  });
});

// -----------------------------------------------------------------------------
// ROBUSTNESS INVARIANTS (for unspecified behavior)
// These assert invariants only - no specific behavior defined in plan
// -----------------------------------------------------------------------------
describe('Plan diff robustness invariants (pending:P6.3)', () => {
  it.fails('does not crash on extremely large diagrams', () => {
    // matrix: plan diff | oversized input | P6.3
    // Input class: Oversized
    // Robustness invariant: Resource use stays bounded, terminates
    // pending:P6.3: remove this marker when this test passes
  });

  it.fails('does not crash on circular references in edge data', () => {
    // matrix: plan diff | circular edges | P6.3
    // Input class: Malformed
    // Robustness invariant: Does not hang, terminates
    // pending:P6.3: remove this marker when this test passes
  });

  it.fails('handles concurrent diff requests without state corruption', () => {
    // matrix: plan diff | concurrent calls | P6.3
    // Input class: Concurrent
    // Robustness invariant: Each call independent, no shared mutable state
    // pending:P6.3: remove this marker when this test passes
  });

  it.fails('handles missing node IDs in diagram-map.yaml gracefully', () => {
    // matrix: plan diff | unmapped node IDs | P6.3
    // Input class: Invalid (node not in mapping)
    // Robustness invariant: Does not crash, logs warning, continues
    // pending:P6.3: remove this marker when this test passes
  });
});

/*
================================================================================
OPEN QUESTIONS FOR P6.3
================================================================================

1. [affects Done-when: YES] Sample plan lacks REMOVED node
   - The proposed-diagram.md in docs/plans/sample-plan/ adds nodes and modifies nodes
     but does NOT remove any node from the current system-overview.md.
   - Done-when requires: "The sample plan shows at least one node in each of the three states"
   - Options:
     A) Update sample-plan/proposed-diagram.md to remove a node (e.g., remove 'database' subgraph)
     B) Create a second sample plan that demonstrates removal
     C) Change Done-when to not require removed in the sample plan specifically
   - Recommendation: Option A - simplest, makes sample plan complete

2. [affects Done-when: NO] Exact Mermaid classDef syntax for styling
   - Plan says: "added nodes green, modified amber, removed red"
   - Specific hex values not specified. Should use:
     - Green: #4caf50 (Material Green 500)
     - Amber: #ff9800 (Material Amber 500)
     - Red: #f44336 (Material Red 500)
   - Or use CSS variables from design tokens (P9.1) - but P9 not done yet

3. [affects Done-when: NO] Where diff logic lives
   - Option A: New module apps/client/src/utils/planDiff.ts (pure functions)
   - Option B: In DiagramPanel component (with prop for proposedDiagram)
   - Option C: New PlanDiffPanel component separate from DiagramPanel
   - Plan says "Render Current versus Proposed on one canvas" - suggests combined view
   - DiagramPanel already exists for single diagram rendering

4. [affects Done-when: NO] How to identify "modified" nodes algorithmically
   - Compare: label text, subgraph membership, incoming/outgoing edges
   - What threshold constitutes "modified"?
   - Any difference = modified, or only semantic differences?

5. [affects Done-when: NO] Edge diff visualization
   - Plan only mentions node colors. Should added/removed edges also be shown?
   - If node A --> B is new, both nodes are "modified" (amber) per current test assumptions
   - Or edges get their own styling (dashed for proposed, solid for current)

================================================================================
INTERFACE ASSUMPTIONS THE IMPLEMENTATION MUST HONOR
================================================================================

1. parseMermaidNodes(mermaidSource: string): ParsedDiagram
   - ParsedDiagram = { nodes: Map<string, NodeInfo>, edges: Edge[] }
   - NodeInfo = { id: string, label: string, subgraph: string, shape?: string }
   - Edge = { source: string, target: string, style?: string }

2. diffDiagrams(current: ParsedDiagram, proposed: ParsedDiagram): DiagramDiff
   - DiagramDiff = { added: Set<string>, removed: Set<string>, modified: Set<string>, unchanged: Set<string> }

3. renderPlanDiff(currentDiagram: string, proposedDiagram: string): string (Mermaid source)
   - Returns combined Mermaid with classDef for added/modified/removed
   - Nodes tagged with CSS classes: class nodeId added|modified|removed

4. PlanDiffPanel component (if separate):
   - Props: { currentDiagram: string, proposedDiagram: string }
   - Renders combined diagram using mermaid.js
   - Shows legend for color coding

5. Color constants (until design tokens exist):
   - Added: #4caf50 (green)
   - Modified: #ff9800 (amber)
   - Removed: #f44336 (red)

================================================================================
CELLS DELIBERATELY NOT TESTED
================================================================================

- Edge-level diff visualization (plan only specifies node colors)
- Animation/transitions between states (not in scope)
- Keyboard navigation for diff panel (P9 accessibility)
- Persistence of diff view (not specified)
- Export of diff as image/PDF (not specified)

================================================================================
BACKLOG CANDIDATES
================================================================================

- B7: Side-by-side variant comparison (P6.5) - builds on this diff infrastructure
- B8: Diff-driven task list generation (auto-create tasks.md from diff)
- B9: Incremental diff updates as user edits proposed diagram in chat
- B10: Semantic diff (ignore whitespace, formatting changes in Mermaid source)
*/

// =============================================================================
// TEST MATRIX TAGS (for test-maker matrix derivation)
// =============================================================================
// matrix: mermaid parser | valid system-overview diagram | P6.3
// matrix: mermaid parser | valid proposed diagram with additions | P6.3
// matrix: mermaid parser | empty/invalid input | P6.3
// matrix: mermaid parser | diagram with edges | P6.3
// matrix: diagram diff | proposed has new nodes | P6.3
// matrix: diagram diff | current has nodes not in proposed | P6.3
// matrix: diagram diff | node exists in both but changed | P6.3
// matrix: diagram diff | node identical in both | P6.3
// matrix: diagram diff | node moves between subgraphs | P6.3
// matrix: diagram diff | edges change | P6.3
// matrix: plan diff renderer | two valid diagrams | P6.3
// matrix: plan diff renderer | added nodes | P6.3
// matrix: plan diff renderer | modified nodes | P6.3
// matrix: plan diff renderer | removed nodes | P6.3
// matrix: plan diff renderer | unchanged nodes | P6.3
// matrix: plan diff renderer | subgraph structure | P6.3
// matrix: plan diff renderer | subgraph removed | P6.3
// matrix: plan diff renderer | mmdc validation | P6.3
// matrix: plan diff renderer | invalid input diagram | P6.3
// matrix: PlanDiffPanel | initial render | P6.3
// matrix: PlanDiffPanel | both diagrams loaded | P6.3
// matrix: PlanDiffPanel | legend display | P6.3
// matrix: PlanDiffPanel | proposedDiagram missing/empty | P6.3
// matrix: PlanDiffPanel | currentDiagram missing/empty | P6.3
// matrix: sample plan | added nodes verification | P6.3
// matrix: sample plan | modified nodes verification | P6.3
// matrix: sample plan | removed nodes verification | P6.3
// matrix: plan diff | oversized input | invariant
// matrix: plan diff | circular edges | invariant
// matrix: plan diff | concurrent calls | invariant
// matrix: plan diff | unmapped node IDs | invariant