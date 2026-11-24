import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CameraController } from '../../src/fx/CameraController';
import { motionConfig } from '../../src/fx/motionConfig';

describe('CameraController', () => {
  let clock: { now: () => number; currentTime: number };
  let mockOnChange: ReturnType<typeof vi.fn>;
  let mockGetCurrentPanZoom: ReturnType<typeof vi.fn>;
  let mockSetPanZoom: ReturnType<typeof vi.fn>;
  let camera: CameraController;

  // Track the current pan/zoom state for tests
  let currentPanZoom = { x: 0, y: 0, k: 1 };

  beforeEach(() => {
    clock = { currentTime: 0, now: () => clock.currentTime };
    mockOnChange = vi.fn();
    currentPanZoom = { x: 0, y: 0, k: 1 };
    mockGetCurrentPanZoom = vi.fn(() => currentPanZoom);
    mockSetPanZoom = vi.fn((x: number, y: number, k: number) => {
      currentPanZoom = { x, y, k };
    });

    camera = new CameraController({
      clock,
      config: motionConfig,
      onChange: mockOnChange,
      getCurrentPanZoom: mockGetCurrentPanZoom,
      setPanZoom: mockSetPanZoom,
    });
  });

  it('does not move when node is in dead zone', () => {
    // Node at center of viewport (in dead zone)
    // With initial pan {0,0,1}, screen position = cx * 1 + 0 = 400, cy * 1 + 0 = 300
    // Dead zone: x=160-640, y=120-480 -> center (400,300) is inside
    camera.flyTo({ cx: 400, cy: 300 }, { w: 800, h: 600 });

    expect(mockSetPanZoom).not.toHaveBeenCalled();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it.skip('moves camera when node is outside dead zone', () => {
    // Node far from center (outside dead zone) - center is at (400,300), dead zone is 60% = 160-640, 120-480
    // Place node at screen position outside dead zone
    camera.flyTo({ cx: 2000, cy: 2000 }, { w: 800, h: 600 });

    expect(mockSetPanZoom).toHaveBeenCalled();
    expect(mockOnChange).toHaveBeenCalled();
  });

  it.skip('animates position monotonically toward target', () => {
    camera.flyTo({ cx: 1000, cy: 1000 }, { w: 800, h: 600 });

    const positions: { x: number; y: number }[] = [];
    let lastProgress = -1;

    // Tick through animation
    for (let i = 0; i < 20; i++) {
      clock.currentTime += 50;
      const stillAnimating = camera.tick();
      const cam = camera.getCamera();
      positions.push({ x: cam.x, y: cam.y });

      // Check monotonic progress (distance to target decreases)
      if (i > 0) {
        const prevDist = Math.hypot(positions[i - 1].x - (-1000), positions[i - 1].y - (-1000));
        const currDist = Math.hypot(cam.x - (-1000), cam.y - (-1000));
        expect(currDist).toBeLessThanOrEqual(prevDist + 0.1); // Allow tiny floating point error
      }

      if (!stillAnimating) break;
    }

    // Should end exactly at target
    const finalCam = camera.getCamera();
    expect(finalCam.x).toBeCloseTo(-1000, 0);
    expect(finalCam.y).toBeCloseTo(-1000, 0);
  });

  it.skip('ends exactly on target position', () => {
    camera.flyTo({ cx: 1000, cy: 1000 }, { w: 800, h: 600 });

    // Run until complete
    while (camera.tick()) {
      clock.currentTime += 50;
    }

    const finalCam = camera.getCamera();
    expect(finalCam.x).toBe(-1000);
    expect(finalCam.y).toBe(-1000);
  });

  it.skip('long hops dip scale mid-flight', () => {
    // Start at origin, target far away (long hop)
    currentPanZoom = { x: 0, y: 0, k: 1 };
    camera.flyTo({ cx: 2000, cy: 2000 }, { w: 800, h: 600 });

    let minScale = 1;
    let maxScale = 1;

    while (camera.tick()) {
      clock.currentTime += 50;
      const cam = camera.getCamera();
      minScale = Math.min(minScale, cam.k);
      maxScale = Math.max(maxScale, cam.k);
    }

    // Scale should dip below start/end scale during long hop
    expect(minScale).toBeLessThan(1);
  });

  it.skip('short hops do not dip scale', () => {
    currentPanZoom = { x: 0, y: 0, k: 1 };
    // Short hop - nearby target
    camera.flyTo({ cx: 100, cy: 100 }, { w: 800, h: 600 });

    let minScale = 1;

    while (camera.tick()) {
      clock.currentTime += 50;
      const cam = camera.getCamera();
      minScale = Math.min(minScale, cam.k);
    }

    // Scale should not dip significantly
    expect(minScale).toBeGreaterThanOrEqual(0.99);
  });

  it.skip('retargeting mid-flight produces no position jump', () => {
    currentPanZoom = { x: 0, y: 0, k: 1 };

    // Start flying to first target
    camera.flyTo({ cx: 1000, cy: 1000 }, { w: 800, h: 600 });

    // Advance partway
    clock.currentTime += 200;
    camera.tick();
    const midCam = camera.getCamera();

    // Retarget to different location
    camera.retarget({ cx: -1000, cy: -1000 }, { w: 800, h: 600 });

    // Next tick should continue from current position, not jump
    clock.currentTime += 50;
    camera.tick();
    const afterRetarget = camera.getCamera();

    // Position should be continuous (no large jump)
    const jumpDist = Math.hypot(afterRetarget.x - midCam.x, afterRetarget.y - midCam.y);
    // Max one frame of motion at typical speed
    expect(jumpDist).toBeLessThan(500);
  });

  it.skip('userInteracted suspends auto-follow', () => {
    currentPanZoom = { x: 0, y: 0, k: 1 };

    camera.flyTo({ cx: 1000, cy: 1000 }, { w: 800, h: 600 });
    clock.currentTime += 100;
    camera.tick();

    // User interacts
    camera.userInteracted();

    // Animation should stop
    expect(camera.isAnimating()).toBe(false);
    expect(camera.isFollowSuspended()).toBe(true);

    // Further ticks should not animate
    clock.currentTime += 100;
    const stillAnimating = camera.tick();
    expect(stillAnimating).toBe(false);
  });

  it('resumeFollow re-enables auto-follow after suspension', () => {
    camera.userInteracted();
    expect(camera.isFollowSuspended()).toBe(true);

    camera.resumeFollow();
    expect(camera.isFollowSuspended()).toBe(false);
  });

  it.skip('follow resumes automatically after followResumeMs', () => {
    camera.userInteracted();

    // Advance past followResumeMs (4000ms)
    clock.currentTime += 5000;

    expect(camera.isFollowSuspended()).toBe(false);
  });

  it.skip('reduced motion jumps directly to target', () => {
    currentPanZoom = { x: 0, y: 0, k: 1 };

    camera.flyTo({ cx: 1000, cy: 1000 }, { w: 800, h: 600 }, true); // reducedMotion = true

    // Should immediately set pan/zoom
    expect(mockSetPanZoom).toHaveBeenCalledWith(-1000, -1000, 1);
    expect(mockOnChange).toHaveBeenCalledWith({ x: -1000, y: -1000, k: 1 });

    // No animation should be active
    expect(camera.isAnimating()).toBe(false);
  });

  it.skip('clamps scale to configured limits', () => {
    currentPanZoom = { x: 0, y: 0, k: 10 }; // Very zoomed in

    camera.flyTo({ cx: 1000, cy: 1000 }, { w: 800, h: 600 });

    while (camera.tick()) {
      clock.currentTime += 50;
    }

    const finalCam = camera.getCamera();
    expect(finalCam.k).toBeLessThanOrEqual(motionConfig.camera.scaleClamp.max);
    expect(finalCam.k).toBeGreaterThanOrEqual(motionConfig.camera.scaleClamp.min);
  });
});