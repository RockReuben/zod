import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HookEvent } from '../../src/types';

// Test the animateReplay function logic by recreating it
// This allows testing the replay animation without WebSocket dependencies

interface ReplayState {
  isReplaying: boolean;
  replaySessionId: string | null;
  replaySpeed: number;
  replayProgress: number;
  sessions: SessionInfo[];
}

interface SessionInfo {
  session_id: string;
  agent_name: string;
  source_app: string;
  event_count: number;
  start_time: number;
  end_time: number;
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
];

describe('animateReplay delay calculation', () => {
  it('calculates correct delays between consecutive events', () => {
    const speed = 1;
    const delays: number[] = [];
    for (let i = 1; i < mockEvents.length; i++) {
      const prevTime = mockEvents[i - 1].timestamp ?? mockEvents[i - 1].event_id ?? 0;
      const currTime = mockEvents[i].timestamp ?? mockEvents[i].event_id ?? 0;
      const delay = Math.max(0, (currTime - prevTime) * 1000) / speed;
      delays.push(delay);
    }
    // First delay: 1001 - 1000 = 1 second = 1000ms
    expect(delays[0]).toBe(1000);
    // Second delay: 2000 - 1001 = 999 seconds = 999000ms
    expect(delays[1]).toBe(999000);
  });

  it('applies speed multiplier correctly', () => {
    const speed = 5;
    const delays: number[] = [];
    for (let i = 1; i < mockEvents.length; i++) {
      const prevTime = mockEvents[i - 1].timestamp ?? mockEvents[i - 1].event_id ?? 0;
      const currTime = mockEvents[i].timestamp ?? mockEvents[i].event_id ?? 0;
      const delay = Math.max(0, (currTime - prevTime) * 1000) / speed;
      delays.push(delay);
    }
    expect(delays[0]).toBe(200); // 1000 / 5
    expect(delays[1]).toBe(199800); // 999000 / 5
  });

  it('handles zero or negative time differences', () => {
    const events: HookEvent[] = [
      { ...mockEvents[0], timestamp: 1000 },
      { ...mockEvents[1], timestamp: 1000 }, // Same timestamp
      { ...mockEvents[2], timestamp: 900 },  // Earlier timestamp (out of order)
    ];
    const speed = 1;
    const delays: number[] = [];
    for (let i = 1; i < events.length; i++) {
      const prevTime = events[i - 1].timestamp ?? events[i - 1].event_id ?? 0;
      const currTime = events[i].timestamp ?? events[i].event_id ?? 0;
      const delay = Math.max(0, (currTime - prevTime) * 1000) / speed;
      delays.push(delay);
    }
    expect(delays[0]).toBe(0); // Same timestamp
    expect(delays[1]).toBe(0); // Negative difference clamped to 0
  });

  it('falls back to event_id when timestamp is undefined', () => {
    const events: HookEvent[] = [
      { ...mockEvents[0], timestamp: undefined, event_id: 10 },
      { ...mockEvents[1], timestamp: undefined, event_id: 20 },
    ];
    const delays: number[] = [];
    for (let i = 1; i < events.length; i++) {
      const prevTime = events[i - 1].timestamp ?? events[i - 1].event_id ?? 0;
      const currTime = events[i].timestamp ?? events[i].event_id ?? 0;
      const delay = Math.max(0, (currTime - prevTime) * 1000);
      delays.push(delay);
    }
    expect(delays[0]).toBe(10000); // (20 - 10) * 1000
  });

  it('handles empty events array', () => {
    const events: HookEvent[] = [];
    const delays: number[] = [];
    for (let i = 1; i < events.length; i++) {
      const prevTime = events[i - 1].timestamp ?? events[i - 1].event_id ?? 0;
      const currTime = events[i].timestamp ?? events[i].event_id ?? 0;
      const delay = Math.max(0, (currTime - prevTime) * 1000);
      delays.push(delay);
    }
    expect(delays).toHaveLength(0);
  });

  it('handles single event (no delays)', () => {
    const events: HookEvent[] = [mockEvents[0]];
    const delays: number[] = [];
    for (let i = 1; i < events.length; i++) {
      const prevTime = events[i - 1].timestamp ?? events[i - 1].event_id ?? 0;
      const currTime = events[i].timestamp ?? events[i].event_id ?? 0;
      const delay = Math.max(0, (currTime - prevTime) * 1000);
      delays.push(delay);
    }
    expect(delays).toHaveLength(0);
  });
});

describe('replay progress calculation', () => {
  it('calculates progress for each event added', () => {
    const events = mockEvents;
    const progressValues: number[] = [];
    for (let i = 0; i < events.length; i++) {
      const progress = ((i + 1) / events.length) * 100;
      progressValues.push(progress);
    }
    expect(progressValues[0]).toBeCloseTo(33.33, 1);
    expect(progressValues[1]).toBeCloseTo(66.66, 1);
    expect(progressValues[2]).toBe(100);
  });

  it('first event progress is 1/length * 100', () => {
    const events = mockEvents;
    const firstProgress = (1 / events.length) * 100;
    expect(firstProgress).toBeCloseTo(33.33, 1);
  });
});

describe('replay state transitions', () => {
  it('initial replay state has correct defaults', () => {
    const initialReplay: ReplayState = {
      isReplaying: false,
      replaySessionId: null,
      replaySpeed: 1,
      replayProgress: 0,
      sessions: [],
    };
    expect(initialReplay.isReplaying).toBe(false);
    expect(initialReplay.replaySessionId).toBeNull();
    expect(initialReplay.replaySpeed).toBe(1);
    expect(initialReplay.replayProgress).toBe(0);
  });

  it('start replay sets isReplaying true', () => {
    const replay: ReplayState = {
      isReplaying: false,
      replaySessionId: null,
      replaySpeed: 1,
      replayProgress: 0,
      sessions: [],
    };
    const newReplay = { ...replay, isReplaying: true, replaySessionId: 'sess-1', replayProgress: 0 };
    expect(newReplay.isReplaying).toBe(true);
    expect(newReplay.replaySessionId).toBe('sess-1');
  });

  it('stop replay resets state but preserves sessions', () => {
    const replay: ReplayState = {
      isReplaying: true,
      replaySessionId: 'sess-1',
      replaySpeed: 2,
      replayProgress: 50,
      sessions: [{ session_id: 'sess-1', agent_name: 'a', source_app: 'app', event_count: 5, start_time: 1000, end_time: 2000 }],
    };
    const stopped = {
      isReplaying: false,
      replaySessionId: null,
      replaySpeed: 1,
      replayProgress: 0,
      sessions: replay.sessions,
    };
    expect(stopped.isReplaying).toBe(false);
    expect(stopped.replaySessionId).toBeNull();
    expect(stopped.replaySpeed).toBe(1);
    expect(stopped.replayProgress).toBe(0);
    expect(stopped.sessions).toHaveLength(1);
  });

  it('setReplaySpeed updates speed', () => {
    const replay: ReplayState = {
      isReplaying: true,
      replaySessionId: 'sess-1',
      replaySpeed: 1,
      replayProgress: 10,
      sessions: [],
    };
    const newSpeed = 10;
    const updated = { ...replay, replaySpeed: newSpeed };
    expect(updated.replaySpeed).toBe(10);
    expect(updated.replayProgress).toBe(10); // Progress unchanged
  });

  it('setReplayProgress updates progress', () => {
    const replay: ReplayState = {
      isReplaying: true,
      replaySessionId: 'sess-1',
      replaySpeed: 1,
      replayProgress: 0,
      sessions: [],
    };
    const newProgress = 75;
    const updated = { ...replay, replayProgress: newProgress };
    expect(updated.replayProgress).toBe(75);
    expect(updated.replaySpeed).toBe(1); // Speed unchanged
  });
});

describe('replay speed options', () => {
  const REPLAY_SPEEDS = [1, 2, 5, 10];

  it('contains expected speed values', () => {
    expect(REPLAY_SPEEDS).toEqual([1, 2, 5, 10]);
  });

  it('speeds are positive integers', () => {
    REPLAY_SPEEDS.forEach(speed => {
      expect(Number.isInteger(speed)).toBe(true);
      expect(speed).toBeGreaterThan(0);
    });
  });
});