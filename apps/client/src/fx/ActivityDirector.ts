/** Activity director - orchestrates event processing, coalescing, throttling, and queue management */

import type { HookEvent } from '../types';
import type { FxKind, MotionConfig, Clock, RNG } from './motionConfig';
import type { NodeGeo } from './nodeGeometry';
import { classifyEvent } from './classifyEvent';
import { EffectsEngine } from './EffectsEngine';

/** Pending effect in the queue */
interface PendingEffect {
  id: string;
  event: HookEvent;
  kind: FxKind;
  nodeId: string;
  diagram: string;
  agentId: string;
  agentColor: string;
  timestamp: number;
  geometry: NodeGeo | null;
}

/** Director options */
export interface ActivityDirectorOptions {
  clock: Clock;
  rng: RNG;
  config: MotionConfig;
  effects: EffectsEngine;
  getNodeGeometry: (diagram: string, nodeId: string) => NodeGeo | null;
  getAgentColor: (agentName: string) => string;
  onCameraMove: () => void;
  trackReads: boolean;
  trackSearches: boolean;
}

/** Director statistics */
export interface DirectorStats {
  queueLength: number;
  lastPanTime: number;
  effectsSpawned: number;
  effectsCoalesced: number;
  effectsDropped: number;
  errorsPreserved: number;
}

export class ActivityDirector {
  private readonly clock: Clock;
  private readonly rng: RNG;
  private readonly config: MotionConfig;
  private readonly effects: EffectsEngine;
  private readonly getNodeGeometry: (diagram: string, nodeId: string) => NodeGeo | null;
  private readonly getAgentColor: (agentName: string) => string;
  private readonly onCameraMove: () => void;
  private trackReads: boolean;
  private trackSearches: boolean;

  private queue: PendingEffect[] = [];
  private lastPanTime = -Infinity; // Initialize to -Infinity so first event always triggers camera
  private lastEventPerNodeKind = new Map<string, number>();
  private effectsSpawned = 0;
  private effectsCoalesced = 0;
  private effectsDropped = 0;
  private errorsPreserved = 0;

  constructor(options: ActivityDirectorOptions) {
    this.clock = options.clock;
    this.rng = options.rng;
    this.config = options.config;
    this.effects = options.effects;
    this.getNodeGeometry = options.getNodeGeometry;
    this.getAgentColor = options.getAgentColor;
    this.onCameraMove = options.onCameraMove;
    this.trackReads = options.trackReads;
    this.trackSearches = options.trackSearches;
  }

  setTrackReads(enabled: boolean): void {
    this.trackReads = enabled;
  }

  setTrackSearches(enabled: boolean): void {
    this.trackSearches = enabled;
  }

  /** Process an incoming hook event */
  processEvent(event: HookEvent): void {
    // Classify the event
    const kind = classifyEvent(event, {
      trackReads: this.trackReads,
      trackSearches: this.trackSearches,
    });

    if (!kind) {
      return; // No visual effect for this event
    }

    // Extract node mapping from event
    const toolInput = event.tool_input || {};
    const diagram = toolInput.diagram as string;
    const nodeId = toolInput.node as string;

    if (!diagram || !nodeId) {
      return; // Unmapped event - no visual
    }

    // Get geometry for this node
    const geometry = this.getNodeGeometry(diagram, nodeId);
    if (!geometry) {
      return; // Node not found in current diagram
    }

    const agentId = event.agent_name || 'unknown';
    const agentColor = this.getAgentColor(agentId);
    const now = this.clock.now();

    // Check for coalescing (same node + kind within window)
    const coalesceKey = `${diagram}:${nodeId}:${kind}`;
    const lastTime = this.lastEventPerNodeKind.get(coalesceKey);
    const coalesceWindow = this.config.burstControl.coalesceWindow;

    // Only coalesce if there was a previous event (lastTime is defined) and within window
    if (lastTime !== undefined && now - lastTime < coalesceWindow && kind !== 'error') {
      // Coalesce: don't spawn a new effect, just update the last event time
      this.lastEventPerNodeKind.set(coalesceKey, now);
      this.effectsCoalesced++;
      return;
    }

    // Errors are never coalesced
    if (kind === 'error') {
      this.errorsPreserved++;
    }

    // Update last event time
    this.lastEventPerNodeKind.set(coalesceKey, now);

    // Create pending effect
    const pending: PendingEffect = {
      id: `${coalesceKey}-${now}-${this.rng()}`,
      event,
      kind,
      nodeId,
      diagram,
      agentId,
      agentColor,
      timestamp: now,
      geometry,
    };

    // Add to queue
    this.queue.push(pending);

    // Enforce queue cap (drop oldest non-error first)
    const queueCap = this.config.burstControl.queueCap;
    if (this.queue.length > queueCap) {
      // Find oldest non-error
      const nonErrorIndex = this.queue.findIndex(p => p.kind !== 'error');
      if (nonErrorIndex >= 0) {
        this.queue.splice(nonErrorIndex, 1);
        this.effectsDropped++;
      } else {
        // All errors - drop oldest error (shouldn't happen often)
        this.queue.shift();
        this.effectsDropped++;
      }
    }

    // Process queue immediately
    this.processQueue();
  }

  /** Process the pending queue */
  private processQueue(): void {
    const now = this.clock.now();
    const panThrottle = this.config.burstControl.panThrottleMs;

    // Queue is maintained in sorted order (errors first, then by timestamp)
    // Only resort when a new error is added (rare)
    // New normal events are appended in timestamp order
    // So we only need to ensure errors bubble to front
    this.ensureErrorsFirst();

    // Process items respecting throttle - only first item (or error) moves camera
    let processed = 0;
    for (const pending of this.queue) {
      // Check if we can move camera for this item
      // The throttle is based on lastPanTime, which is updated across calls
      // Errors always break throttle
      const canMoveCamera = now - this.lastPanTime >= panThrottle || pending.kind === 'error';

      // Add trail FIRST (using previous last node) before spawning effect
      // which updates the last node tracker
      this.addTrailIfNeeded(pending);

      // Always spawn effect
      this.spawnEffect(pending);
      processed++;

      // Move camera if allowed
      if (canMoveCamera) {
        this.moveCamera(pending.geometry!);
        this.lastPanTime = now;
      }

      // If we couldn't move camera, stop processing and leave remaining in queue
      if (!canMoveCamera) {
        break;
      }
    }

    // Remove processed items from queue
    this.queue = this.queue.slice(processed);
  }

  /** Ensure all errors are at front of queue (O(n) single pass, only when errors added) */
  private ensureErrorsFirst(): void {
    // Check if any error is not at front
    let firstNonErrorIndex = -1;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].kind !== 'error') {
        firstNonErrorIndex = i;
        break;
      }
    }
    if (firstNonErrorIndex === -1) return; // All errors or empty

    // Move any errors after firstNonErrorIndex to front
    const errors: PendingEffect[] = [];
    const nonErrors: PendingEffect[] = [];
    for (let i = firstNonErrorIndex; i < this.queue.length; i++) {
      if (this.queue[i].kind === 'error') {
        errors.push(this.queue[i]);
      } else {
        nonErrors.push(this.queue[i]);
      }
    }
    if (errors.length > 0) {
      // Preserve timestamp order within errors and non-errors
      this.queue = [...this.queue.slice(0, firstNonErrorIndex), ...errors, ...nonErrors];
    }
  }

  /** Spawn a visual effect for a pending event */
  private spawnEffect(pending: PendingEffect): void {
    const { id, kind, agentId, agentColor, geometry } = pending;

    if (!geometry) return;

    // For camera moves, cue in effect at 55% of pan progress
    // For no camera move, cue in immediately
    // The EffectsEngine handles timing internally based on startTime

    this.effects.spawn({
      id,
      kind,
      agentId,
      agentColor,
      geo: geometry,
    });

    this.effectsSpawned++;
  }

  /** Move camera to center on a node */
  private moveCamera(geometry: NodeGeo | null): void {
    if (!geometry) return;
    // Camera controller handles viewport internally
    // The actual flyTo is called by FxLayer which has access to viewport
    this.onCameraMove();
  }

  /** Add trail segment from agent's last node to current node */
  private addTrailIfNeeded(pending: PendingEffect): void {
    const { agentId, agentColor, geometry } = pending;

    if (!geometry) return;

    // Get the last node this agent visited
    const lastNode = this.effects.getLastNode(agentId);
    if (lastNode) {
      // Check if it's a different node
      if (lastNode.cx !== geometry.cx || lastNode.cy !== geometry.cy) {
        this.effects.addTrail({
          agentId,
          from: lastNode,
          to: geometry,
          color: agentColor,
        });
      }
    }
  }

  /** Called when camera moves (to cue in effects at 55% progress) */
  onCameraProgress(_progress: number): void {
    // Effects are spawned with startTime = now
    // The EffectsEngine draws them based on age
    // At 55% of pan duration, effects will naturally be at 55% progress
    // No extra work needed here
  }

  /** Tick the director (call from animation loop) */
  tick(): boolean {
    // Process any queued events
    if (this.queue.length > 0) {
      this.processQueue();
    }

    // Tick effects engine
    return this.effects.tick();
  }

  /** Get director statistics */
  stats(): DirectorStats {
    return {
      queueLength: this.queue.length,
      lastPanTime: this.lastPanTime,
      effectsSpawned: this.effectsSpawned,
      effectsCoalesced: this.effectsCoalesced,
      effectsDropped: this.effectsDropped,
      errorsPreserved: this.errorsPreserved,
    };
  }

  /** Get effects engine stats */
  effectsStats() {
    return this.effects.stats();
  }

  /** Clear all state */
  clear(): void {
    this.queue = [];
    this.lastEventPerNodeKind.clear();
    this.effects.clear();
    this.effectsSpawned = 0;
    this.effectsCoalesced = 0;
    this.effectsDropped = 0;
    this.errorsPreserved = 0;
  }

  /** For testing: get pending queue */
  getQueue(): PendingEffect[] {
    return [...this.queue];
  }
}