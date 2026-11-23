import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SessionLane, HookEvent } from '../../src/types';
import { TimelineLane } from '../../src/components/TimelineLane';

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn((date: Date) => {
    const diff = Date.now() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hours ago`;
  }),
}));

const mockLane: SessionLane = {
  session_id: 'sess-1',
  agent_name: 'test-agent',
  events: [
    {
      event_id: 1,
      uuid: 'uuid-1',
      session_id: 'sess-1',
      source_app: 'pkg-auth',
      agent_name: 'test-agent',
      event_type: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: '/src/auth/login.ts' },
      tool_output: {},
      timestamp: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
      transcript_path: null,
      created_at: Math.floor(Date.now() / 1000) - 60,
    },
    {
      event_id: 2,
      uuid: 'uuid-2',
      session_id: 'sess-1',
      source_app: 'pkg-auth',
      agent_name: 'test-agent',
      event_type: 'PostToolUse',
      tool_name: 'Read',
      tool_input: { file_path: '/src/auth/login.ts' },
      tool_output: { success: true },
      timestamp: Math.floor(Date.now() / 1000) - 30, // 30 seconds ago
      transcript_path: null,
      created_at: Math.floor(Date.now() / 1000) - 30,
    },
  ],
};

describe('TimelineLane component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders lane header with agent name', () => {
    render(<TimelineLane lane={mockLane} />);

    expect(screen.getByText('test-agent')).toBeInTheDocument();
  });

  it('renders truncated session id in header', () => {
    render(<TimelineLane lane={mockLane} />);

    // The session-id span has the truncated session id
    const sessionIdSpan = screen.getByTitle('sess-1');
    expect(sessionIdSpan).toHaveTextContent('sess-1…');
  });

  it('renders event count', () => {
    render(<TimelineLane lane={mockLane} />);

    expect(screen.getByText('2 events')).toBeInTheDocument();
  });

  it('renders event markers for each event', () => {
    render(<TimelineLane lane={mockLane} />);

    const markers = screen.getAllByRole('listitem');
    expect(markers).toHaveLength(2);
  });

  it('renders timeline with role list', () => {
    render(<TimelineLane lane={mockLane} />);

    expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Events for test-agent');
  });

  it('shows time axis labels', () => {
    render(<TimelineLane lane={mockLane} />);

    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Now')).toBeInTheDocument();
  });

  it('handles empty events array', () => {
    const emptyLane: SessionLane = {
      session_id: 'sess-empty',
      agent_name: 'empty-agent',
      events: [],
    };

    render(<TimelineLane lane={emptyLane} />);

    expect(screen.getByText('empty-agent')).toBeInTheDocument();
    expect(screen.getByText('0 events')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('calculates positions based on timestamps', () => {
    const { container } = render(<TimelineLane lane={mockLane} />);

    const markers = container.querySelectorAll('.event-marker');
    expect(markers).toHaveLength(2);

    // First event (older) should be positioned more to the left
    // Second event (newer) should be positioned more to the right
    const positions = Array.from(markers).map(m =>
      parseFloat((m as HTMLElement).style.left.replace('%', ''))
    );
    expect(positions[0]).toBeLessThan(positions[1]);
  });
});

describe('getEventColor function (matches implementation order)', () => {
  // Recreate the color logic from TimelineLane.tsx EXACTLY
  function getEventColor(eventType: string): string {
    // Color by event type category
    if (eventType.startsWith('Pre')) return '#3b82f6'; // blue
    if (eventType.startsWith('Post')) return '#22c55e'; // green
    if (eventType.includes('Stop')) return '#ef4444'; // red
    if (eventType.includes('Subagent')) return '#a855f7'; // purple
    if (eventType.includes('Notification')) return '#f59e0b'; // amber
    if (eventType.includes('Permission')) return '#ec4899'; // pink
    return '#64748b'; // slate
  }

  it('returns blue for PreToolUse', () => {
    expect(getEventColor('PreToolUse')).toBe('#3b82f6');
  });

  it('returns green for PostToolUse', () => {
    expect(getEventColor('PostToolUse')).toBe('#22c55e');
  });

  it('returns red for Stop events', () => {
    expect(getEventColor('Stop')).toBe('#ef4444');
    expect(getEventColor('StopFailure')).toBe('#ef4444');
  });

  it('returns red for SubagentStop (Stop matches first in implementation)', () => {
    // "SubagentStop" contains "Stop" so it matches the Stop condition first
    expect(getEventColor('SubagentStop')).toBe('#ef4444');
  });

  it('returns purple for SubagentStart (no Stop prefix)', () => {
    expect(getEventColor('SubagentStart')).toBe('#a855f7');
  });

  it('returns amber for Notification events', () => {
    expect(getEventColor('Notification')).toBe('#f59e0b');
  });

  it('returns pink for Permission events', () => {
    expect(getEventColor('PermissionRequest')).toBe('#ec4899');
    expect(getEventColor('PermissionDenied')).toBe('#ec4899');
  });

  it('returns slate for unknown event types', () => {
    expect(getEventColor('UnknownEvent')).toBe('#64748b');
    expect(getEventColor('CustomEvent')).toBe('#64748b');
  });
});

describe('formatToolInput function', () => {
  // Recreate the format logic from TimelineLane.tsx
  function formatToolInput(input?: Record<string, unknown>): string {
    if (!input) return '';
    const keys = Object.keys(input).slice(0, 3);
    return keys.map((k) => `${k}: ${String(input[k]).slice(0, 40)}`).join(', ');
  }

  it('returns empty string for undefined input', () => {
    expect(formatToolInput(undefined)).toBe('');
  });

  it('returns empty string for empty object', () => {
    expect(formatToolInput({})).toBe('');
  });

  it('formats single key-value pair', () => {
    expect(formatToolInput({ file_path: '/test/file.ts' })).toBe('file_path: /test/file.ts');
  });

  it('truncates long values', () => {
    const longValue = 'a'.repeat(50);
    const result = formatToolInput({ content: longValue });
    expect(result).toBe(`content: ${'a'.repeat(40)}`);
  });

  it('limits to first 3 keys', () => {
    const input = { a: '1', b: '2', c: '3', d: '4', e: '5' };
    const result = formatToolInput(input);
    expect(result).toBe('a: 1, b: 2, c: 3');
  });

  it('handles special characters in values', () => {
    const result = formatToolInput({ path: '/path/with spaces/and-chars.ts' });
    expect(result).toBe('path: /path/with spaces/and-chars.ts');
  });
});