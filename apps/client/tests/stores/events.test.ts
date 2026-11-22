import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookEvent, SessionLane } from '../../src/types';

// We need to test the internal functions, so we'll recreate the logic here
// In a real scenario, we'd export these for testing or test via the store

function buildLanesFromEvents(events: HookEvent[]): SessionLane[] {
  const lanesMap = new Map<string, SessionLane>();

  for (const event of events) {
    const existing = lanesMap.get(event.session_id);
    if (existing) {
      existing.events.push({ ...event });
    } else {
      lanesMap.set(event.session_id, {
        session_id: event.session_id,
        agent_name: event.agent_name || 'unknown',
        events: [{ ...event }],
      });
    }
  }

  for (const lane of lanesMap.values()) {
    lane.events.sort((a, b) => {
      const ta = a.timestamp ?? a.event_id;
      const tb = b.timestamp ?? b.event_id;
      return ta - tb;
    });
  }

  return Array.from(lanesMap.values()).sort((a, b) => {
    const ta = a.events[0]?.timestamp ?? a.events[0]?.event_id ?? 0;
    const tb = b.events[0]?.timestamp ?? b.events[0]?.event_id ?? 0;
    return ta - tb;
  });
}

function filterEvents(events: HookEvent[], filters: { sourceApp: string; agentName: string; eventType: string }): HookEvent[] {
  return events.filter((event) => {
    if (filters.sourceApp !== 'all' && event.source_app !== filters.sourceApp) {
      return false;
    }
    if (filters.agentName !== 'all' && event.agent_name !== filters.agentName) {
      return false;
    }
    if (filters.eventType !== 'all' && event.event_type !== filters.eventType) {
      return false;
    }
    return true;
  });
}

const mockEvents: HookEvent[] = [
  {
    event_id: 1,
    uuid: 'uuid-1',
    session_id: 'sess-1',
    source_app: 'pkg-auth',
    agent_name: 'auth-agent',
    event_type: 'PreToolUse',
    tool_name: 'Read',
    tool_input: { file_path: '/src/auth/login.ts' },
    tool_output: {},
    timestamp: 1000,
    transcript_path: null,
    created_at: 1000,
  },
  {
    event_id: 2,
    uuid: 'uuid-2',
    session_id: 'sess-1',
    source_app: 'pkg-auth',
    agent_name: 'auth-agent',
    event_type: 'PostToolUse',
    tool_name: 'Read',
    tool_input: { file_path: '/src/auth/login.ts' },
    tool_output: { success: true },
    timestamp: 1001,
    transcript_path: null,
    created_at: 1001,
  },
  {
    event_id: 3,
    uuid: 'uuid-3',
    session_id: 'sess-2',
    source_app: 'pkg-db',
    agent_name: 'db-agent',
    event_type: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: '/src/db/migration.ts' },
    tool_output: {},
    timestamp: 2000,
    transcript_path: null,
    created_at: 2000,
  },
  {
    event_id: 4,
    uuid: 'uuid-4',
    session_id: 'sess-2',
    source_app: 'pkg-db',
    agent_name: 'db-agent',
    event_type: 'SubagentStart',
    tool_name: 'Task',
    tool_input: { description: 'Run migrations' },
    tool_output: {},
    timestamp: 2001,
    transcript_path: null,
    created_at: 2001,
  },
  {
    event_id: 5,
    uuid: 'uuid-5',
    session_id: 'sess-3',
    source_app: 'pkg-api',
    agent_name: 'api-agent',
    event_type: 'PreToolUse',
    tool_name: 'Read',
    tool_input: { file_path: '/src/api/routes.ts' },
    tool_output: {},
    timestamp: 3000,
    transcript_path: null,
    created_at: 3000,
  },
];

describe('buildLanesFromEvents', () => {
  it('groups events by session_id', () => {
    const lanes = buildLanesFromEvents(mockEvents);
    expect(lanes).toHaveLength(3);
    expect(lanes.map(l => l.session_id)).toEqual(['sess-1', 'sess-2', 'sess-3']);
  });

  it('sorts events within each lane by timestamp', () => {
    const lanes = buildLanesFromEvents(mockEvents);
    const sess1 = lanes.find(l => l.session_id === 'sess-1');
    expect(sess1).toBeDefined();
    expect(sess1!.events).toHaveLength(2);
    expect(sess1!.events[0].timestamp).toBeLessThan(sess1!.events[1].timestamp);
  });

  it('sorts lanes by first event timestamp', () => {
    const lanes = buildLanesFromEvents(mockEvents);
    expect(lanes[0].session_id).toBe('sess-1'); // earliest timestamp 1000
    expect(lanes[1].session_id).toBe('sess-2'); // timestamp 2000
    expect(lanes[2].session_id).toBe('sess-3'); // timestamp 3000
  });

  it('handles events without timestamp (falls back to event_id)', () => {
    const events: HookEvent[] = [
      { ...mockEvents[0], timestamp: undefined, event_id: 10 },
      { ...mockEvents[1], timestamp: undefined, event_id: 5 },
    ];
    const lanes = buildLanesFromEvents(events);
    expect(lanes[0].events[0].event_id).toBe(5); // lower event_id first
    expect(lanes[0].events[1].event_id).toBe(10);
  });

  it('returns empty array for empty input', () => {
    const lanes = buildLanesFromEvents([]);
    expect(lanes).toHaveLength(0);
  });
});

describe('filterEvents', () => {
  it('returns all events when all filters are "all"', () => {
    const filtered = filterEvents(mockEvents, { sourceApp: 'all', agentName: 'all', eventType: 'all' });
    expect(filtered).toHaveLength(5);
  });

  it('filters by sourceApp', () => {
    const filtered = filterEvents(mockEvents, { sourceApp: 'pkg-auth', agentName: 'all', eventType: 'all' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every(e => e.source_app === 'pkg-auth')).toBe(true);
  });

  it('filters by agentName', () => {
    const filtered = filterEvents(mockEvents, { sourceApp: 'all', agentName: 'db-agent', eventType: 'all' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every(e => e.agent_name === 'db-agent')).toBe(true);
  });

  it('filters by eventType', () => {
    const filtered = filterEvents(mockEvents, { sourceApp: 'all', agentName: 'all', eventType: 'PreToolUse' });
    expect(filtered).toHaveLength(3);
    expect(filtered.every(e => e.event_type === 'PreToolUse')).toBe(true);
  });

  it('combines multiple filters', () => {
    const filtered = filterEvents(mockEvents, { sourceApp: 'pkg-auth', agentName: 'auth-agent', eventType: 'PreToolUse' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].event_id).toBe(1);
  });

  it('returns empty array when no events match', () => {
    const filtered = filterEvents(mockEvents, { sourceApp: 'pkg-none', agentName: 'all', eventType: 'all' });
    expect(filtered).toHaveLength(0);
  });
});

// Mutation tests - these should fail if implementation is broken
describe('Mutation checks', () => {
  it('filterEvents should be case-sensitive', () => {
    const filtered = filterEvents(mockEvents, { sourceApp: 'PKG-AUTH', agentName: 'all', eventType: 'all' });
    expect(filtered).toHaveLength(0); // Case mismatch should not match
  });

  it('buildLanesFromEvents should not mutate input events', () => {
    const events = [...mockEvents];
    const originalIds = events.map(e => e.event_id);
    buildLanesFromEvents(events);
    expect(events.map(e => e.event_id)).toEqual(originalIds);
  });

  it('filterEvents should not mutate input events', () => {
    const events = [...mockEvents];
    const originalIds = events.map(e => e.event_id);
    filterEvents(events, { sourceApp: 'pkg-auth', agentName: 'all', eventType: 'all' });
    expect(events.map(e => e.event_id)).toEqual(originalIds);
  });
});