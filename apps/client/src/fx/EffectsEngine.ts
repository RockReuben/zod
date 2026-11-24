/** Effects engine - spawns, ticks, and draws effects and trails on canvas */

import type { MotionConfig, FxKind, Clock, RNG } from './motionConfig';
import type { NodeGeo } from './nodeGeometry';
import { getResolvedTokens, parseColorWithAlpha } from './effectTokens';

/** Effect instance */
interface Effect {
  id: string;
  kind: FxKind;
  agentId: string;
  agentColor: string;
  geo: NodeGeo;
  startTime: number;
  duration: number;
  // Effect-specific state
  particles?: Particle[];
  ripples?: Ripple[];
  spiralDots?: SpiralDot[];
  flashState?: number;
  ringAlpha?: number;
}

/** Trail segment */
interface TrailSegment {
  id: string;
  agentId: string;
  from: NodeGeo;
  to: NodeGeo;
  color: string;
  startTime: number;
  travelProgress: number; // 0-1 for the traveling dot
}

/** Particle for write effect */
interface Particle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  alpha: number;
  delay: number;
}

/** Ripple for read effect */
interface Ripple {
  radius: number;
  maxRadius: number;
  alpha: number;
  delay: number;
}

/** Spiral dot for search effect */
interface SpiralDot {
  angle: number;
  radius: number;
  alpha: number;
  size: number;
  delay: number;
}

/** Effect spawn options */
export interface SpawnOptions {
  id: string;
  kind: FxKind;
  agentId: string;
  agentColor: string;
  geo: NodeGeo;
}

/** Trail add options */
export interface TrailOptions {
  agentId: string;
  from: NodeGeo;
  to: NodeGeo;
  color: string;
}

/** Engine stats for monitoring */
export interface EngineStats {
  particles: number;
  effects: number;
  trailSegments: number;
}

/** Canvas rendering context with camera transform */
export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  camera: { x: number; y: number; k: number };
  viewport: { w: number; h: number };
}

export class EffectsEngine {
  private readonly clock: Clock;
  private readonly rng: RNG;
  private readonly config: MotionConfig;
  private readonly maxParticles: number;

  private effects: Effect[] = [];
  private trails: TrailSegment[] = [];
  private lastTrailPerAgent = new Map<string, NodeGeo>();
  private trailBuffers = new Map<string, NodeGeo[]>();

  constructor(options: { clock: Clock; rng: RNG; config: MotionConfig }) {
    this.clock = options.clock;
    this.rng = options.rng;
    this.config = options.config;
    this.maxParticles = options.config.effects.maxParticles;
  }

  /** Spawn a new effect */
  spawn(options: SpawnOptions): void {
    const now = this.clock.now();
    const duration = this.config.durations[options.kind];

    // Check particle cap
    let estimatedParticles = 0;
    switch (options.kind) {
      case 'write':
        estimatedParticles = 14;
        break;
      case 'read':
        estimatedParticles = 2;
        break;
      case 'search':
        estimatedParticles = 30;
        break;
      case 'error':
        estimatedParticles = 0;
        break;
      case 'other':
        estimatedParticles = 1;
        break;
    }

    // Count current particles
    let currentParticles = 0;
    for (const e of this.effects) {
      if (e.particles) currentParticles += e.particles.length;
      if (e.ripples) currentParticles += e.ripples.length;
      if (e.spiralDots) currentParticles += e.spiralDots.length;
    }

    if (currentParticles + estimatedParticles > this.maxParticles) {
      // Remove oldest non-error effects to make room
      this.effects = this.effects.filter(e => e.kind === 'error');
      // Recount
      currentParticles = 0;
      for (const e of this.effects) {
        if (e.particles) currentParticles += e.particles.length;
        if (e.ripples) currentParticles += e.ripples.length;
        if (e.spiralDots) currentParticles += e.spiralDots.length;
      }
      if (currentParticles + estimatedParticles > this.maxParticles) {
        return; // Still over cap, drop the effect
      }
    }

    const effect: Effect = {
      id: options.id,
      kind: options.kind,
      agentId: options.agentId,
      agentColor: options.agentColor,
      geo: options.geo,
      startTime: now,
      duration,
    };

    // Initialize effect-specific state
    this.initializeEffect(effect, options.geo);

    this.effects.push(effect);

    // Track last visited node for this agent (for trails)
    this.lastTrailPerAgent.set(options.agentId, options.geo);
  }

  /** Initialize effect-specific particle/ripple/spiral state */
  private initializeEffect(effect: Effect, geo: NodeGeo): void {
    const halfDiag = Math.sqrt(geo.w * geo.w + geo.h * geo.h) / 2;
    const baseRadius = halfDiag * 1.6;

    switch (effect.kind) {
      case 'write': {
        // 10-14 particles drifting inward from a ring
        const particleCount = 10 + Math.floor(this.rng() * 5);
        const ringRadius = Math.max(
          this.config.effects.writeMinRingRadius,
          halfDiag + this.config.effects.writeRingRadiusOffset
        );
        effect.particles = [];
        for (let i = 0; i < particleCount; i++) {
          effect.particles.push({
            angle: (i / particleCount) * Math.PI * 2 + this.rng() * 0.2,
            radius: ringRadius,
            speed: 0.8 + this.rng() * 0.4,
            size: 3 + this.rng() * 2,
            alpha: 0.8 + this.rng() * 0.2,
            delay: this.rng() * 100,
          });
        }
        break;
      }
      case 'read': {
        // Two concentric ripple rings
        effect.ripples = [
          {
            radius: 0,
            maxRadius: baseRadius,
            alpha: 0.5,
            delay: 0,
          },
          {
            radius: 0,
            maxRadius: baseRadius,
            alpha: 0.5,
            delay: 180,
          },
        ];
        break;
      }
      case 'search': {
        // ~1.5 turn spiral of fading dots
        const dotCount = Math.floor(25 + this.rng() * 10);
        effect.spiralDots = [];
        const turns = 1.5;
        for (let i = 0; i < dotCount; i++) {
          const progress = i / dotCount;
          effect.spiralDots.push({
            angle: progress * Math.PI * 2 * turns,
            radius: progress * baseRadius,
            alpha: 0.7 * (1 - progress * 0.5),
            size: 2 + this.rng() * 1.5,
            delay: progress * 200,
          });
        }
        break;
      }
      case 'error': {
        effect.flashState = 0; // 0=first flash, 1=second flash, 2=ring
        effect.ringAlpha = 0.35;
        break;
      }
      case 'other': {
        // Small neutral glow dot - no special state needed
        break;
      }
    }
  }

  /** Add a trail segment between two nodes */
  addTrail(options: TrailOptions): void {
    const now = this.clock.now();
    const { agentId, from, to, color } = options;

    // Skip if same node (no visible trail)
    if (from.cx === to.cx && from.cy === to.cy) {
      return;
    }

    const segment: TrailSegment = {
      id: `${agentId}-${now}`,
      agentId,
      from,
      to,
      color,
      startTime: now,
      travelProgress: 0,
    };

    this.trails.push(segment);

    // Update ring buffer for this agent
    let buffer = this.trailBuffers.get(agentId);
    if (!buffer) {
      buffer = [];
      this.trailBuffers.set(agentId, buffer);
    }
    buffer.push(to);
    if (buffer.length > this.config.trails.bufferSize) {
      buffer.shift();
    }

    this.lastTrailPerAgent.set(agentId, to);
  }

  /** Get the trail buffer for an agent (for drawing) */
  getTrailBuffer(agentId: string): NodeGeo[] {
    return this.trailBuffers.get(agentId) || [];
  }

  /** Get the last visited node for an agent */
  getLastNode(agentId: string): NodeGeo | undefined {
    return this.lastTrailPerAgent.get(agentId);
  }

  /** Tick all effects and trails. Returns true if anything is active. */
  tick(): boolean {
    const now = this.clock.now();
    let hasActive = false;

    // Tick effects
    this.effects = this.effects.filter(effect => {
      const age = now - effect.startTime;
      if (age >= effect.duration) {
        // Special case: error has a lingering ring
        if (effect.kind === 'error' && age < effect.duration + this.config.durations.errorRing) {
          hasActive = true;
          return true;
        }
        return false;
      }
      hasActive = true;
      return true;
    });

    // Tick trails
    this.trails = this.trails.filter(trail => {
      const age = now - trail.startTime;
      if (age >= this.config.trails.fadeMs) {
        return false;
      }
      // Update travel progress for the moving dot
      if (age < this.config.trails.travelMs) {
        trail.travelProgress = age / this.config.trails.travelMs;
      } else {
        trail.travelProgress = 1;
      }
      hasActive = true;
      return true;
    });

    return hasActive;
  }

  /** Draw all effects and trails to canvas */
  draw(drawContext: DrawContext): void {
    const { ctx, camera, viewport } = drawContext;

    // Clear canvas
    ctx.clearRect(0, 0, viewport.w, viewport.h);

    // Save context
    ctx.save();

    // Apply camera transform
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.k, camera.k);

    // Draw trails first (behind effects)
    this.drawTrails(ctx, camera);

    // Draw effects
    for (const effect of this.effects) {
      this.drawEffect(ctx, effect, camera);
    }

    ctx.restore();
  }

  /** Draw trail segments */
  private drawTrails(ctx: CanvasRenderingContext2D, _camera: { x: number; y: number; k: number }): void {
    const now = this.clock.now();
    const { fadeMs, peakAlpha, strokeWidth, curveOffsetRatio, travelMs } = this.config.trails;

    for (const trail of this.trails) {
      const age = now - trail.startTime;
      if (age >= fadeMs) continue;

      // Calculate alpha (fades to 0 over fadeMs)
      const fadeProgress = age / fadeMs;
      const alpha = peakAlpha * (1 - fadeProgress) * (1 - fadeProgress); // ease-out fade

      if (alpha <= 0.01) continue;

      // Calculate control point for quadratic curve
      const dx = trail.to.cx - trail.from.cx;
      const dy = trail.to.cy - trail.from.cy;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 1) continue;

      // Perpendicular offset
      const offsetX = -dy / length * length * curveOffsetRatio;
      const offsetY = dx / length * length * curveOffsetRatio;
      const cpX = (trail.from.cx + trail.to.cx) / 2 + offsetX;
      const cpY = (trail.from.cy + trail.to.cy) / 2 + offsetY;

      // Draw trail segment
      ctx.beginPath();
      ctx.moveTo(trail.from.cx, trail.from.cy);
      ctx.quadraticCurveTo(cpX, cpY, trail.to.cx, trail.to.cy);

      // Parse color and apply alpha
      const color = parseColorWithAlpha(trail.color, alpha);
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Draw traveling dot during first travelMs
      if (age < travelMs) {
        const t = trail.travelProgress;
        // Quadratic bezier point at t
        const mt = 1 - t;
        const dotX = mt * mt * trail.from.cx + 2 * mt * t * cpX + t * t * trail.to.cx;
        const dotY = mt * mt * trail.from.cy + 2 * mt * t * cpY + t * t * trail.to.cy;

        ctx.beginPath();
        ctx.arc(dotX, dotY, strokeWidth * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = parseColorWithAlpha(trail.color, alpha * 1.5);
        ctx.fill();
      }
    }
  }

  /** Draw a single effect */
  private drawEffect(ctx: CanvasRenderingContext2D, effect: Effect, _camera: { x: number; y: number; k: number }): void {
    const now = this.clock.now();
    const age = now - effect.startTime;
    const progress = Math.min(1, age / effect.duration);
    const tokens = getResolvedTokens(effect.kind);

    // Fade out in last 30% (ease-in)
    const fadeStart = this.config.effects.fadeStartFraction;
    let alpha = 1;
    if (progress > fadeStart) {
      const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
      alpha = 1 - fadeProgress * fadeProgress; // ease-in fade
    }

    const { cx, cy } = effect.geo;
    const halfDiag = Math.sqrt(effect.geo.w * effect.geo.w + effect.geo.h * effect.geo.h) / 2;

    switch (effect.kind) {
      case 'write':
        this.drawWriteEffect(ctx, effect, tokens, cx, cy, halfDiag, progress, alpha);
        break;
      case 'read':
        this.drawReadEffect(ctx, effect, tokens, cx, cy, halfDiag, progress, alpha);
        break;
      case 'search':
        this.drawSearchEffect(ctx, effect, tokens, cx, cy, halfDiag, progress, alpha);
        break;
      case 'error':
        this.drawErrorEffect(ctx, effect, tokens, cx, cy, halfDiag, progress, alpha, now);
        break;
      case 'other':
        this.drawOtherEffect(ctx, effect, tokens, cx, cy, halfDiag, progress, alpha);
        break;
    }
  }

  /** Write: particles drifting inward + glow pulse */
  private drawWriteEffect(
    ctx: CanvasRenderingContext2D,
    effect: Effect,
    tokens: Record<string, string>,
    cx: number,
    cy: number,
    halfDiag: number,
    progress: number,
    alpha: number
  ): void {
    if (!effect.particles) return;

    const particleColor = tokens.particle || effect.agentColor;

    for (const p of effect.particles) {
      const particleAge = progress * effect.duration - p.delay;
      if (particleAge < 0) continue;

      // Particles move from ringRadius toward center
      const particleProgress = Math.min(1, particleAge / (effect.duration * p.speed));
      const radius = p.radius * (1 - particleProgress);
      const x = cx + Math.cos(p.angle) * radius;
      const y = cy + Math.sin(p.angle) * radius;

      // Alpha fades as particle approaches center
      const particleAlpha = p.alpha * alpha * (1 - particleProgress * 0.5);

      ctx.beginPath();
      ctx.arc(x, y, p.size * (1 - particleProgress * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = parseColorWithAlpha(particleColor, particleAlpha);
      ctx.fill();
    }

    // Glow pulse at center (one pulse)
    const pulseProgress = progress * 2; // Two pulses over duration
    if (pulseProgress < 1) {
      const pulseAlpha = Math.sin(pulseProgress * Math.PI) * 0.3 * alpha;
      ctx.beginPath();
      ctx.arc(cx, cy, halfDiag * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = parseColorWithAlpha(tokens.glow || effect.agentColor, pulseAlpha);
      ctx.fill();
    }
  }

  /** Read: two concentric ripple rings expanding */
  private drawReadEffect(
    ctx: CanvasRenderingContext2D,
    effect: Effect,
    tokens: Record<string, string>,
    cx: number,
    cy: number,
    _halfDiag: number,
    progress: number,
    alpha: number
  ): void {
    if (!effect.ripples) return;

    const rippleColor = tokens.ripple || tokens.primary;

    for (const r of effect.ripples) {
      const rippleAge = progress * effect.duration - r.delay;
      if (rippleAge < 0) continue;

      const rippleProgress = Math.min(1, rippleAge / (effect.duration - r.delay));
      const radius = r.maxRadius * rippleProgress;
      const rippleAlpha = r.alpha * alpha * (1 - rippleProgress);

      if (rippleAlpha <= 0.01) continue;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = parseColorWithAlpha(rippleColor, rippleAlpha);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  /** Search: spiral of fading dots */
  private drawSearchEffect(
    ctx: CanvasRenderingContext2D,
    effect: Effect,
    tokens: Record<string, string>,
    cx: number,
    cy: number,
    halfDiag: number,
    progress: number,
    alpha: number
  ): void {
    if (!effect.spiralDots) return;

    const spiralColor = tokens.spiral || tokens.primary;
    const maxAge = effect.duration;

    for (const d of effect.spiralDots) {
      const dotAge = progress * maxAge - d.delay;
      if (dotAge < 0) continue;

      const dotProgress = Math.min(1, dotAge / (maxAge - d.delay));
      // Spiral unwinds as it progresses
      const angle = d.angle + dotProgress * Math.PI * 4;
      const radius = d.radius + dotProgress * halfDiag * 0.5;
      const dotAlpha = d.alpha * alpha * (1 - dotProgress);

      if (dotAlpha <= 0.01) continue;

      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.arc(x, y, d.size * (1 - dotProgress * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = parseColorWithAlpha(spiralColor, dotAlpha);
      ctx.fill();
    }
  }

  /** Error: two quick flashes + dim red ring for 3s */
  private drawErrorEffect(
    ctx: CanvasRenderingContext2D,
    effect: Effect,
    tokens: Record<string, string>,
    cx: number,
    cy: number,
    halfDiag: number,
    progress: number,
    alpha: number,
    now: number
  ): void {
    const flashColor = tokens.flash || tokens.primary;
    const ringColor = tokens.ring || tokens.primary;
    const halfDiagOutline = halfDiag * 1.2;

    // Two quick flashes (during main duration)
    if (progress < 1) {
      const flashPhase = progress * 4; // 2 flashes = 4 half-cycles
      if (flashPhase < 2) {
        const flashAlpha = Math.sin(flashPhase * Math.PI) * 0.35 * alpha;
        // Flash outline
        ctx.beginPath();
        ctx.arc(cx, cy, halfDiagOutline, 0, Math.PI * 2);
        ctx.strokeStyle = parseColorWithAlpha(tokens.primary, flashAlpha * 2);
        ctx.lineWidth = 4;
        ctx.stroke();
        // Flash fill
        ctx.beginPath();
        ctx.arc(cx, cy, halfDiag, 0, Math.PI * 2);
        ctx.fillStyle = parseColorWithAlpha(flashColor, flashAlpha);
        ctx.fill();
      }
    }

    // Dim red ring for 3s after main duration
    const ringAge = now - effect.startTime - effect.duration;
    if (ringAge >= 0 && ringAge < this.config.durations.errorRing) {
      const ringProgress = ringAge / this.config.durations.errorRing;
      const ringAlpha = (effect.ringAlpha || 0.35) * (1 - ringProgress);
      ctx.beginPath();
      ctx.arc(cx, cy, halfDiagOutline, 0, Math.PI * 2);
      ctx.strokeStyle = parseColorWithAlpha(ringColor, ringAlpha);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /** Other: small neutral glow dot */
  private drawOtherEffect(
    ctx: CanvasRenderingContext2D,
    _effect: Effect,
    tokens: Record<string, string>,
    cx: number,
    cy: number,
    halfDiag: number,
    progress: number,
    alpha: number
  ): void {
    const glowColor = tokens.glow || tokens.primary;
    const pulseAlpha = Math.sin(progress * Math.PI) * 0.25 * alpha;

    ctx.beginPath();
    ctx.arc(cx, cy, halfDiag * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = parseColorWithAlpha(glowColor, pulseAlpha);
    ctx.fill();
  }

  /** Get engine statistics */
  stats(): EngineStats {
    let particles = 0;
    for (const e of this.effects) {
      if (e.particles) particles += e.particles.length;
      if (e.ripples) particles += e.ripples.length;
      if (e.spiralDots) particles += e.spiralDots.length;
    }
    return {
      particles,
      effects: this.effects.length,
      trailSegments: this.trails.length,
    };
  }

  /** Clear all effects and trails */
  clear(): void {
    this.effects = [];
    this.trails = [];
    this.trailBuffers.clear();
    this.lastTrailPerAgent.clear();
  }

  /** Get all active effects (for testing) */
  getEffects(): Effect[] {
    return [...this.effects];
  }

  /** Get all trail segments (for testing) */
  getTrails(): TrailSegment[] {
    return [...this.trails];
  }
}