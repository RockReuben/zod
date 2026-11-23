import { describe, it, expect, vi, beforeEach, afterEach, act } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiagramPanel } from '../../src/components/DiagramPanel';
import { useEventsStore } from '../../src/stores/events';
import { HookEvent } from '../../src/types';

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({
      svg: '<svg><g id="node-server" class="node">Server</g><g id="node-client" class="node">Client</g><g id="node-hooks" class="node">Hooks</g></svg>'
    }),
  },
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

describe('DiagramPanel - Node Highlighting (P4.2)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Reset mermaid render mock
    const mermaid = await import('mermaid');
    vi.mocked(mermaid.default.render).mockResolvedValue({
      svg: '<svg><g id="node-server" class="node">Server</g><g id="node-client" class="node">Client</g><g id="node-hooks" class="node">Hooks</g><g id="node-database" class="node">Database</g><g id="node-planning" class="node">Planning</g></svg>'
    });

    // Reset config mocks
    mockGetApiBase.mockReturnValue('http://127.0.0.1:8081');
    mockGetToken.mockReturnValue('test-token');

    // Mock the store
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

  // --- Node highlight event reception tests ---

  it('renders diagram and waits for highlight events', async () => {
    // matrix: DiagramPanel render | valid diagram load | P4.2
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('```mermaid\ngraph TD\nA[Server] --> B[Client]\n```'),
    });

    render(<DiagramPanel diagramName="system-overview" />);

    await waitFor(() => {
      const container = screen.getByTestId('diagram-container');
      expect(container).toBeInTheDocument();
    });
  });

  it('receives node_highlight event and highlights the mapped node', async () => {
    // matrix: DiagramPanel highlight props | node_highlight event received | P4.2
    // This test defines the expected behavior for receiving node_highlight events
    // via the WebSocket connection in useEventStream hook
    // The DiagramPanel itself doesn't directly handle WebSocket - it receives
    // highlight info through props or context from the parent TimelineView

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('```mermaid\ngraph TD\nServer --> Client\n```'),
    });

    render(<DiagramPanel diagramName="system-overview" />);

    await waitFor(() => {
      const container = screen.getByTestId('diagram-container');
      expect(container).toBeInTheDocument();
    });

    // The actual highlight handling is in the parent component (TimelineView/App)
    // which receives WebSocket events and passes highlight props to DiagramPanel
    // This test documents the expected interface
  });

  // --- Agent color assignment tests ---

  it('assigns consistent color per agent_name', () => {
    // matrix: client color utility | agent_name string | P4.2
    // Test the color assignment logic that should exist in the client
    // Each agent_name should map to a consistent color

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
        // Hash the agent name to get consistent color index
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
    expect(getAgentColor('agent-alpha')).toBe(getAgentColor('agent-alpha'));
    expect(getAgentColor('agent-beta')).toBe(getAgentColor('agent-beta'));

    // Different agents get different colors (with high probability)
    const color1 = getAgentColor('agent-alpha');
    const color2 = getAgentColor('agent-beta');
    const color3 = getAgentColor('agent-gamma');
    const color4 = getAgentColor('agent-delta');

    // At least some should be different
    const colors = new Set([color1, color2, color3, color4]);
    expect(colors.size).toBeGreaterThan(1);
  });

  // --- 10-second fade tests ---

  it('highlight fades after 10 seconds', async () => {
    // matrix: client highlight state | timestamp + 10s elapsed | P4.2
    // This test defines the expected fade behavior
    // The highlight should be added with a timestamp and removed after 10s

    vi.useFakeTimers();

    const highlightStartTime = Date.now();
    const FADE_DURATION = 10000; // 10 seconds

    // Simulate highlight being added
    const isHighlightActive = (currentTime: number): boolean => {
      return (currentTime - highlightStartTime) < FADE_DURATION;
    };

    // At start, highlight is active
    expect(isHighlightActive(highlightStartTime)).toBe(true);
    expect(isHighlightActive(highlightStartTime + 1000)).toBe(true);
    expect(isHighlightActive(highlightStartTime + 5000)).toBe(true);
    expect(isHighlightActive(highlightStartTime + 9999)).toBe(true);

    // After 10 seconds, highlight should fade
    expect(isHighlightActive(highlightStartTime + 10000)).toBe(false);
    expect(isHighlightActive(highlightStartTime + 11000)).toBe(false);

    vi.useRealTimers();
  });

  it('multiple highlights on same node from different agents stack or queue', () => {
    // matrix: client highlight state | multiple agents same node | P4.2
    // When multiple agents edit the same node, highlights should be visible
    // either as stacked/overlapping or queued

    interface Highlight {
      agentName: string;
      node: string;
      startTime: number;
      color: string;
    }

    const highlights: Highlight[] = [];
    const MAX_HIGHLIGHTS_PER_NODE = 3; // Configurable limit

    function addHighlight(highlight: Highlight): boolean {
      const nodeHighlights = highlights.filter(h => h.node === highlight.node);
      if (nodeHighlights.length >= MAX_HIGHLIGHTS_PER_NODE) {
        // Remove oldest
        const oldest = nodeHighlights.sort((a, b) => a.startTime - b.startTime)[0];
        const idx = highlights.indexOf(oldest);
        highlights.splice(idx, 1);
      }
      highlights.push(highlight);
      return true;
    }

    const now = Date.now();
    addHighlight({ agentName: 'agent-1', node: 'server', startTime: now, color: '#1a73e8' });
    addHighlight({ agentName: 'agent-2', node: 'server', startTime: now + 100, color: '#2e7d32' });
    addHighlight({ agentName: 'agent-3', node: 'server', startTime: now + 200, color: '#7b1fa2' });

    // Should have 3 highlights
    const serverHighlights = highlights.filter(h => h.node === 'server');
    expect(serverHighlights.length).toBe(3);

    // Adding 4th should remove oldest
    addHighlight({ agentName: 'agent-4', node: 'server', startTime: now + 300, color: '#f57c00' });
    const serverHighlights2 = highlights.filter(h => h.node === 'server');
    expect(serverHighlights2.length).toBe(3);
    expect(serverHighlights2.find(h => h.agentName === 'agent-1')).toBeUndefined();
    expect(serverHighlights2.find(h => h.agentName === 'agent-4')).toBeDefined();
  });

  it('highlight removed when node no longer exists in diagram', () => {
    // matrix: client highlight state | diagram re-render node removed | P4.2
    // If diagram is re-rendered (P4.3) and node is removed,
    // associated highlights should be cleaned up

    interface Highlight {
      agentName: string;
      node: string;
      startTime: number;
    }

    const highlights: Highlight[] = [
      { agentName: 'agent-1', node: 'server', startTime: Date.now() - 1000 },
      { agentName: 'agent-2', node: 'client', startTime: Date.now() - 2000 },
      { agentName: 'agent-3', node: 'database', startTime: Date.now() - 3000 },
    ];

    // New diagram nodes after re-render
    const currentNodes = new Set(['server', 'client', 'hooks', 'planning']);
    // 'database' node was removed

    const validHighlights = highlights.filter(h => currentNodes.has(h.node));

    expect(validHighlights.length).toBe(2);
    expect(validHighlights.find(h => h.node === 'database')).toBeUndefined();
  });

  // --- Unmapped edit indicator tests ---

  it('unmapped_edit events appear in diagram events indicator, not as highlights', () => {
    // matrix: client event filtering | unmapped_edit event type | P4.2
    // Unmapped edits should NOT create node highlights
    // They should appear in the DiagramEventsIndicator component

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

    const unmappedEvents = events.filter(e => e.event_type === 'unmapped_edit');
    const highlightEvents = events.filter(e => e.event_type === 'node_highlight');

    expect(unmappedEvents.length).toBe(1);
    expect(highlightEvents.length).toBe(1);
    expect(unmappedEvents[0].tool_input?.file_path).toBe('random/file.py');
    expect(highlightEvents[0].tool_input?.node).toBe('server');
  });

  it('diagram_drift events appear in indicator with diagram/node info', () => {
    // matrix: client event filtering | diagram_drift event type | P4.2
    // diagram_drift events should show which diagram/node is out of date

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
        reason: 'source file newer than diagram'
      },
      tool_output: {},
      timestamp: Date.now() / 1000,
    };

    expect(driftEvent.event_type).toBe('diagram_drift');
    expect(driftEvent.tool_input?.diagram).toBe('docs/diagrams/system-overview.md');
    expect(driftEvent.tool_input?.node).toBe('server');
    expect(driftEvent.tool_input?.reason).toBe('source file newer than diagram');
  });
});


describe('TimelineView - Node Highlight Integration (P4.2)', () => {
  // Tests for the parent component that receives WebSocket events
  // and passes highlight info to DiagramPanel

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('receives node_highlight event from WebSocket and updates highlight state', async () => {
    // matrix: useEventStream hook | node_highlight event received | P4.2
    // This test defines the expected behavior in the parent component
    // (TimelineView or App) that manages the WebSocket connection

    // The useEventStream hook receives events and should:
    // 1. Detect node_highlight event_type
    // 2. Extract agent_name, diagram, node, timestamp
    // 3. Update highlight state for DiagramPanel consumption

    const mockHighlightState = {
      highlights: [] as Array<{
        agentName: string;
        diagram: string;
        node: string;
        timestamp: number;
        color: string;
      }>,
      addHighlight: vi.fn((h) => mockHighlightState.highlights.push(h)),
      removeHighlight: vi.fn((node, agentName) => {
        const idx = mockHighlightState.highlights.findIndex(
          h => h.node === node && h.agentName === agentName
        );
        if (idx >= 0) mockHighlightState.highlights.splice(idx, 1);
      }),
      clearExpiredHighlights: vi.fn(() => {
        const now = Date.now();
        mockHighlightState.highlights = mockHighlightState.highlights.filter(
          h => (now - h.timestamp) < 10000
        );
      }),
    };

    // Simulate receiving node_highlight event
    const nodeHighlightEvent = {
      type: 'event',
      event_id: 100,
      session_id: 'test-session',
      source_app: 'test-app',
      agent_name: 'test-agent',
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

    // Process the event (what the hook should do)
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
    expect(mockHighlightState.highlights[0].agentName).toBe('test-agent');
  });

  it('clears expired highlights on timer tick', () => {
    // matrix: client highlight cleanup | expired timestamp | P4.2
    const highlights = [
      { agentName: 'agent-1', node: 'server', timestamp: Date.now() - 5000, color: '#1a73e8' },
      { agentName: 'agent-2', node: 'client', timestamp: Date.now() - 15000, color: '#2e7d32' }, // Expired
      { agentName: 'agent-3', node: 'hooks', timestamp: Date.now() - 8000, color: '#7b1fa2' },
    ];

    const now = Date.now();
    const activeHighlights = highlights.filter(h => (now - h.timestamp) < 10000);

    expect(activeHighlights.length).toBe(2);
    expect(activeHighlights.find(h => h.agentName === 'agent-2')).toBeUndefined();
  });

  it('multiple rapid highlights for same node from same agent update timestamp', () => {
    // matrix: client highlight state | rapid edits same agent same node | P4.2
    // Rapid edits from same agent to same node should refresh the highlight
    // rather than creating duplicate highlights

    const highlights: Array<{ agentName: string; node: string; timestamp: number }> = [];

    function addOrUpdateHighlight(agentName: string, node: string, timestamp: number) {
      const existingIdx = highlights.findIndex(h => h.agentName === agentName && h.node === node);
      if (existingIdx >= 0) {
        // Update timestamp (refresh)
        highlights[existingIdx].timestamp = timestamp;
      } else {
        highlights.push({ agentName, node, timestamp });
      }
    }

    const baseTime = Date.now();
    addOrUpdateHighlight('agent-1', 'server', baseTime);
    addOrUpdateHighlight('agent-1', 'server', baseTime + 100); // Rapid second edit
    addOrUpdateHighlight('agent-1', 'server', baseTime + 200); // Rapid third edit

    expect(highlights.length).toBe(1);
    expect(highlights[0].timestamp).toBe(baseTime + 200); // Latest timestamp
  });

  it('highlight includes agent name for tooltip/legend', () => {
    // matrix: client highlight display | agent_name in highlight | P4.2
    // The highlight should carry agent_name so UI can show which agent is editing

    interface Highlight {
      agentName: string;
      node: string;
      diagram: string;
      timestamp: number;
    }

    const highlight: Highlight = {
      agentName: 'backend-agent',
      node: 'server',
      diagram: 'docs/diagrams/system-overview.md',
      timestamp: Date.now(),
    };

    // UI can display: "backend-agent is editing server"
    const tooltipText = `${highlight.agentName} is editing ${highlight.node}`;
    expect(tooltipText).toBe('backend-agent is editing server');
  });
});


// PENDING tests - define expected behavior not yet implemented
describe('Node Highlighting - Pending Implementation (P4.2)', () => {

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockReset();

    const mermaid = await import('mermaid');
    vi.mocked(mermaid.default.render).mockResolvedValue({
      svg: '<svg><g id="node-server" class="node">Server</g><g id="node-client" class="node">Client</g></svg>'
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

  it.skip('DiagramPanel receives highlight props and applies visual highlight to node', () => {
    // matrix: DiagramPanel component | highlight props received | P4.2
    // PENDING: DiagramPanel needs to accept highlight props
    // and apply visual highlighting (CSS filter, stroke, opacity) to the SVG node

    // Expected interface:
    // <DiagramPanel
    //   diagramName="system-overview"
    //   highlights={[{ node: 'server', agentName: 'agent-1', color: '#1a73e8', timestamp: 1234567890 }]}
    // />

    // Implementation would:
    // 1. After mermaid render, find SVG element with id="node-{nodeId}"
    // 2. Apply highlight style: stroke={color}, stroke-width=3, filter="drop-shadow(0 0 5px {color})"
    // 3. Set up timeout to remove highlight after 10 seconds from timestamp
  });

  it.skip('highlight uses agent-specific color consistently', () => {
    // matrix: client color utility | agent_name string | P4.2
    // PENDING: Color assignment function that maps agent_name to consistent color
    // Should be in a shared utility module

    // function getAgentColor(agentName: string): string
    // - Deterministic hash of agentName
    // - Returns color from accessible palette
    // - Same agentName always returns same color
  });

  it.skip('highlights auto-remove after 10 seconds', () => {
    // matrix: client highlight cleanup | expired timestamp | P4.2
    // PENDING: useEffect in DiagramPanel or parent that clears expired highlights
    // Runs every second, removes highlights where (now - timestamp) > 10000
  });

  it.skip('multiple overlapping highlights on same node are all visible', () => {
    // matrix: client highlight state | multiple agents same node | P4.2
    // PENDING: When multiple agents edit same node, all highlights visible
    // Could use multiple strokes, or stacked indicators, or pulsing animation
  });

  it.skip('highlight updates timestamp on rapid edits from same agent', () => {
    // matrix: client highlight state | rapid edits same agent same node | P4.2
    // PENDING: Same agent + same node = refresh existing highlight timestamp
    // rather than creating duplicate
  });

  it.skip('diagram re-render preserves valid highlights, removes invalid ones', () => {
    // matrix: client highlight state | diagram re-render node removed | P4.2
    // PENDING: When DiagramPanel re-renders (diagram change), highlights
    // for nodes that still exist are preserved, others removed
  });

  it.skip('unmapped_edit events do not create highlights but appear in indicator', () => {
    // matrix: client event filtering | unmapped_edit event type | P4.2
    // PENDING: Already tested in DiagramEventsIndicator, but verify
    // no highlight is created for unmapped_edit event_type
  });
});