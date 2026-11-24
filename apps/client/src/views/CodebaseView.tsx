import { useEffect, useRef, useCallback } from 'react';
import { useCodeGraphStore, selectMode, selectSyncStatus, selectIsConnected } from '../stores/codeGraph';
import { useCodeGraph } from '../hooks/useCodeGraph';
import { CodebaseCanvas } from '../components/CodebaseCanvas';
import { CodebaseModeSwitcher } from '../components/CodebaseModeSwitcher';
import { CameraController } from '../fx/CameraController';
import { motionConfig } from '../fx/motionConfig';
import { useEventsStore, selectReducedMotion } from '../stores/events';
import './CodebaseView.css';

export function CodebaseView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const mode = useCodeGraphStore(selectMode);
  const syncStatus = useCodeGraphStore(selectSyncStatus);
  const isConnected = useCodeGraphStore(selectIsConnected);
  const reducedMotion = useEventsStore(selectReducedMotion);

  // Shared camera (could be shared with DiagramPanel in future)
  const cameraControllerRef = useRef<CameraController | null>(null);

  // Initialize camera
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    // Create a mock pan/zoom for camera controller
    let panZoom = { x: 0, y: 0, k: 1 };

    const clock = { now: () => performance.now() };

    cameraControllerRef.current = new CameraController({
      clock,
      config: motionConfig,
      onChange: (camera) => {
        panZoom = camera;
      },
      getCurrentPanZoom: () => panZoom,
      setPanZoom: (x: number, y: number, k: number) => {
        panZoom = { x, y, k };
      },
    });

    return () => {
      cameraControllerRef.current = null;
    };
  }, []);

  // Connect to code graph WebSocket
  const { requestResync } = useCodeGraph({
    enabled: true,
    onSnapshot: () => {
      console.log('[CodebaseView] Snapshot received');
    },
    onDelta: (delta) => {
      console.log('[CodebaseView] Delta received:', delta);
    },
    onError: (error) => {
      console.error('[CodebaseView] Connection error:', error);
    },
  });

  const handleRetry = useCallback(() => {
    requestResync();
  }, [requestResync]);

  return (
    <div className="codebase-view" ref={containerRef}>
      {/* Header bar */}
      <header className="codebase-header">
        <div className="header-left">
          <h1 className="codebase-title">Codebase</h1>
          <CodebaseModeSwitcher />
        </div>
        <div className="header-right">
          <div className="sync-status" data-status={syncStatus}>
            <span className="sync-indicator" />
            <span className="sync-text">
              {syncStatus === 'synced' && 'Synced'}
              {syncStatus === 'stale' && 'Stale'}
              {syncStatus === 'resyncing' && 'Resyncing…'}
              {syncStatus === 'disconnected' && 'Disconnected'}
            </span>
          </div>
          {!isConnected && syncStatus === 'disconnected' && (
            <button className="retry-btn" onClick={handleRetry} title="Reconnect">
              Retry
            </button>
          )}
        </div>
      </header>

      {/* Main canvas area */}
      <main className="codebase-main">
        <div
          ref={canvasContainerRef}
          className="codebase-canvas-container"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <CodebaseCanvas
            containerRef={canvasContainerRef}
            cameraController={cameraControllerRef.current || undefined}
            enabled={true}
            reducedMotion={reducedMotion}
          />
        </div>
      </main>

      {/* Legend / Info panel */}
      <aside className="codebase-legend" aria-label="Codebase legend">
        <div className="legend-section">
          <h3>Node Types</h3>
          <ul className="legend-list">
            <li>
              <span className="legend-swatch dir" />
              <span>Directory</span>
            </li>
            <li>
              <span className="legend-swatch file" style={{ background: '#3178c6' }} />
              <span>TypeScript File</span>
            </li>
            <li>
              <span className="legend-swatch file" style={{ background: '#3776ab' }} />
              <span>Python File</span>
            </li>
            <li>
              <span className="legend-swatch file" style={{ background: '#f7df1e' }} />
              <span>JavaScript File</span>
            </li>
            <li>
              <span className="legend-swatch file" style={{ background: '#64748b' }} />
              <span>Other File</span>
            </li>
          </ul>
        </div>
        <div className="legend-section">
          <h3>Connections</h3>
          <ul className="legend-list">
            <li>
              <span className="legend-line hierarchy" />
              <span>Directory Hierarchy</span>
            </li>
            <li>
              <span className="legend-line import" />
              <span>Import Dependency</span>
            </li>
          </ul>
        </div>
        <div className="legend-section">
          <h3>Agent Activity</h3>
          <ul className="legend-list">
            <li>
              <span className="legend-agent" />
              <span>Agent Avatar (colored by agent)</span>
            </li>
            <li>
              <span className="legend-trail" />
              <span>Movement Trail</span>
            </li>
          </ul>
        </div>
        {mode !== 'gource' && (
          <div className="coming-soon">
            <p>🚧 {mode} mode is not yet implemented</p>
            <p className="coming-soon-hint">Select "Gource Tree" to view the animated directory tree</p>
          </div>
        )}
      </aside>
    </div>
  );
}