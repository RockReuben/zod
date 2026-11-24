/** Motion configuration - single source of truth for all animation timings and thresholds */

// Shared types
export interface Clock {
  now(): number;
}

export interface RNG {
  (): number;
}

export interface MotionConfig {
  // Camera
  readonly camera: {
    /** Easing curve: quick departure, long gentle settle */
    readonly easing: 'cubic-bezier(0.22, 1, 0.36, 1)';
    /** Minimum pan duration (ms) */
    readonly minDuration: 600;
    /** Maximum pan duration (ms) */
    readonly maxDuration: 1100;
    /** Scale dip factor for long hops (capped at 0.25) */
    readonly maxScaleDip: 0.25;
    /** Dead zone: don't move if node centre inside central N% of viewport */
    readonly deadZoneRatio: 0.6;
    /** Auto-follow suspended for N ms after user interaction */
    readonly followResumeMs: 4000;
    /** Scale limits for follow moves */
    readonly scaleClamp: { readonly min: 0.8; readonly max: 1.6 };
    /** Duration multiplier for distance-based calculation */
    readonly durationDistanceFactor: 0.8;
    /** Long hop threshold: fraction of viewport diagonal */
    readonly longHopDiagonalFraction: 0.5;
  };

  // Effects
  readonly effects: {
    /** Total live particle cap across all effects */
    readonly maxParticles: 300;
    /** Canvas device pixel ratio cap */
    readonly maxDPR: 2;
    /** Alpha fade starts at this fraction of effect life (ease-in) */
    readonly fadeStartFraction: 0.7;
    /** Cue-in starts at this fraction of pan progress */
    readonly cueInAtPanProgress: 0.55;
    /** Write effect: minimum ring radius for particles */
    readonly writeMinRingRadius: 48;
    /** Write effect: ring radius offset from half-diagonal */
    readonly writeRingRadiusOffset: 20;
  };

  // Effect durations (ms)
  readonly durations: {
    readonly write: 800;
    readonly read: 1000;
    readonly search: 1100;
    readonly error: 700;
    readonly errorRing: 3000;
    readonly other: 400;
  };

  // Coalescing & throttling
  readonly burstControl: {
    /** Events for same node+kind within this window coalesce (ms) */
    readonly coalesceWindow: 250;
    /** At most one camera move per this interval (ms) */
    readonly panThrottleMs: 1200;
    /** Maximum pending effects in queue */
    readonly queueCap: 20;
  };

  // Trails
  readonly trails: {
    /** Ring buffer size per agent */
    readonly bufferSize: 12;
    /** Segment fade duration (ms) */
    readonly fadeMs: 8000;
    /** Travel dot duration for new segment (ms) */
    readonly travelMs: 600;
    /** Peak alpha for trail segments */
    readonly peakAlpha: 0.35;
    /** Stroke width for trail segments */
    readonly strokeWidth: 2;
    /** Control point offset as fraction of segment length */
    readonly curveOffsetRatio: 0.12;
  };

  // Reduced motion
  readonly reducedMotion: {
    /** Crossfade duration instead of pan (ms) */
    readonly jumpCrossfadeMs: 150;
    /** Static glow ring duration (ms) */
    readonly glowRingMs: 1500;
  };

  // Performance
  readonly performance: {
    /** Target frame rate */
    readonly targetFPS: 60;
    /** Animation loop runs only while active */
    readonly idleLoop: false;
    /** Stop when tab hidden */
    readonly stopOnHidden: true;
  };
}

export const motionConfig: MotionConfig = {
  camera: {
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    minDuration: 600,
    maxDuration: 1100,
    maxScaleDip: 0.25,
    deadZoneRatio: 0.6,
    followResumeMs: 4000,
    scaleClamp: { min: 0.8, max: 1.6 },
    durationDistanceFactor: 0.8,
    longHopDiagonalFraction: 0.5,
  },
  effects: {
    maxParticles: 300,
    maxDPR: 2,
    fadeStartFraction: 0.7,
    cueInAtPanProgress: 0.55,
    writeMinRingRadius: 48,
    writeRingRadiusOffset: 20,
  },
  durations: {
    write: 800,
    read: 1000,
    search: 1100,
    error: 700,
    errorRing: 3000,
    other: 400,
  },
  burstControl: {
    coalesceWindow: 250,
    panThrottleMs: 1200,
    queueCap: 20,
  },
  trails: {
    bufferSize: 12,
    fadeMs: 8000,
    travelMs: 600,
    peakAlpha: 0.35,
    strokeWidth: 2,
    curveOffsetRatio: 0.12,
  },
  reducedMotion: {
    jumpCrossfadeMs: 150,
    glowRingMs: 1500,
  },
  performance: {
    targetFPS: 60,
    idleLoop: false,
    stopOnHidden: true,
  },
};

export type FxKind = 'write' | 'read' | 'search' | 'error' | 'other';

export function getDuration(kind: FxKind): number {
  return motionConfig.durations[kind];
}

export function getEasing(): string {
  return motionConfig.camera.easing;
}