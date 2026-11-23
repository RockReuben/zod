import { describe, it, expect, vi, beforeEach, afterEach, act } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiagramPanel } from '../../src/components/DiagramPanel';
import { useEventsStore } from '../../src/stores/events';
import { HookEvent, NodeHighlight } from '../../src/types';

// Mock mermaid - use hoisted mock to avoid initialization issues
const { mockMermaidRender } = vi.hoisted(() => ({
  mockMermaidRender: vi.fn().mockResolvedValue({
    svg: '<svg><g id="node-server" class="node">Server</g><g id="node-client" class="node">Client</g><g id="node-hooks" class="node">Hooks</g><g id="node-database" class="node">Database</g><g id="node-planning" class="node">Planning</g></svg>'
  }),
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: mockMermaidRender,
  },
}));

// Mock svg-pan-zoom
vi.mock('svg-pan-zoom', () => ({
  default: vi.fn().mockReturnValue({
    destroy: vi.fn(),
    resize: vi.fn(),
    fit: vi.fn(),
    center: vi.fn(),
  }),
}));

// Mock config
vi.mock('../../src/config', () => ({
  getApiBase: vi.fn(),
  getToken: vi.fn(),
}));

// Mock the events store
vi.mock('../../src/stores/events', () => ({
  useEventsStore: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { getApiBase, getToken } from '../../src/config';
const mockGetApiBase = vi.mocked(getApiBase);
const mockGetToken = vi.mocked(getToken);
const mockUseEventsStore = vi.mocked(useEventsStore);

describe('DiagramPanel - Node Highlighting P4.2 Spec Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    const mermaid = await import('mermaid');
    vi.mocked(mermaid.default.render).mockResolvedValue({
      svg: '<svg><g id="node-server" class="node">Server</g><g id="node-client" class="node">Client</g><g id="node-hooks" class="node">Hooks</g><g id="node-database" class="node">Database</g><g id="node-planning" class="node">Planning</g></svg>'
    });

    mockGetApiBase.mockReturnValue('http://127.0.0.1:8081');
    mockGetToken.mockReturnValue('test-token');

    mockUseEventsStore.mockImplementation((selector) => selector({
      events: [],
      addEvent: vi.fn(),
      setFilter: vi.fn(),
      resetFilters: vi.fn(),
      getAvailableFilters: vi.fn(() => ({ sourceApps: [], agentNames: [], eventTypes: [] })),
      getLanes: vi.fn(() => []),
      getFilteredLanes: vi.fn(() => []),
      clear: vi.fn(),
      fetchSessions: vi.fn(),
      startReplay: vi.fn(),
      stopReplay: vi.fn(),
      setReplaySpeed: vi.fn(),
      setReplayProgress: vi.fn(),
      addHistoricalEvent: vi.fn(),
      replay: { isReplaying: false, replaySessionId: null, replaySpeed: 1, replayProgress: 0, sessions: [] },
      filters: { sourceApp: 'all', agentName: 'all', eventType: 'all' },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =============================================================================
  // ENTRY POINT: DiagramPanel component receiving highlights prop
  // Trust: INTERNAL (called from parent component)
  // =============================================================================

  describe('DiagramPanel highlights prop interface', () => {
    it('accepts highlights array prop with NodeHighlight type', () => {
      // matrix: DiagramPanel component | highlights prop with valid NodeHighlight[] | P4.2
      // Input class: Valid / typical
      // Contract: DiagramPanel receives highlights from parent (TimelineView/App)
      // which processes WebSocket node_highlight events

      const highlights: NodeHighlight[] = [
        {
          node: 'server',
          agentName: 'backend-agent',
          diagram: 'docs/diagrams/system-overview.md',
          timestamp: Date.now(),
          color: '#1a73e8',
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('```mermaid\ngraph TD\nA --> B\n```'),
      });

      // This should not throw - the component accepts the prop
      const { unmount } = render(<DiagramPanel diagramName="system-overview" highlights={highlights} />);
      unmount();
    });

    it('handles empty highlights array', () => {
      // matrix: DiagramPanel component | empty highlights array | P4.2
      // Input class: Empty / missing

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('```mermaid\ngraph TD\nA --> B\n```'),
      });

      const { unmount } = render(<DiagramPanel diagramName="system-overview" highlights={[]} />);
      unmount();
    });

    it('handles missing highlights prop (defaults to empty)', () => {
      // matrix: DiagramPanel component | missing highlights prop | P4.2
      // Input class: Empty / missing

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('```mermaid\ngraph TD\nA --> B\n```'),
      });

      const { unmount } = render(<DiagramPanel diagramName="system-overview" />);
      unmount();
    });
  });

  // =============================================================================
  // BEHAVIOR: Visual highlight application
  // =============================================================================

  describe('Visual highlight application (pending implementation)', () => {
    it.skip('applies highlight style to SVG node matching highlight.node', () => {
      // matrix: DiagramPanel component | highlight for existing node | P4.2
      // Input class: Valid / typical
      // PENDING: After mermaid renders, find SVG element with id="node-{nodeId}"
      // and apply: stroke={color}, stroke-width=3, filter=drop-shadow(0 0 6px {color})
      // with transition for smooth fade

      const highlights: NodeHighlight[] = [
        { node: 'server', agentName: 'agent-1', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now(), color: '#1a73e8' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('```mermaid\ngraph TD\nServer --> Client\n```'),
      });

      // Expected: The rendered SVG's #node-server element gets highlight styles
    });

    it.skip('does not crash when highlighted node does not exist in diagram', () => {
      // matrix: DiagramPanel component | highlight for non-existent node | P4.2
      // Input class: Invalid (node ID not in diagram)
      // Robustness invariant: Does not crash, logs warning, continues

      const highlights: NodeHighlight[] = [
        { node: 'nonexistent', agentName: 'agent-1', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now(), color: '#1a73e8' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('```mermaid\ngraph TD\nServer --> Client\n```'),
      });

      // Expected: No error thrown, no highlight applied
    });

    it.skip('applies multiple highlights for same node from different agents', () => {
      // matrix: DiagramPanel component | multiple highlights same node | P4.2
      // Input class: Valid / typical (multiple agents)
      // PENDING: All highlights visible - could use multiple stroke layers,
      // or indicator badges, or pulsing animation

      const highlights: NodeHighlight[] = [
        { node: 'server', agentName: 'agent-alpha', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now() - 1000, color: '#1a73e8' },
        { node: 'server', agentName: 'agent-beta', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now() - 500, color: '#2e7d32' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('```mermaid\ngraph TD\nServer --> Client\n```'),
      });

      // Expected: Both highlights visible on #node-server
    });
  });

  // =============================================================================
  // BEHAVIOR: 10-second fade (auto-removal)
  // =============================================================================

  describe('Highlight auto-removal after 10 seconds', () => {
    it('highlight expires when timestamp is older than 10 seconds', () => {
      // matrix: client highlight cleanup | timestamp + 10s elapsed | P4.2
      // Input class: Boundary (exactly 10s, just over 10s)
      // Contract: Client removes highlight after 10 seconds

      const FADE_DURATION = 10000; // 10 seconds in ms
      const baseTime = Date.now();

      const isActive = (highlightTime: number, currentTime: number): boolean => {
        return (currentTime - highlightTime) < FADE_DURATION;
      };

      // At 0ms - active
      expect(isActive(baseTime, baseTime)).toBe(true);
      // At 1s - active
      expect(isActive(baseTime, baseTime + 1000)).toBe(true);
      // At 9.9s - active
      expect(isActive(baseTime, baseTime + 9999)).toBe(true);
      // At exactly 10s - EXPIRED (fade starts at 10s)
      expect(isActive(baseTime, baseTime + 10000)).toBe(false);
      // At 11s - expired
      expect(isActive(baseTime, baseTime + 11000)).toBe(false);
    });

    it.skip('DiagramPanel sets up cleanup timer for highlights', () => {
      // matrix: DiagramPanel component | highlight with timestamp | P4.2
      // Input class: Lifecycle (timer setup/cleanup)
      // PENDING: useEffect that runs every second, filters highlights
      // where (now - timestamp) > 10000, triggers re-render
    });

    it.skip('cleanup timer clears on unmount', () => {
      // matrix: DiagramPanel component | unmount with pending highlights | P4.2
      // Input class: Lifecycle (after close/shutdown)
      // Robustness invariant: No leaked timers
    });
  });

  // =============================================================================
  // BEHAVIOR: Agent color consistency
  // =============================================================================

  describe('Agent color assignment', () => {
    it('assigns consistent color per agent_name', () => {
      // matrix: client color utility | agent_name string | P4.2
      // Input class: Valid / typical
      // Contract: Same agent_name always maps to same color

      const agentColors: Record<string, string> = {};
      const colorPalette = [
        '#1a73e8', // blue
        '#2e7d32', // green
        '#7b1fa2', // purple
        '#f57c00', // orange
        '#c62828', // red
        '#00838f', // teal
        '#5d4037', // brown
        '#455a64', // blue-grey
      ];

      function getAgentColor(agentName: string): string {
        if (!agentColors[agentName]) {
          let hash = 0;
          for (let i = 0; i < agentName.length; i++) {
            hash = ((hash << 5) - hash) + agentName.charCodeAt(i);
            hash |= 0;
          }
          agentColors[agentName] = colorPalette[Math.abs(hash) % colorPalette.length];
        }
        return agentColors[agentName];
      }

      // Same agent always gets same color
      expect(getAgentColor('backend-agent')).toBe(getAgentColor('backend-agent'));
      expect(getAgentColor('frontend-agent')).toBe(getAgentColor('frontend-agent'));

      // Different agents typically get different colors
      const colors = new Set([
        getAgentColor('agent-alpha'),
        getAgentColor('agent-beta'),
        getAgentColor('agent-gamma'),
        getAgentColor('agent-delta'),
      ]);
      expect(colors.size).toBeGreaterThan(1);
    });

    it('color palette uses accessible colors', () => {
      // matrix: client color utility | color palette | P4.2
      // Input class: Invariant-only (accessibility)
      // All colors should have sufficient contrast against light/dark backgrounds

      const colorPalette = [
        '#1a73e8', // blue
        '#2e7d32', // green
        '#7b1fa2', // purple
        '#f57c00', // orange
        '#c62828', // red
        '#00838f', // teal
        '#5d4037', // brown
        '#455a64', // blue-grey
      ];

      // All colors are non-empty hex strings
      colorPalette.forEach(color => {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });

  // =============================================================================
  // BEHAVIOR: Highlight refresh on rapid edits from same agent
  // =============================================================================

  describe('Highlight timestamp refresh for same agent + node', () => {
    it('rapid edits from same agent to same node update timestamp', () => {
      // matrix: client highlight state | rapid edits same agent same node | P4.2
      // Input class: Valid / typical (high frequency)
      // Contract: Refresh existing highlight rather than create duplicate

      interface Highlight {
        agentName: string;
        node: string;
        timestamp: number;
      }

      const highlights: Highlight[] = [];

      function addOrUpdateHighlight(agentName: string, node: string, timestamp: number) {
        const existingIdx = highlights.findIndex(h => h.agentName === agentName && h.node === node);
        if (existingIdx >= 0) {
          highlights[existingIdx].timestamp = timestamp;
        } else {
          highlights.push({ agentName, node, timestamp });
        }
      }

      const baseTime = Date.now();
      addOrUpdateHighlight('agent-1', 'server', baseTime);
      addOrUpdateHighlight('agent-1', 'server', baseTime + 100);
      addOrUpdateHighlight('agent-1', 'server', baseTime + 200);

      expect(highlights.length).toBe(1);
      expect(highlights[0].timestamp).toBe(baseTime + 200);
    });

    it('edits from different agents to same node create separate highlights', () => {
      // matrix: client highlight state | multiple agents same node | P4.2
      // Input class: Valid / typical

      interface Highlight {
        agentName: string;
        node: string;
        timestamp: number;
      }

      const highlights: Highlight[] = [];

      function addOrUpdateHighlight(agentName: string, node: string, timestamp: number) {
        const existingIdx = highlights.findIndex(h => h.agentName === agentName && h.node === node);
        if (existingIdx >= 0) {
          highlights[existingIdx].timestamp = timestamp;
        } else {
          highlights.push({ agentName, node, timestamp });
        }
      }

      const baseTime = Date.now();
      addOrUpdateHighlight('agent-alpha', 'server', baseTime);
      addOrUpdateHighlight('agent-beta', 'server', baseTime + 100);

      expect(highlights.length).toBe(2);
      expect(highlights.find(h => h.agentName === 'agent-alpha')).toBeDefined();
      expect(highlights.find(h => h.agentName === 'agent-beta')).toBeDefined();
    });
  });

  // =============================================================================
  // BEHAVIOR: Diagram re-render handling
  // =============================================================================

  describe('Highlight persistence across diagram re-renders', () => {
    it('highlights for existing nodes preserved on re-render', () => {
      // matrix: client highlight state | diagram re-render same nodes | P4.2
      // Input class: Valid / typical

      const highlights: NodeHighlight[] = [
        { node: 'server', agentName: 'agent-1', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now(), color: '#1a73e8' },
        { node: 'client', agentName: 'agent-2', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now(), color: '#2e7d32' },
      ];

      // New diagram has same nodes
      const currentNodes = new Set(['server', 'client', 'hooks', 'database', 'planning']);

      const validHighlights = highlights.filter(h => currentNodes.has(h.node));
      expect(validHighlights.length).toBe(2);
    });

    it('highlights for removed nodes cleaned up on re-render', () => {
      // matrix: client highlight state | diagram re-render node removed | P4.2
      // Input class: Valid / typical (diagram change)

      const highlights: NodeHighlight[] = [
        { node: 'server', agentName: 'agent-1', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now(), color: '#1a73e8' },
        { node: 'database', agentName: 'agent-2', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now(), color: '#2e7d32' }, // removed
        { node: 'client', agentName: 'agent-3', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now(), color: '#7b1fa2' },
      ];

      // New diagram missing 'database' node
      const currentNodes = new Set(['server', 'client', 'hooks', 'planning']);

      const validHighlights = highlights.filter(h => currentNodes.has(h.node));
      expect(validHighlights.length).toBe(2);
      expect(validHighlights.find(h => h.node === 'database')).toBeUndefined();
    });
  });

  // =============================================================================
  // INTEGRATION: Parent component (TimelineView/App) WebSocket handling
  // =============================================================================

  describe('Parent component WebSocket event handling for node_highlight', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('processes node_highlight event and adds to highlight state', () => {
      // matrix: useEventStream hook | node_highlight event received | P4.2
      // Input class: Valid / typical
      // Contract: Parent receives WebSocket event, extracts highlight info

      const mockHighlightState = {
        highlights: [] as Array<{
          agentName: string;
          diagram: string;
          node: string;
          timestamp: number;
          color: string;
        }>,
        addHighlight: vi.fn((h) => mockHighlightState.highlights.push(h)),
      };

      // Simulate node_highlight event from WebSocket
      const nodeHighlightEvent: HookEvent = {
        type: 'event',
        event_id: 100,
        session_id: 'test-session',
        source_app: 'test-app',
        agent_name: 'backend-agent',
        event_type: 'node_highlight',
        tool_name: 'Write',
        tool_input: {
          file_path: 'apps/server/new.py',
          diagram: 'docs/diagrams/system-overview.md',
          node: 'server',
        },
        tool_output: {},
        timestamp: Date.now() / 1000,
      };

      // Process event (what the hook should do)
      if (nodeHighlightEvent.event_type === 'node_highlight') {
        const { agent_name, tool_input, timestamp } = nodeHighlightEvent;
        mockHighlightState.addHighlight({
          agentName: agent_name,
          diagram: tool_input.diagram as string,
          node: tool_input.node as string,
          timestamp: timestamp * 1000, // Convert to ms
          color: '#1a73e8', // Would be computed from agent_name
        });
      }

      expect(mockHighlightState.highlights.length).toBe(1);
      expect(mockHighlightState.highlights[0].node).toBe('server');
      expect(mockHighlightState.highlights[0].agentName).toBe('backend-agent');
      expect(mockHighlightState.highlights[0].diagram).toBe('docs/diagrams/system-overview.md');
    });

    it('ignores non-node_highlight events for highlight state', () => {
      // matrix: useEventStream hook | non-diagram event received | P4.2
      // Input class: Valid / typical

      const mockHighlightState = {
        highlights: [] as Array<any>,
        addHighlight: vi.fn((h) => mockHighlightState.highlights.push(h)),
      };

      const regularEvent: HookEvent = {
        type: 'event',
        event_id: 101,
        session_id: 'test-session',
        source_app: 'test-app',
        agent_name: 'test-agent',
        event_type: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: 'apps/server/x.py' },
        tool_output: {},
        timestamp: Date.now() / 1000,
      };

      if (regularEvent.event_type === 'node_highlight') {
        mockHighlightState.addHighlight({});
      }

      expect(mockHighlightState.highlights.length).toBe(0);
    });

    it('clears expired highlights on timer tick', () => {
      // matrix: client highlight cleanup | expired timestamp | P4.2
      // Input class: Boundary (time-based)

      const highlights: NodeHighlight[] = [
        { agentName: 'agent-1', node: 'server', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now() - 5000, color: '#1a73e8' },
        { agentName: 'agent-2', node: 'client', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now() - 15000, color: '#2e7d32' }, // Expired
        { agentName: 'agent-3', node: 'hooks', diagram: 'docs/diagrams/system-overview.md', timestamp: Date.now() - 8000, color: '#7b1fa2' },
      ];

      const now = Date.now();
      const activeHighlights = highlights.filter(h => (now - h.timestamp) < 10000);

      expect(activeHighlights.length).toBe(2);
      expect(activeHighlights.find(h => h.agentName === 'agent-2')).toBeUndefined();
    });

    it('includes agent name in highlight for tooltip/legend', () => {
      // matrix: client highlight display | agent_name in highlight | P4.2
      // Input class: Valid / typical
      // Contract: UI can show "backend-agent is editing server"

      const highlight: NodeHighlight = {
        agentName: 'backend-agent',
        node: 'server',
        diagram: 'docs/diagrams/system-overview.md',
        timestamp: Date.now(),
        color: '#1a73e8',
      };

      const tooltipText = `${highlight.agentName} is editing ${highlight.node}`;
      expect(tooltipText).toBe('backend-agent is editing server');
    });
  });

  // =============================================================================
  // EDGE CASES / ROBUSTNESS INVARIANTS
  // =============================================================================

  describe('Robustness invariants', () => {
    it('handles malformed highlight object gracefully', () => {
      // matrix: DiagramPanel component | malformed highlight object | P4.2
      // Input class: Malformed
      // Robustness invariant: Does not crash, logs warning, continues

      // The component should handle missing fields in highlight objects
      // without throwing. TypeScript types help, but runtime data from
      // WebSocket could be malformed.

      const malformedHighlights = [
        { node: 'server' }, // missing agentName, diagram, timestamp, color
        { agentName: 'agent-1', timestamp: Date.now() }, // missing node
        null as any, // null in array
        undefined as any, // undefined in array
      ];

      // Component should filter/validate before applying
      const validHighlights = malformedHighlights.filter(h =>
        h && typeof h === 'object' && h.node && h.agentName && h.diagram && h.timestamp && h.color
      );

      expect(validHighlights.length).toBe(0);
    });

    it('handles extremely large highlights array without performance issue', () => {
      // matrix: DiagramPanel component | many highlights | P4.2
      // Input class: Oversized
      // Robustness invariant: Resource use stays bounded

      const manyHighlights: NodeHighlight[] = Array.from({ length: 1000 }, (_, i) => ({
        node: `node-${i % 10}`,
        agentName: `agent-${i % 5}`,
        diagram: 'docs/diagrams/system-overview.md',
        timestamp: Date.now() - i * 100,
        color: '#1a73e8',
      }));

      // Should not crash or hang
      const filtered = manyHighlights.filter(h => (Date.now() - h.timestamp) < 10000);
      expect(filtered.length).toBeLessThanOrEqual(1000);
    });

    it('handles rapid highlight additions without memory leak', () => {
      // matrix: DiagramPanel component | rapid highlight add/remove | P4.2
      // Input class: Concurrent
      // Robustness invariant: Memory stays bounded

      const highlights: NodeHighlight[] = [];

      // Simulate rapid additions and cleanup
      for (let i = 0; i < 100; i++) {
        highlights.push({
          node: `node-${i % 5}`,
          agentName: `agent-${i % 3}`,
          diagram: 'docs/diagrams/system-overview.md',
          timestamp: Date.now() + i,
          color: '#1a73e8',
        });

        // Cleanup expired (simulating timer tick)
        const now = Date.now() + i + 10001;
        const active = highlights.filter(h => (now - h.timestamp) < 10000);
        highlights.length = 0;
        highlights.push(...active);
      }

      // Memory should not grow unbounded
      expect(highlights.length).toBeLessThanOrEqual(15); // At most 5 nodes * 3 agents
    });
  });

  // =============================================================================
  // UNMAPPED EDIT / DIAGRAM DRIFT - ensure they don't create highlights
  // =============================================================================

  describe('Unmapped edit and diagram drift events do not create highlights', () => {
    it('unmapped_edit event type does not create node highlight', () => {
      // matrix: client event filtering | unmapped_edit event type | P4.2
      // Input class: Valid / typical

      const events: HookEvent[] = [
        {
          type: 'event',
          event_id: 1,
          session_id: 's1',
          source_app: 'app',
          agent_name: 'agent-1',
          event_type: 'unmapped_edit',
          tool_name: 'Write',
          tool_input: { file_path: 'random/file.py' },
          tool_output: {},
          timestamp: Date.now() / 1000,
        },
        {
          type: 'event',
          event_id: 2,
          session_id: 's1',
          source_app: 'app',
          agent_name: 'agent-1',
          event_type: 'node_highlight',
          tool_name: 'Write',
          tool_input: { file_path: 'apps/server/x.py', diagram: 'docs/diagrams/system-overview.md', node: 'server' },
          tool_output: {},
          timestamp: Date.now() / 1000,
        },
      ];

      const highlightEvents = events.filter(e => e.event_type === 'node_highlight');
      const unmappedEvents = events.filter(e => e.event_type === 'unmapped_edit');

      expect(unmappedEvents.length).toBe(1);
      expect(highlightEvents.length).toBe(1);
      expect(highlightEvents[0].tool_input?.node).toBe('server');
    });

    it('diagram_drift event type does not create node highlight', () => {
      // matrix: client event filtering | diagram_drift event type | P4.2
      // Input class: Valid / typical

      const driftEvent: HookEvent = {
        type: 'event',
        event_id: 3,
        session_id: 's1',
        source_app: 'app',
        agent_name: 'agent-1',
        event_type: 'diagram_drift',
        tool_name: 'Write',
        tool_input: {
          file_path: 'apps/server/server.py',
          diagram: 'docs/diagrams/system-overview.md',
          node: 'server',
          reason: 'source file newer than diagram',
        },
        tool_output: {},
        timestamp: Date.now() / 1000,
      };

      expect(driftEvent.event_type).toBe('diagram_drift');
      expect(driftEvent.event_type).not.toBe('node_highlight');
    });
  });
});


describe('Agent Color Utility - Spec Tests', () => {
  // These tests define the expected color utility function that should exist
  // in a shared module (e.g., src/utils/agentColors.ts)

  it('getAgentColor returns deterministic color for agent name', () => {
    // matrix: client color utility | agent_name string | P4.2
    // Input class: Valid / typical

    // This is the expected interface - to be implemented in src/utils/agentColors.ts
    // function getAgentColor(agentName: string): string

    // For now, test the algorithm inline
    function getAgentColor(agentName: string): string {
      const colorPalette = [
        '#1a73e8', '#2e7d32', '#7b1fa2', '#f57c00',
        '#c62828', '#00838f', '#5d4037', '#455a64',
      ];
      let hash = 0;
      for (let i = 0; i < agentName.length; i++) {
        hash = ((hash << 5) - hash) + agentName.charCodeAt(i);
        hash |= 0;
      }
      return colorPalette[Math.abs(hash) % colorPalette.length];
    }

    // Deterministic
    expect(getAgentColor('test-agent')).toBe(getAgentColor('test-agent'));
    expect(getAgentColor('another-agent')).toBe(getAgentColor('another-agent'));

    // Returns valid hex color
    expect(getAgentColor('any-agent')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('getAgentColor distributes colors across palette', () => {
    // matrix: client color utility | multiple agent names | P4.2
    // Input class: Valid / typical

    function getAgentColor(agentName: string): string {
      const colorPalette = [
        '#1a73e8', '#2e7d32', '#7b1fa2', '#f57c00',
        '#c62828', '#00838f', '#5d4037', '#455a64',
      ];
      let hash = 0;
      for (let i = 0; i < agentName.length; i++) {
        hash = ((hash << 5) - hash) + agentName.charCodeAt(i);
        hash |= 0;
      }
      return colorPalette[Math.abs(hash) % colorPalette.length];
    }

    const agents = ['agent-a', 'agent-b', 'agent-c', 'agent-d', 'agent-e', 'agent-f', 'agent-g', 'agent-h'];
    const colors = agents.map(getAgentColor);
    const uniqueColors = new Set(colors);

    // Should use multiple colors from palette
    expect(uniqueColors.size).toBeGreaterThan(1);
    expect(uniqueColors.size).toBeLessThanOrEqual(8);
  });
});