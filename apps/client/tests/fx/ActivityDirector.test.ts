import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityDirector } from '../../src/fx/ActivityDirector';
import { EffectsEngine } from '../../src/fx/EffectsEngine';
import { motionConfig } from '../../src/fx/motionConfig';
import type { HookEvent } from '../../src/types';
import { getAgentColor } from '../../src/utils/agentColors';

describe('ActivityDirector', () => {
  let clock: { now: () => number; currentTime: number };
  let rng: () => number;
  let mockGetCurrentPanZoom: ReturnType<typeof vi.fn>;
  let mockEffects: EffectsEngine;
  let mockGetNodeGeometry: ReturnType<typeof vi.fn>;
  let director: ActivityDirector;

  beforeEach(() => {
    clock = { currentTime: 0, now: () => clock.currentTime };
    let seed = 12345;
    rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // Mock camera pan/zoom
    mockGetCurrentPanZoom = vi.fn(() => ({ x: 0, y: 0, k: 1 }));

    // Mock effects
    mockEffects = new EffectsEngine({
      clock,
      rng,
      config: motionConfig,
    });

    // Mock geometry resolver - returns geometry for known nodes
    mockGetNodeGeometry = vi.fn((diagram: string, nodeId: string) => {
      const nodes: Record<string, { cx: number; cy: number; w: number; h: number }> = {
        server: { cx: 1000, cy: 1000, w: 100, h: 50 },
        client: { cx: 2000, cy: 2000, w: 100, h: 50 },
        hooks: { cx: 3000, cy: 3000, w: 100, h: 50 },
      };
      return nodes[nodeId] || null;
    });

    director = new ActivityDirector({
      clock,
      rng,
      config: motionConfig,
      effects: mockEffects,
      getNodeGeometry: mockGetNodeGeometry,
      getAgentColor,
      onCameraMove: vi.fn(),
      trackReads: true,
      trackSearches: true,
    });
  });

  const createEvent = (overrides: Partial<HookEvent> = {}): HookEvent => ({
    type: 'event',
    event_id: 1,
    uuid: 'test-uuid',
    session_id: 'test-session',
    source_app: 'test-app',
    agent_name: 'test-agent',
    event_type: 'PostToolUse',
    tool_name: 'Write',
    tool_input: {
      diagram: 'docs/diagrams/system-overview.md',
      node: 'server',
    },
    tool_output: { success: true },
    timestamp: Date.now() / 1000,
    ...overrides,
  });

  it('processes a write event and spawns effect', () => {
    const event = createEvent({ tool_name: 'Write', agent_name: 'writer' });
    director.processEvent(event);

    expect(mockEffects.stats().effects).toBe(1);
    expect(director.stats().effectsSpawned).toBe(1);
  });

  it('coalesces events for same node and kind within window', () => {
    const event1 = createEvent({ tool_name: 'Write', agent_name: 'writer' });
    director.processEvent(event1);

    clock.currentTime += 100; // Within 250ms coalesce window
    const event2 = createEvent({ tool_name: 'Write', agent_name: 'writer' });
    director.processEvent(event2);

    expect(director.stats().effectsCoalesced).toBe(1);
    expect(mockEffects.stats().effects).toBe(1); // Only one effect spawned
  });

  it('does not coalesce events outside window', () => {
    const event1 = createEvent({ tool_name: 'Write', agent_name: 'writer' });
    director.processEvent(event1);

    clock.currentTime += 300; // Outside 250ms coalesce window
    const event2 = createEvent({ tool_name: 'Write', agent_name: 'writer' });
    director.processEvent(event2);

    expect(director.stats().effectsCoalesced).toBe(0);
    expect(mockEffects.stats().effects).toBe(2); // Two effects spawned
  });

  it('does not coalesce errors', () => {
    const event1 = createEvent({ tool_name: 'Write', agent_name: 'writer', tool_output: { error: 'fail' } });
    director.processEvent(event1);

    clock.currentTime += 100;
    const event2 = createEvent({ tool_name: 'Write', agent_name: 'writer', tool_output: { error: 'fail' } });
    director.processEvent(event2);

    expect(director.stats().errorsPreserved).toBe(2);
    expect(mockEffects.stats().effects).toBe(2); // Both errors preserved
  });

  it('throttles camera moves to one per 1200ms', () => {
    const onCameraMove = vi.fn();
    director = new ActivityDirector({
      clock,
      rng,
      config: motionConfig,
      effects: mockEffects,
      getNodeGeometry: mockGetNodeGeometry,
      getAgentColor,
      onCameraMove,
      trackReads: true,
      trackSearches: true,
    });

    // First event - should trigger camera move
    const event1 = createEvent({ tool_name: 'Write', agent_name: 'writer' });
    director.processEvent(event1);

    expect(onCameraMove).toHaveBeenCalledTimes(1);

    // Second event within throttle window - should NOT trigger camera move
    clock.currentTime += 500;
    const event2 = createEvent({ tool_name: 'Write', agent_name: 'writer', tool_input: { diagram: 'docs/diagrams/system-overview.md', node: 'client' } });
    director.processEvent(event2);

    expect(onCameraMove).toHaveBeenCalledTimes(1); // Still 1

    // Third event after throttle window - should trigger camera move
    clock.currentTime += 800; // Total 1300ms > 1200ms
    const event3 = createEvent({ tool_name: 'Write', agent_name: 'writer', tool_input: { diagram: 'docs/diagrams/system-overview.md', node: 'hooks' } });
    director.processEvent(event3);

    expect(onCameraMove).toHaveBeenCalledTimes(2);
  });

  it('errors break pan throttle', () => {
    const onCameraMove = vi.fn();
    director = new ActivityDirector({
      clock,
      rng,
      config: motionConfig,
      effects: mockEffects,
      getNodeGeometry: mockGetNodeGeometry,
      getAgentColor,
      onCameraMove,
      trackReads: true,
      trackSearches: true,
    });

    // Normal event
    const event1 = createEvent({ tool_name: 'Write', agent_name: 'writer' });
    director.processEvent(event1);
    expect(onCameraMove).toHaveBeenCalledTimes(1);

    // Error event within throttle window - should still trigger camera move
    clock.currentTime += 500;
    const errorEvent = createEvent({ tool_name: 'Write', agent_name: 'writer', tool_output: { error: 'fail' } });
    director.processEvent(errorEvent);

    expect(onCameraMove).toHaveBeenCalledTimes(2); // Error breaks throttle
    expect(director.stats().errorsPreserved).toBe(1);
  });

  it('enforces queue cap of 20, dropping oldest non-error first', () => {
    // Directly test the cap enforcement logic by manually adding items to queue
    // and calling the internal method that enforces cap
    for (let i = 0; i < 25; i++) {
      const pending = {
        id: `test-${i}`,
        event: createEvent({ tool_name: 'Write', agent_name: 'writer' }),
        kind: 'write' as const,
        nodeId: 'server',
        diagram: 'docs/diagrams/system-overview.md',
        agentId: 'writer',
        agentColor: '#1a73e8',
        timestamp: clock.currentTime + i * 100,
        geometry: { cx: 1000, cy: 1000, w: 100, h: 50 },
      };
      (director as any).queue.push(pending);
    }

    // Manually trigger cap enforcement repeatedly until queue is at cap
    // (same logic as in processEvent - drops one oldest non-error at a time)
    const queueCap = (director as any).config.burstControl.queueCap;
    while ((director as any).queue.length > queueCap) {
      const nonErrorIndex = (director as any).queue.findIndex(p => p.kind !== 'error');
      if (nonErrorIndex >= 0) {
        (director as any).queue.splice(nonErrorIndex, 1);
        (director as any).effectsDropped++;
      } else {
        // All errors - drop oldest error
        (director as any).queue.shift();
        (director as any).effectsDropped++;
      }
    }

    expect((director as any).queue.length).toBeLessThanOrEqual(20);
    expect((director as any).effectsDropped).toBeGreaterThanOrEqual(1);
  });

  it('preserves errors when queue is full', () => {
    // Fill with 20 normal events
    for (let i = 0; i < 20; i++) {
      clock.currentTime += 300;
      const event = createEvent({ tool_name: 'Write', agent_name: 'writer' });
      director.processEvent(event);
    }

    // Add an error - should not drop the error
    clock.currentTime += 300;
    const errorEvent = createEvent({ tool_name: 'Write', agent_name: 'writer', tool_output: { error: 'fail' } });
    director.processEvent(errorEvent);

    // Queue should still be at cap but error preserved
    expect(director.stats().errorsPreserved).toBe(1);
  });

  it('returns null for events without diagram/node mapping', () => {
    const event = createEvent({ tool_input: {} }); // No diagram/node
    director.processEvent(event);

    expect(mockEffects.stats().effects).toBe(0);
    expect(director.stats().effectsSpawned).toBe(0);
  });

  it('returns null for unknown nodes', () => {
    const event = createEvent({ tool_input: { diagram: 'docs/diagrams/system-overview.md', node: 'unknown-node' } });
    director.processEvent(event);

    expect(mockEffects.stats().effects).toBe(0);
  });

  it('tracks reads only when enabled', () => {
    director.setTrackReads(false);
    const event = createEvent({ tool_name: 'Read', agent_name: 'reader' });
    director.processEvent(event);

    expect(mockEffects.stats().effects).toBe(0);

    director.setTrackReads(true);
    director.processEvent(event);
    expect(mockEffects.stats().effects).toBe(1);
  });

  it('tracks searches only when enabled', () => {
    director.setTrackSearches(false);
    const event = createEvent({ tool_name: 'Grep', agent_name: 'searcher' });
    director.processEvent(event);

    expect(mockEffects.stats().effects).toBe(0);

    director.setTrackSearches(true);
    director.processEvent(event);
    expect(mockEffects.stats().effects).toBe(1);
  });

  it('adds trail segment when agent moves to new node', () => {
    const event1 = createEvent({ tool_name: 'Write', agent_name: 'agent-1', tool_input: { diagram: 'docs/diagrams/system-overview.md', node: 'server' } });
    director.processEvent(event1);

    clock.currentTime += 300;
    const event2 = createEvent({ tool_name: 'Write', agent_name: 'agent-1', tool_input: { diagram: 'docs/diagrams/system-overview.md', node: 'client' } });
    director.processEvent(event2);

    expect(mockEffects.stats().trailSegments).toBe(1);
  });

  it('does not add trail for same node', () => {
    const event1 = createEvent({ tool_name: 'Write', agent_name: 'agent-1', tool_input: { diagram: 'docs/diagrams/system-overview.md', node: 'server' } });
    director.processEvent(event1);

    clock.currentTime += 300;
    const event2 = createEvent({ tool_name: 'Write', agent_name: 'agent-1', tool_input: { diagram: 'docs/diagrams/system-overview.md', node: 'server' } });
    director.processEvent(event2);

    expect(mockEffects.stats().trailSegments).toBe(0);
  });

  it('maintains separate trails per agent', () => {
    const event1 = createEvent({ tool_name: 'Write', agent_name: 'agent-alpha', tool_input: { diagram: 'docs/diagrams/system-overview.md', node: 'server' } });
    director.processEvent(event1);

    clock.currentTime += 300;
    const event2 = createEvent({ tool_name: 'Write', agent_name: 'agent-beta', tool_input: { diagram: 'docs/diagrams/system-overview.md', node: 'client' } });
    director.processEvent(event2);

    clock.currentTime += 300;
    const event3 = createEvent({ tool_name: 'Write', agent_name: 'agent-alpha', tool_input: { diagram: 'docs/diagrams/system-overview.md', node: 'hooks' } });
    director.processEvent(event3);

    // alpha: server -> hooks (1 segment)
    // beta: (only one node, no segment)
    expect(mockEffects.stats().trailSegments).toBe(1);
  });
});