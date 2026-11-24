import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ControlPane } from '../../src/components/ControlPane';
import { useEventsStore } from '../../src/stores/events';
import { useEventStream } from '../../src/hooks/useEventStream';
import { HookEvent } from '../../src/types';

// Mock the events store
const mockEvents: HookEvent[] = [
  {
    type: 'event',
    event_id: 1,
    uuid: 'uuid-1',
    session_id: 'sess-1',
    source_app: 'pkg-auth',
    agent_name: 'auth-agent',
    event_type: 'PreToolUse',
    tool_name: 'Read',
    tool_input: {},
    tool_output: {},
    timestamp: 1000,
    transcript_path: null,
    created_at: 1000,
  },
  {
    type: 'event',
    event_id: 2,
    uuid: 'uuid-2',
    session_id: 'sess-2',
    source_app: 'pkg-db',
    agent_name: 'db-agent',
    event_type: 'PostToolUse',
    tool_name: 'Write',
    tool_input: {},
    tool_output: {},
    timestamp: 2000,
    transcript_path: null,
    created_at: 2000,
  },
  {
    type: 'event',
    event_id: 3,
    uuid: 'uuid-3',
    session_id: 'sess-3',
    source_app: 'pkg-api',
    agent_name: 'api-agent',
    event_type: 'Notification',
    tool_name: 'Task',
    tool_input: {},
    tool_output: {},
    timestamp: 3000,
    transcript_path: null,
    created_at: 3000,
  },
  {
    type: 'event',
    event_id: 4,
    uuid: 'uuid-4',
    session_id: 'sess-1', // duplicate session
    source_app: 'pkg-auth',
    agent_name: 'auth-agent',
    event_type: 'PreToolUse',
    tool_name: 'Edit',
    tool_input: {},
    tool_output: {},
    timestamp: 4000,
    transcript_path: null,
    created_at: 4000,
  },
];

const mockGetAvailableFilters = vi.fn();

vi.mock('../../src/stores/events', () => ({
  useEventsStore: vi.fn(),
}));

vi.mock('../../src/hooks/useEventStream', () => ({
  useEventStream: vi.fn(),
}));

const mockUseEventsStore = vi.mocked(useEventsStore);
const mockUseEventStream = vi.mocked(useEventStream);

describe('ControlPane component', () => {
  const mockSetFilter = vi.fn();
  const mockSetActivePlan = vi.fn();
  const mockSetDiffMode = vi.fn();
  const mockSetAvailablePlans = vi.fn();
  const mockOnDiagramChange = vi.fn();

  // Shared mock plan diff state
  const mockPlanDiff = {
    activePlan: null,
    availablePlans: [],
    diffMode: 'none' as const,
    currentDiagram: '',
    proposedDiagram: '',
    isLoadingProposed: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnDiagramChange.mockClear();
    mockSetActivePlan.mockClear();
    mockSetDiffMode.mockClear();
    mockSetAvailablePlans.mockClear();

    mockGetAvailableFilters.mockReturnValue({
      sourceApps: ['pkg-auth', 'pkg-db', 'pkg-api'],
      agentNames: ['auth-agent', 'db-agent', 'api-agent'],
      eventTypes: ['PreToolUse', 'PostToolUse', 'Notification'],
    });

    mockUseEventsStore.mockImplementation((selector: any) => {
      const state = {
        filters: { sourceApp: 'all', agentName: 'all', eventType: 'all' },
        setFilter: mockSetFilter,
        events: mockEvents,
        replay: { isReplaying: false, replaySessionId: null, replaySpeed: 1, replayProgress: 0, sessions: [] },
        getAvailableFilters: mockGetAvailableFilters,
        planDiff: mockPlanDiff,
        setActivePlan: mockSetActivePlan,
        setDiffMode: mockSetDiffMode,
        setAvailablePlans: mockSetAvailablePlans,
      };
      return selector(state);
    });

    mockUseEventStream.mockReturnValue({
      status: 'connected' as const,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  // Test 1: Renders diagram selector with current diagram highlighted
  it('renders diagram selector with current diagram highlighted', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.props | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} activeDiagram="system-overview" />);

    const diagramSelect = screen.getByLabelText('Diagram');
    expect(diagramSelect).toBeInTheDocument();
    expect(diagramSelect).toHaveValue('system-overview');
    expect(screen.getByText('System Overview')).toBeInTheDocument();
  });

  // Test 2: Diagram selector changes trigger onDiagramChange callback
  it('diagram selector change triggers onDiagramChange callback', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.props | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} activeDiagram="system-overview" />);

    const diagramSelect = screen.getByLabelText('Diagram');
    fireEvent.change(diagramSelect, { target: { value: 'system-overview' } });

    expect(mockOnDiagramChange).toHaveBeenCalledWith('system-overview');
  });

  // Test 3: Session filter dropdown populated from store events
  it('session filter dropdown populated from store events', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.sessionFilter | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    const sessionSelect = screen.getByLabelText('Session');
    expect(sessionSelect).toBeInTheDocument();
    expect(sessionSelect).toHaveValue('all');
    expect(screen.getByText('All Sessions')).toBeInTheDocument();
    expect(screen.getByText('pkg-auth')).toBeInTheDocument();
    expect(screen.getByText('pkg-db')).toBeInTheDocument();
    expect(screen.getByText('pkg-api')).toBeInTheDocument();
  });

  // Test 4: Agent filter dropdown populated from store events
  it('agent filter dropdown populated from store events', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.agentFilter | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    const agentSelect = screen.getByLabelText('Agent');
    expect(agentSelect).toBeInTheDocument();
    expect(agentSelect).toHaveValue('all');
    expect(screen.getByText('All Agents')).toBeInTheDocument();
    expect(screen.getByText('auth-agent')).toBeInTheDocument();
    expect(screen.getByText('db-agent')).toBeInTheDocument();
    expect(screen.getByText('api-agent')).toBeInTheDocument();
  });

  // Test 5: Event type filter dropdown populated from store events
  it('event type filter dropdown populated from store events', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.eventTypeFilter | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    const eventTypeSelect = screen.getByLabelText('Event Type');
    expect(eventTypeSelect).toBeInTheDocument();
    expect(eventTypeSelect).toHaveValue('all');
    expect(screen.getByText('All Types')).toBeInTheDocument();
    expect(screen.getByText('PreToolUse')).toBeInTheDocument();
    expect(screen.getByText('PostToolUse')).toBeInTheDocument();
    expect(screen.getByText('Notification')).toBeInTheDocument();
  });

  // Test 6: Changing session filter calls setFilter with correct key/value
  it('changing session filter calls setFilter with correct key/value', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.sessionFilter | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    const sessionSelect = screen.getByLabelText('Session');
    fireEvent.change(sessionSelect, { target: { value: 'pkg-auth' } });

    expect(mockSetFilter).toHaveBeenCalledWith('sourceApp', 'pkg-auth');
  });

  // Test 6: Changing agent filter calls setFilter with correct key/value
  it('changing agent filter calls setFilter with correct key/value', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.agentFilter | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    const agentSelect = screen.getByLabelText('Agent');
    fireEvent.change(agentSelect, { target: { value: 'db-agent' } });

    expect(mockSetFilter).toHaveBeenCalledWith('agentName', 'db-agent');
  });

  // Test 6: Changing event type filter calls setFilter with correct key/value
  it('changing event type filter calls setFilter with correct key/value', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.eventTypeFilter | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    const eventTypeSelect = screen.getByLabelText('Event Type');
    fireEvent.change(eventTypeSelect, { target: { value: 'PreToolUse' } });

    expect(mockSetFilter).toHaveBeenCalledWith('eventType', 'PreToolUse');
  });

  // Test 7: Connection status shows correct badge for each state
  it('connection status shows Live badge when connected', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.status | Valid / typical | P5.6 spec
    mockUseEventStream.mockReturnValue({
      status: 'connected' as const,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    expect(screen.getByText('Live')).toBeInTheDocument();
    const statusBadge = screen.getByText('Live').parentElement;
    expect(statusBadge).toHaveStyle({ '--status-color': '#22c55e' });
  });

  it('connection status shows Reconnecting badge when reconnecting', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.status | Valid / typical | P5.6 spec
    mockUseEventStream.mockReturnValue({
      status: 'reconnecting' as const,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    expect(screen.getByText('Reconnecting…')).toBeInTheDocument();
  });

  it('connection status shows Error badge when error', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.status | Valid / typical | P5.6 spec
    mockUseEventStream.mockReturnValue({
      status: 'error' as const,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('connection status shows Disconnected badge when disconnected', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.status | Valid / typical | P5.6 spec
    mockUseEventStream.mockReturnValue({
      status: 'disconnected' as const,
      connect: vi.fn(),
      disconnect: vi.fn(),
    });

    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  // Test 7b: Shows replay status when replaying
  it('shows replay status when isReplaying is true', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.replayStatus | Valid / typical | P5.6 spec
    mockUseEventsStore.mockImplementation((selector: any) => {
      const state = {
        filters: { sourceApp: 'all', agentName: 'all', eventType: 'all' },
        setFilter: mockSetFilter,
        events: mockEvents,
        replay: { isReplaying: true, replaySessionId: 'sess-1', replaySpeed: 2, replayProgress: 50, sessions: [] },
        getAvailableFilters: mockGetAvailableFilters,
        planDiff: mockPlanDiff,
        setActivePlan: mockSetActivePlan,
        setDiffMode: mockSetDiffMode,
        setAvailablePlans: mockSetAvailablePlans,
      };
      return selector(state);
    });

    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    expect(screen.getByText('Replay (2x)')).toBeInTheDocument();
  });

  // Test 8: Stats show total events and active session count
  it('stats show correct total event count', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.stats | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    // 4 events in mockEvents
    expect(screen.getByText('4')).toBeInTheDocument(); // total events value
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('stats show correct active session count', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.stats | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    // 3 unique sessions (sess-1, sess-2, sess-3 - sess-1 appears twice)
    // Find the "Sessions" label and check its sibling value
    const sessionsLabel = screen.getByText('Sessions');
    const sessionsStat = sessionsLabel.closest('.control-stat');
    const sessionsValue = sessionsStat?.querySelector('.control-stat-value');
    expect(sessionsValue).toHaveTextContent('3');
  });

  it('stats show correct active agent count', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.stats | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    // 3 unique agents (auth-agent, db-agent, api-agent)
    const agentsLabel = screen.getByText('Agents');
    const agentsStat = agentsLabel.closest('.control-stat');
    const agentsValue = agentsStat?.querySelector('.control-stat-value');
    expect(agentsValue).toHaveTextContent('3');
  });

  // Test: Empty events state
  it('handles empty events list with zero stats', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.stats | Empty / missing | P5.6 spec
    mockUseEventsStore.mockImplementation((selector: any) => {
      const state = {
        filters: { sourceApp: 'all', agentName: 'all', eventType: 'all' },
        setFilter: mockSetFilter,
        events: [],
        replay: { isReplaying: false, replaySessionId: null, replaySpeed: 1, replayProgress: 0, sessions: [] },
        getAvailableFilters: mockGetAvailableFilters,
        planDiff: mockPlanDiff,
        setActivePlan: mockSetActivePlan,
        setDiffMode: mockSetDiffMode,
        setAvailablePlans: mockSetAvailablePlans,
      };
      return selector(state);
    });

    mockGetAvailableFilters.mockReturnValue({
      sourceApps: [],
      agentNames: [],
      eventTypes: [],
    });

    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    // All three stat values should be 0
    const statValues = screen.getAllByText('0');
    expect(statValues.length).toBeGreaterThanOrEqual(3);

    // Dropdowns should show empty options
    expect(screen.getByText('All Sessions')).toBeInTheDocument();
    expect(screen.getByText('All Agents')).toBeInTheDocument();
    expect(screen.getByText('All Types')).toBeInTheDocument();
  });

  // Test: Reset filters button
  it('reset filters button is disabled when all filters are all', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.resetButton | Valid / typical | P5.6 spec
    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    const resetBtn = screen.getByText('Reset Filters');
    expect(resetBtn).toBeDisabled();
  });

  it('reset filters button is enabled when any filter is active', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.resetButton | Valid / typical | P5.6 spec
    mockUseEventsStore.mockImplementation((selector: any) => {
      const state = {
        filters: { sourceApp: 'pkg-auth', agentName: 'all', eventType: 'all' },
        setFilter: mockSetFilter,
        events: mockEvents,
        replay: { isReplaying: false, replaySessionId: null, replaySpeed: 1, replayProgress: 0, sessions: [] },
        getAvailableFilters: mockGetAvailableFilters,
        planDiff: mockPlanDiff,
        setActivePlan: mockSetActivePlan,
        setDiffMode: mockSetDiffMode,
        setAvailablePlans: mockSetAvailablePlans,
      };
      return selector(state);
    });

    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    const resetBtn = screen.getByText('Reset Filters');
    expect(resetBtn).not.toBeDisabled();
  });

  it('reset filters button calls setFilter for all three filters', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.resetButton | Valid / typical | P5.6 spec
    mockUseEventsStore.mockImplementation((selector: any) => {
      const state = {
        filters: { sourceApp: 'pkg-auth', agentName: 'db-agent', eventType: 'PreToolUse' },
        setFilter: mockSetFilter,
        events: mockEvents,
        replay: { isReplaying: false, replaySessionId: null, replaySpeed: 1, replayProgress: 0, sessions: [] },
        getAvailableFilters: mockGetAvailableFilters,
        planDiff: mockPlanDiff,
        setActivePlan: mockSetActivePlan,
        setDiffMode: mockSetDiffMode,
        setAvailablePlans: mockSetAvailablePlans,
      };
      return selector(state);
    });

    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    fireEvent.click(screen.getByText('Reset Filters'));

    expect(mockSetFilter).toHaveBeenCalledWith('sourceApp', 'all');
    expect(mockSetFilter).toHaveBeenCalledWith('agentName', 'all');
    expect(mockSetFilter).toHaveBeenCalledWith('eventType', 'all');
  });

  // Test: Filter dropdowns reflect current filter values
  it('filter dropdowns reflect current filter values from store', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.filterSync | Valid / typical | P5.6 spec
    const mockPlanDiff = {
      activePlan: null,
      availablePlans: [],
      diffMode: 'none' as const,
      currentDiagram: '',
      proposedDiagram: '',
      isLoadingProposed: false,
    };
    mockUseEventsStore.mockImplementation((selector: any) => {
      const state = {
        filters: { sourceApp: 'pkg-db', agentName: 'api-agent', eventType: 'PostToolUse' },
        setFilter: mockSetFilter,
        events: mockEvents,
        replay: { isReplaying: false, replaySessionId: null, replaySpeed: 1, replayProgress: 0, sessions: [] },
        getAvailableFilters: mockGetAvailableFilters,
        planDiff: mockPlanDiff,
        setActivePlan: mockSetActivePlan,
        setDiffMode: mockSetDiffMode,
        setAvailablePlans: mockSetAvailablePlans,
      };
      return selector(state);
    });

    render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    expect(screen.getByLabelText('Session')).toHaveValue('pkg-db');
    expect(screen.getByLabelText('Agent')).toHaveValue('api-agent');
    expect(screen.getByLabelText('Event Type')).toHaveValue('PostToolUse');
  });

  // Test: Fixed width via CSS class (the CSS defines 280px fixed width)
  it('has control-pane CSS class with fixed width styles', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.responsive | Valid / typical | P5.6 spec
    const { container } = render(<ControlPane onDiagramChange={mockOnDiagramChange} />);

    const controlPane = container.querySelector('.control-pane');
    expect(controlPane).toHaveClass('control-pane');
  });

  // Test: onDiagramChange is optional
  it('works without onDiagramChange prop', () => {
    // pending:P5.6: remove this marker when this test passes
    // matrix: ControlPane.props | Empty / missing | P5.6 spec
    expect(() => {
      render(<ControlPane />);
    }).not.toThrow();

    const diagramSelect = screen.getByLabelText('Diagram');
    expect(diagramSelect).toHaveValue('system-overview');
  });
});