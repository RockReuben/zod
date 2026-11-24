import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EffectsEngine } from '../../src/fx/EffectsEngine';
import { motionConfig } from '../../src/fx/motionConfig';
import type { NodeGeo } from '../../src/fx/nodeGeometry';

describe('EffectsEngine', () => {
  let clock: { now: () => number; currentTime: number };
  let rng: () => number;
  let engine: EffectsEngine;

  beforeEach(() => {
    clock = { currentTime: 0, now: () => clock.currentTime };
    let seed = 12345;
    rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    engine = new EffectsEngine({
      clock,
      rng,
      config: motionConfig,
    });
  });

  const createGeo = (overrides: Partial<NodeGeo> = {}): NodeGeo => ({
    cx: 100,
    cy: 100,
    w: 50,
    h: 30,
    ...overrides,
  });

  const createMockContext = () => {
    const drawCalls: string[] = [];
    const ctx = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt',
      ...vi.fn(),
    };
    return ctx as unknown as CanvasRenderingContext2D;
  };

  it('spawns write effect with particles', () => {
    engine.spawn({
      id: 'test-write',
      kind: 'write',
      agentId: 'agent-1',
      agentColor: '#1a73e8',
      geo: createGeo(),
    });

    const stats = engine.stats();
    expect(stats.effects).toBe(1);
    expect(stats.particles).toBeGreaterThanOrEqual(10);
    expect(stats.particles).toBeLessThanOrEqual(14);
  });

  it('spawns read effect with ripples', () => {
    engine.spawn({
      id: 'test-read',
      kind: 'read',
      agentId: 'agent-1',
      agentColor: '#00bcd4',
      geo: createGeo(),
    });

    const stats = engine.stats();
    expect(stats.effects).toBe(1);
    expect(stats.particles).toBe(2); // Two ripples
  });

  it('spawns search effect with spiral dots', () => {
    engine.spawn({
      id: 'test-search',
      kind: 'search',
      agentId: 'agent-1',
      agentColor: '#9c27b0',
      geo: createGeo(),
    });

    const stats = engine.stats();
    expect(stats.effects).toBe(1);
    expect(stats.particles).toBeGreaterThanOrEqual(25);
    expect(stats.particles).toBeLessThanOrEqual(35);
  });

  it('spawns error effect', () => {
    engine.spawn({
      id: 'test-error',
      kind: 'error',
      agentId: 'agent-1',
      agentColor: '#d32f2f',
      geo: createGeo(),
    });

    const stats = engine.stats();
    expect(stats.effects).toBe(1);
    expect(stats.particles).toBe(0); // Error uses flash/ring, not particles
  });

  it('spawns other effect', () => {
    engine.spawn({
      id: 'test-other',
      kind: 'other',
      agentId: 'agent-1',
      agentColor: '#757575',
      geo: createGeo(),
    });

    const stats = engine.stats();
    expect(stats.effects).toBe(1);
  });

  it('expires effects after their duration', () => {
    engine.spawn({
      id: 'test-write',
      kind: 'write',
      agentId: 'agent-1',
      agentColor: '#1a73e8',
      geo: createGeo(),
    });

    expect(engine.stats().effects).toBe(1);

    // Advance past write duration (800ms)
    clock.currentTime += 900;
    engine.tick();

    expect(engine.stats().effects).toBe(0);
  });

  it('error effect has lingering ring for 3s after main duration', () => {
    engine.spawn({
      id: 'test-error',
      kind: 'error',
      agentId: 'agent-1',
      agentColor: '#d32f2f',
      geo: createGeo(),
    });

    expect(engine.stats().effects).toBe(1);

    // Advance past error duration (700ms) but within ring duration (3000ms)
    clock.currentTime += 1000;
    expect(engine.tick()).toBe(true);
    expect(engine.stats().effects).toBe(1);

    // Advance past ring duration
    clock.currentTime += 3000;
    expect(engine.tick()).toBe(false);
    expect(engine.stats().effects).toBe(0);
  });

  it('tick returns false when idle', () => {
    expect(engine.tick()).toBe(false);
  });

  it('enforces particle cap', () => {
    // Spawn many effects that would exceed particle cap
    for (let i = 0; i < 50; i++) {
      engine.spawn({
        id: `test-${i}`,
        kind: 'write',
        agentId: 'agent-1',
        agentColor: '#1a73e8',
        geo: createGeo({ cx: i * 10 }),
      });
    }

    // Should not exceed maxParticles (300)
    expect(engine.stats().particles).toBeLessThanOrEqual(300);
  });

  it('adds trail segment between nodes', () => {
    const from = createGeo({ cx: 100, cy: 100 });
    const to = createGeo({ cx: 200, cy: 200 });

    engine.addTrail({
      agentId: 'agent-1',
      from,
      to,
      color: '#1a73e8',
    });

    expect(engine.stats().trailSegments).toBe(1);
  });

  it('does not add trail for same node', () => {
    const geo = createGeo({ cx: 100, cy: 100 });

    engine.addTrail({
      agentId: 'agent-1',
      from: geo,
      to: geo,
      color: '#1a73e8',
    });

    expect(engine.stats().trailSegments).toBe(0);
  });

  it('maintains ring buffer of 12 visits per agent', () => {
    for (let i = 0; i < 15; i++) {
      engine.addTrail({
        agentId: 'agent-1',
        from: createGeo({ cx: i * 10, cy: i * 10 }),
        to: createGeo({ cx: (i + 1) * 10, cy: (i + 1) * 10 }),
        color: '#1a73e8',
      });
    }

    const buffer = engine.getTrailBuffer('agent-1');
    expect(buffer.length).toBe(12); // Max buffer size
  });

  it('keeps separate trails per agent', () => {
    engine.addTrail({
      agentId: 'agent-alpha',
      from: createGeo({ cx: 100, cy: 100 }),
      to: createGeo({ cx: 200, cy: 200 }),
      color: '#1a73e8',
    });

    engine.addTrail({
      agentId: 'agent-beta',
      from: createGeo({ cx: 300, cy: 300 }),
      to: createGeo({ cx: 400, cy: 400 }),
      color: '#2e7d32',
    });

    expect(engine.getTrailBuffer('agent-alpha').length).toBe(1);
    expect(engine.getTrailBuffer('agent-beta').length).toBe(1);
  });

  it('trail segments fade to zero alpha at trailFadeMs', () => {
    engine.addTrail({
      agentId: 'agent-1',
      from: createGeo({ cx: 100, cy: 100 }),
      to: createGeo({ cx: 200, cy: 200 }),
      color: '#1a73e8',
    });

    expect(engine.stats().trailSegments).toBe(1);

    // Advance past fadeMs (8000ms)
    clock.currentTime += 9000;
    engine.tick();

    expect(engine.stats().trailSegments).toBe(0);
  });

  it('travel dot moves along segment during first travelMs', () => {
    engine.addTrail({
      agentId: 'agent-1',
      from: createGeo({ cx: 0, cy: 0 }),
      to: createGeo({ cx: 100, cy: 0 }),
      color: '#1a73e8',
    });

    // During travelMs (600ms), travelProgress should be < 1
    clock.currentTime += 300;
    engine.tick();
    const trails = engine.getTrails();
    expect(trails[0].travelProgress).toBeGreaterThan(0);
    expect(trails[0].travelProgress).toBeLessThan(1);

    // After travelMs, travelProgress should be 1
    clock.currentTime += 400;
    engine.tick();
    expect(trails[0].travelProgress).toBe(1);
  });

  it('draw issues expected canvas calls for write effect', () => {
    engine.spawn({
      id: 'test-write',
      kind: 'write',
      agentId: 'agent-1',
      agentColor: '#1a73e8',
      geo: createGeo(),
    });

    const ctx = createMockContext();
    engine.draw({
      ctx,
      camera: { x: 0, y: 0, k: 1 },
      viewport: { w: 800, h: 600 },
    });

    // Should have called clearRect, save, translate, scale, beginPath, arc, fill, restore
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('effects with seeded RNG are deterministic', () => {
    // Create two engines with same seed
    let seed1 = 12345;
    const rng1 = () => { seed1 = (seed1 * 1664525 + 1013904223) % 4294967296; return seed1 / 4294967296; };

    let seed2 = 12345;
    const rng2 = () => { seed2 = (seed2 * 1664525 + 1013904223) % 4294967296; return seed2 / 4294967296; };

    const engine1 = new EffectsEngine({ clock, rng: rng1, config: motionConfig });
    const engine2 = new EffectsEngine({ clock, rng: rng2, config: motionConfig });

    engine1.spawn({ id: 'a', kind: 'write', agentId: 'a', agentColor: '#1a73e8', geo: createGeo() });
    engine2.spawn({ id: 'b', kind: 'write', agentId: 'b', agentColor: '#1a73e8', geo: createGeo() });

    // Both should have same particle count and similar structure
    expect(engine1.stats().particles).toBe(engine2.stats().particles);
  });
});