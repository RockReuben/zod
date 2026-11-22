import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FilterBar } from '../../src/components/FilterBar';
import { useEventsStore } from '../../src/stores/events';
import { HookEvent } from '../../src/types';

// Mock the store
vi.mock('../../src/stores/events', () => ({
  useEventsStore: vi.fn(),
}));

const mockEvents: HookEvent[] = [
  {
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
];

describe('FilterBar component', () => {
  const mockSetFilter = vi.fn();
  const mockResetFilters = vi.fn();
  const mockGetAvailableFilters = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAvailableFilters.mockReturnValue({
      sourceApps: ['pkg-auth', 'pkg-db', 'pkg-api'],
      agentNames: ['auth-agent', 'db-agent', 'api-agent'],
      eventTypes: ['PreToolUse', 'PostToolUse', 'Notification'],
    });

    (useEventsStore as any).mockImplementation((selector: any) => {
      const state = {
        filters: { sourceApp: 'all', agentName: 'all', eventType: 'all' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getAvailableFilters: mockGetAvailableFilters,
      };
      return selector(state);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders three filter dropdowns', () => {
    render(<FilterBar />);

    expect(screen.getByLabelText('Package:')).toBeInTheDocument();
    expect(screen.getByLabelText('Agent:')).toBeInTheDocument();
    expect(screen.getByLabelText('Event Type:')).toBeInTheDocument();
  });

  it('shows all available options in Package dropdown', () => {
    render(<FilterBar />);

    const packageSelect = screen.getByLabelText('Package:');
    expect(packageSelect).toHaveValue('all');
    expect(screen.getByText('All Packages (3)')).toBeInTheDocument();
    expect(screen.getByText('pkg-auth')).toBeInTheDocument();
    expect(screen.getByText('pkg-db')).toBeInTheDocument();
    expect(screen.getByText('pkg-api')).toBeInTheDocument();
  });

  it('shows all available options in Agent dropdown', () => {
    render(<FilterBar />);

    const agentSelect = screen.getByLabelText('Agent:');
    expect(agentSelect).toHaveValue('all');
    expect(screen.getByText('All Agents (3)')).toBeInTheDocument();
    expect(screen.getByText('auth-agent')).toBeInTheDocument();
    expect(screen.getByText('db-agent')).toBeInTheDocument();
    expect(screen.getByText('api-agent')).toBeInTheDocument();
  });

  it('shows all available options in Event Type dropdown', () => {
    render(<FilterBar />);

    const eventTypeSelect = screen.getByLabelText('Event Type:');
    expect(eventTypeSelect).toHaveValue('all');
    expect(screen.getByText('All Event Types (3)')).toBeInTheDocument();
    expect(screen.getByText('PreToolUse')).toBeInTheDocument();
    expect(screen.getByText('PostToolUse')).toBeInTheDocument();
    expect(screen.getByText('Notification')).toBeInTheDocument();
  });

  it('calls setFilter when Package selection changes', () => {
    render(<FilterBar />);

    const packageSelect = screen.getByLabelText('Package:');
    fireEvent.change(packageSelect, { target: { value: 'pkg-auth' } });

    expect(mockSetFilter).toHaveBeenCalledWith('sourceApp', 'pkg-auth');
  });

  it('calls setFilter when Agent selection changes', () => {
    render(<FilterBar />);

    const agentSelect = screen.getByLabelText('Agent:');
    fireEvent.change(agentSelect, { target: { value: 'db-agent' } });

    expect(mockSetFilter).toHaveBeenCalledWith('agentName', 'db-agent');
  });

  it('calls setFilter when Event Type selection changes', () => {
    render(<FilterBar />);

    const eventTypeSelect = screen.getByLabelText('Event Type:');
    fireEvent.change(eventTypeSelect, { target: { value: 'PreToolUse' } });

    expect(mockSetFilter).toHaveBeenCalledWith('eventType', 'PreToolUse');
  });

  it('does not show Clear filters button when all filters are "all"', () => {
    render(<FilterBar />);

    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
  });

  it('shows Clear filters button when any filter is active', () => {
    (useEventsStore as any).mockImplementation((selector: any) => {
      const state = {
        filters: { sourceApp: 'pkg-auth', agentName: 'all', eventType: 'all' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getAvailableFilters: mockGetAvailableFilters,
      };
      return selector(state);
    });

    render(<FilterBar />);

    expect(screen.getByText(/Clear filters/i)).toBeInTheDocument();
  });

  it('calls resetFilters when Clear filters button is clicked', () => {
    (useEventsStore as any).mockImplementation((selector: any) => {
      const state = {
        filters: { sourceApp: 'pkg-auth', agentName: 'all', eventType: 'all' },
        setFilter: mockSetFilter,
        resetFilters: mockResetFilters,
        getAvailableFilters: mockGetAvailableFilters,
      };
      return selector(state);
    });

    render(<FilterBar />);

    fireEvent.click(screen.getByText(/Clear filters/i));

    expect(mockResetFilters).toHaveBeenCalled();
  });

  it('has correct ARIA attributes', () => {
    render(<FilterBar />);

    const filterBar = screen.getByRole('search');
    expect(filterBar).toHaveAttribute('aria-label', 'Filter events');

    expect(screen.getByLabelText('Package:')).toHaveAttribute('id', 'filter-package');
    expect(screen.getByLabelText('Agent:')).toHaveAttribute('id', 'filter-agent');
    expect(screen.getByLabelText('Event Type:')).toHaveAttribute('id', 'filter-event-type');
  });

  it('handles empty filter lists', () => {
    mockGetAvailableFilters.mockReturnValue({
      sourceApps: [],
      agentNames: [],
      eventTypes: [],
    });

    render(<FilterBar />);

    expect(screen.getByText('All Packages (0)')).toBeInTheDocument();
    expect(screen.getByText('All Agents (0)')).toBeInTheDocument();
    expect(screen.getByText('All Event Types (0)')).toBeInTheDocument();
  });
});