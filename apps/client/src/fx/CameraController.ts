/** Camera controller - handles smooth pan/zoom with Apple Maps feel */

import type { MotionConfig, Clock } from './motionConfig';
import type { NodeGeo } from './nodeGeometry';

export interface Camera {
  x: number;
  y: number;
  k: number; // scale/zoom
}

export interface Viewport {
  w: number;
  h: number;
}

export interface CameraControllerOptions {
  clock: Clock;
  config: MotionConfig;
  onChange: (camera: Camera) => void;
  getCurrentPanZoom: () => { x: number; y: number; k: number };
  setPanZoom: (x: number, y: number, k: number) => void;
}

/** Internal state for animation */
interface AnimationState {
  active: boolean;
  startTime: number;
  duration: number;
  startCamera: Camera;
  targetCamera: Camera;
  targetNode: { cx: number; cy: number } | null;
  isLongHop: boolean;
  initialDistance: number;
}

/** Ease-out quint: cubic-bezier(0.22, 1, 0.36, 1) */
function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/** Linear interpolation */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Distance between two points */
function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export class CameraController {
  private readonly clock: Clock;
  private readonly config: MotionConfig;
  private readonly onChange: (camera: Camera) => void;
  private readonly getCurrentPanZoom: () => { x: number; y: number; k: number };
  private readonly setPanZoom: (x: number, y: number, k: number) => void;

  private animationState: AnimationState = {
    active: false,
    startTime: 0,
    duration: 0,
    startCamera: { x: 0, y: 0, k: 1 },
    targetCamera: { x: 0, y: 0, k: 1 },
    targetNode: null,
    isLongHop: false,
    initialDistance: 0,
  };

  private followSuspendedUntil = 0;

  constructor(options: CameraControllerOptions) {
    this.clock = options.clock;
    this.config = options.config;
    this.onChange = options.onChange;
    this.getCurrentPanZoom = options.getCurrentPanZoom;
    this.setPanZoom = options.setPanZoom;
  }

  /**
   * Start a camera flight to center on a node.
   * If reduced motion is enabled, jumps directly.
   */
  flyTo(target: { cx: number; cy: number }, viewport: Viewport, reducedMotion = false): void {
    const now = this.clock.now();
    const current = this.getCurrentPanZoom();
    const { scaleClamp } = this.config.camera;

    // Calculate target camera position to center the node
    const targetX = viewport.w / 2 - target.cx;
    const targetY = viewport.h / 2 - target.cy;

    // Clamp target scale
    let targetK = current.k;
    targetK = Math.max(scaleClamp.min, Math.min(scaleClamp.max, targetK));

    const targetCamera: Camera = { x: targetX, y: targetY, k: targetK };

    // Check if already in dead zone
    const nodeGeo: NodeGeo = { cx: target.cx, cy: target.cy, w: 1, h: 1 };
    if (this.isInDeadZone(nodeGeo, current, viewport)) {
      return; // No move needed
    }

    // Calculate distance for duration and long-hop detection
    const currentCenterX = -current.x / current.k;
    const currentCenterY = -current.y / current.k;
    const dist = distance(currentCenterX, currentCenterY, target.cx, target.cy);

    // Check if long hop (distance > viewport diagonal * fraction)
    const viewportDiag = Math.sqrt(viewport.w * viewport.w + viewport.h * viewport.h);
    const isLongHop = dist > viewportDiag * this.config.camera.longHopDiagonalFraction;

    // Calculate duration based on distance, clamped
    const minDuration = this.config.camera.minDuration;
    const maxDuration = this.config.camera.maxDuration;
    const duration = Math.min(maxDuration, Math.max(minDuration, dist * this.config.camera.durationDistanceFactor));

    if (reducedMotion) {
      // Jump cut with crossfade
      this.setPanZoom(targetCamera.x, targetCamera.y, targetCamera.k);
      this.onChange(targetCamera);
      return;
    }

    // Start animation
    this.animationState = {
      active: true,
      startTime: now,
      duration,
      startCamera: { ...current },
      targetCamera,
      targetNode: { cx: target.cx, cy: target.cy },
      isLongHop,
      initialDistance: dist,
    };

    // Update follow suspension end time
    this.followSuspendedUntil = 0;
  }

  /**
   * Called when user interacts (pan, zoom, drag).
   * Suspends auto-follow for followResumeMs.
   */
  userInteracted(): void {
    this.followSuspendedUntil = this.clock.now() + this.config.camera.followResumeMs;
    this.animationState.active = false; // Stop any current auto-follow animation
  }

  /** Resume auto-follow after user interaction suspension */
  resumeFollow(): void {
    this.followSuspendedUntil = 0;
  }

  /** Check if auto-follow is currently suspended */
  isFollowSuspended(): boolean {
    return this.clock.now() < this.followSuspendedUntil;
  }

  /**
   * Tick the animation. Call this from the render loop.
   * Returns true if animation is still in progress.
   */
  tick(): boolean {
    const now = this.clock.now();

    // Check if follow is suspended
    if (this.isFollowSuspended()) {
      return false;
    }

    if (!this.animationState.active) {
      return false;
    }

    const { startTime, duration, startCamera, targetCamera, isLongHop, initialDistance } = this.animationState;
    const elapsed = now - startTime;

    if (elapsed >= duration) {
      // Animation complete
      this.setPanZoom(targetCamera.x, targetCamera.y, targetCamera.k);
      this.onChange(targetCamera);
      this.animationState.active = false;
      return false;
    }

    // Progress 0-1
    const progress = elapsed / duration;
    const eased = easeOutQuint(progress);

    // Calculate interpolated position
    const x = lerp(startCamera.x, targetCamera.x, eased);
    const y = lerp(startCamera.y, targetCamera.y, eased);
    let k = lerp(startCamera.k, targetCamera.k, eased);

    // Apply scale dip for long hops
    if (isLongHop) {
      const dip = Math.min(this.config.camera.maxScaleDip, initialDistance / 2000);
      const dipFactor = dip * Math.sin(Math.PI * progress);
      k = lerp(startCamera.k, targetCamera.k, eased) - dipFactor;
      // Clamp to scale limits
      const { scaleClamp } = this.config.camera;
      k = Math.max(scaleClamp.min, Math.min(scaleClamp.max, k));
    }

    this.setPanZoom(x, y, k);
    this.onChange({ x, y, k });

    return true;
  }

  /**
   * Retarget to a new node mid-flight.
   * Continues from current position/velocity without jumping.
   */
  retarget(target: { cx: number; cy: number }, viewport: Viewport): void {
    if (!this.animationState.active) {
      this.flyTo(target, viewport);
      return;
    }

    const now = this.clock.now();
    const current = this.getCurrentPanZoom();

    // Calculate new target camera
    const targetX = viewport.w / 2 - target.cx;
    const targetY = viewport.h / 2 - target.cy;
    const { scaleClamp } = this.config.camera;
    let targetK = current.k;
    targetK = Math.max(scaleClamp.min, Math.min(scaleClamp.max, targetK));

    const newTargetCamera: Camera = { x: targetX, y: targetY, k: targetK };

    // Calculate new distance from current position
    const currentCenterX = -current.x / current.k;
    const currentCenterY = -current.y / current.k;
    const newDist = distance(currentCenterX, currentCenterY, target.cx, target.cy);

    // Continue animation from current state toward new target
    // Use remaining time or recalculate duration
    const elapsed = now - this.animationState.startTime;
    const remainingTime = this.animationState.duration - elapsed;
    const newDuration = Math.max(remainingTime, this.config.camera.minDuration * 0.5);

    this.animationState = {
      ...this.animationState,
      startTime: now,
      duration: newDuration,
      startCamera: { ...current },
      targetCamera: newTargetCamera,
      targetNode: { cx: target.cx, cy: target.cy },
      isLongHop: newDist > Math.sqrt(viewport.w * viewport.w + viewport.h * viewport.h) * 0.5,
      initialDistance: newDist,
    };
  }

  /** Get current camera state */
  getCamera(): Camera {
    return this.getCurrentPanZoom();
  }

  /** Check if a node is in the dead zone */
  private isInDeadZone(node: NodeGeo, camera: Camera, viewport: Viewport): boolean {
    const screenX = node.cx * camera.k + camera.x;
    const screenY = node.cy * camera.k + camera.y;
    const ratio = this.config.camera.deadZoneRatio;
    const leftBound = viewport.w * (1 - ratio) / 2;
    const rightBound = viewport.w * (1 + ratio) / 2;
    const topBound = viewport.h * (1 - ratio) / 2;
    const bottomBound = viewport.h * (1 + ratio) / 2;

    return (
      screenX >= leftBound &&
      screenX <= rightBound &&
      screenY >= topBound &&
      screenY <= bottomBound
    );
  }

  /** Force stop any animation */
  stop(): void {
    this.animationState.active = false;
  }

  /** Check if currently animating */
  isAnimating(): boolean {
    return this.animationState.active && !this.isFollowSuspended();
  }
}