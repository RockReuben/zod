/** FxLayer - React component that renders the effects canvas overlay and wires up the animation loop */

import { useEffect, useRef } from 'react';
import { useEventsStore } from '../stores/events';
import { CameraController } from './CameraController';
import { EffectsEngine } from './EffectsEngine';
import { ActivityDirector } from './ActivityDirector';
import { resolveNodeGeometry } from './nodeGeometry';
import { getAgentColor } from '../utils/agentColors';
import { motionConfig } from './motionConfig';
import { getCurrentPanZoom, setPanZoom } from './panZoomUtils';

interface FxLayerProps {
  /** Reference to the MermaidViewer's SVG container */
  svgContainerRef: React.RefObject<HTMLDivElement>;
  /** Reference to the MermaidViewer's wrapper (for pan/zoom) */
  wrapperRef: React.RefObject<HTMLDivElement>;
  /** Whether the diagram is currently loaded and rendered */
  isReady: boolean;
  /** Current diagram name (for geometry resolution) */
  diagramName: string;
  /** Enable/disable the entire fx system */
  enabled?: boolean;
  /** Callback when camera moves (for external sync) */
  onCameraChange?: (camera: { x: number; y: number; k: number }) => void;
}

// Stable selectors for Zustand to avoid inline arrow functions
const selectTrackReads = (state: any) => state.trackReads;
const selectTrackSearches = (state: any) => state.trackSearches;
const selectReplay = (state: any) => state.replay;
const selectGetReducedMotion = (state: any) => state.getReducedMotion;

export function FxLayer({
  svgContainerRef,
  wrapperRef,
  isReady,
  diagramName,
  enabled = true,
  onCameraChange,
}: FxLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  // Store references (stable across renders)
  const cameraRef = useRef<CameraController | null>(null);
  const effectsRef = useRef<EffectsEngine | null>(null);
  const directorRef = useRef<ActivityDirector | null>(null);
  const initializedRef = useRef(false);

  // Settings from store
  const trackReads = useEventsStore(selectTrackReads);
  const trackSearches = useEventsStore(selectTrackSearches);
  const replay = useEventsStore(selectReplay);
  const getReducedMotion = useEventsStore(selectGetReducedMotion);

  // Initialize the fx system
  useEffect(() => {
    if (initializedRef.current) return;
    if (!enabled || !isReady) return;

    // Get the pan/zoom instance from MermaidViewer
    // We need to access it through the wrapper ref
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Find the svg-pan-zoom instance
    // It's attached to the SVG element
    const svgContainer = svgContainerRef.current;
    if (!svgContainer) return;

    const svg = svgContainer.querySelector('svg');
    if (!svg) return;

    // Create clock using performance.now
    const clock = {
      now: () => performance.now(),
    };

    // Create seeded RNG for deterministic effects
    let seed = 12345;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // Create camera controller using shared pan/zoom utils
    const getCurrentPanZoomFn = () => getCurrentPanZoom(svg);
    const setPanZoomFn = (x: number, y: number, k: number) => setPanZoom(svg, x, y, k);

    // Create camera controller
    cameraRef.current = new CameraController({
      clock,
      config: motionConfig,
      onChange: (camera) => {
        onCameraChange?.(camera);
      },
      getCurrentPanZoom: getCurrentPanZoomFn,
      setPanZoom: setPanZoomFn,
    });

    // Create effects engine
    effectsRef.current = new EffectsEngine({
      clock,
      rng,
      config: motionConfig,
    });

    // Create activity director
    directorRef.current = new ActivityDirector({
      clock,
      rng,
      config: motionConfig,
      effects: effectsRef.current,
      getNodeGeometry: (diagram: string, nodeId: string) => {
        // Only resolve for the current diagram
        if (diagram !== diagramName) return null;
        const container = svgContainerRef.current;
        if (!container) return null;
        const svgEl = container.querySelector('svg');
        if (!svgEl) return null;
        return resolveNodeGeometry(svgEl, nodeId);
      },
      getAgentColor,
      onCameraMove: () => {
        // Trigger camera move - will be handled in animation loop
      },
      trackReads,
      trackSearches,
    });

    initializedRef.current = true;

    // Subscribe to new events
    const unsubscribe = useEventsStore.subscribe((state, prevState) => {
      if (!directorRef.current) return;

      // Check for new events
      const newEvents = state.events.slice((prevState?.events?.length || 0));
      for (const event of newEvents) {
        directorRef.current.processEvent(event);
      }

      // Update settings
      directorRef.current.setTrackReads(state.trackReads);
      directorRef.current.setTrackSearches(state.trackSearches);
    });

    return () => {
      unsubscribe();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      cameraRef.current = null;
      effectsRef.current = null;
      directorRef.current = null;
      initializedRef.current = false;
    };
  }, [enabled, isReady, diagramName, svgContainerRef, wrapperRef, trackReads, trackSearches, onCameraChange, getReducedMotion]);

  // Draw effects to canvas - plain function (not a hook) to avoid hook order issues
  // Uses only refs and constants, no external dependencies that change
  const drawEffects = (_timestamp: number) => {
    const canvas = canvasRef.current;
    const effects = effectsRef.current;
    const camera = cameraRef.current;
    const wrapper = wrapperRef.current;

    if (!canvas || !effects || !camera || !wrapper) return;

    // Resize canvas to match wrapper
    const dpr = Math.min(window.devicePixelRatio, motionConfig.effects.maxDPR);
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cameraState = camera.getCamera();
    effects.draw({
      ctx,
      camera: cameraState,
      viewport: { w: width, h: height },
    });
  };

  // Animation loop
  useEffect(() => {
    if (!enabled || !initializedRef.current) return;

    const animate = (timestamp: number) => {
      // Throttle to target FPS
      const targetFrameTime = 1000 / motionConfig.performance.targetFPS;
      if (timestamp - lastFrameTimeRef.current < targetFrameTime) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      // Check if document is hidden
      if (motionConfig.performance.stopOnHidden && document.hidden) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      let hasActivity = false;

      // Tick camera
      if (cameraRef.current) {
        hasActivity = cameraRef.current.tick() || hasActivity;
      }

      // Tick director (which ticks effects)
      if (directorRef.current) {
        hasActivity = directorRef.current.tick() || hasActivity;
      }

      // Draw effects if canvas is available
      if (hasActivity && canvasRef.current) {
        drawEffects(timestamp);
      }

      // Continue loop if there's activity or we're in replay
      if (hasActivity || replay.isReplaying) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [enabled, replay.isReplaying]);

  // Handle replay events - separate useEffect to avoid nesting
  useEffect(() => {
    if (!directorRef.current || !replay.isReplaying) return;

    // The replay system adds events via addHistoricalEvent
    // which goes through the normal event processing pipeline
    // So we don't need special handling here
  }, [replay.isReplaying, directorRef]);

  // Expose test hooks in non-production
  useEffect(() => {
    if (import.meta.env.NODE_ENV !== 'production') {
      (window as any).__fxTest = {
        stats: () => ({
          director: directorRef.current?.stats(),
          effects: effectsRef.current?.stats(),
          camera: cameraRef.current?.getCamera(),
        }),
        camera: () => cameraRef.current?.getCamera(),
        director: () => directorRef.current,
        effects: () => effectsRef.current,
      };
    }

    return () => {
      if (import.meta.env.NODE_ENV !== 'production') {
        delete (window as any).__fxTest;
      }
    };
  }, [directorRef, effectsRef, cameraRef]);

  // Render canvas overlay
  return (
    <canvas
      ref={canvasRef}
      className="fx-canvas-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 10,
        width: '100%',
        height: '100%',
      }}
      aria-hidden="true"
    />
  );
}

/** Follow pill component - shown when auto-follow is suspended */
export function FollowPill({ onResume, suspended }: { onResume: () => void; suspended: boolean }) {
  if (!suspended) return null;

  return (
    <button
      className="fx-follow-pill"
      onClick={onResume}
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        padding: '8px 16px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        border: 'none',
        borderRadius: 20,
        fontSize: 13,
        cursor: 'pointer',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
      aria-label="Resume following agent activity"
    >
      Follow
    </button>
  );
}

/** Motion setting control */
export function MotionSetting({
  value,
  onChange,
}: {
  value: 'full' | 'reduced' | 'off';
  onChange: (value: 'full' | 'reduced' | 'off') => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as 'full' | 'reduced' | 'off')}
      style={{
        padding: '4px 8px',
        borderRadius: 4,
        border: '1px solid #ccc',
        background: 'white',
        fontSize: 12,
      }}
    >
      <option value="full">Full Motion</option>
      <option value="reduced">Reduced</option>
      <option value="off">Off</option>
    </select>
  );
}