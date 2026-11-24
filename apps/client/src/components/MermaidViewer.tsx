import { useEffect, useRef, useState, useId, useCallback } from 'react';
import mermaid from 'mermaid';
import svgPanZoom from 'svg-pan-zoom';

/**
 * Reusable Mermaid diagram viewer with pan/zoom, auto-fit, and responsive resize.
 * Can render as a full-screen background layer with optional grid pattern.
 */
interface MermaidViewerProps {
  /** The raw mermaid diagram code (not markdown-wrapped) */
  chart: string;
  /** Optional unique key to force re-render when chart changes */
  renderKey?: string;
  /** Optional callback when render fails */
  onError?: (error: string) => void;
  /** Optional callback when render succeeds */
  onRendered?: () => void;
  /** CSS class for the outer wrapper */
  wrapperClass?: string;
  /** CSS class for the inner SVG container */
  containerClass?: string;
  /** Optional test ID for testing */
  testId?: string;
  /** Whether to render as full-screen background (fixed position, covers viewport) */
  asBackground?: boolean;
  /** Whether to show grid pattern in the diagram (Mermaid flowchart grid option) */
  showGrid?: boolean;
  /** Grid color (CSS color string) */
  gridColor?: string;
  /** Grid line thickness */
  gridThickness?: number;
  /** Opacity of the background diagram (0-1) */
  backgroundOpacity?: number;
}

export function MermaidViewer({
  chart,
  renderKey,
  onError,
  onRendered,
  wrapperClass = 'mermaid-viewer-wrapper',
  containerClass = 'mermaid-viewer-container',
  testId,
  asBackground = false,
  showGrid = false,
  gridColor = '#334155',
  gridThickness = 1,
  backgroundOpacity = 0.15,
}: MermaidViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<ReturnType<typeof svgPanZoom> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const renderIdRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate a unique ID for each render (sanitized for mermaid)
  const uniqueId = useId().replace(/:/g, '-');

  // Initialize mermaid once with optimal settings
  useEffect(() => {
    const flowchartConfig: Record<string, unknown> = {
      useMaxWidth: false,
      htmlLabels: true,
      curve: 'basis',
    };

    // Add grid configuration if enabled
    if (showGrid) {
      flowchartConfig.grid = {
        pattern: 'dots',
        color: gridColor,
        thickness: gridThickness,
        spacing: 40,
      };
    }

    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      // Disable useMaxWidth so Mermaid outputs natural SVG dimensions
      flowchart: flowchartConfig,
      sequence: { useMaxWidth: false },
      class: { useMaxWidth: false },
      state: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
      pie: { useMaxWidth: false },
      requirement: { useMaxWidth: false },
      journey: { useMaxWidth: false },
      gitGraph: { useMaxWidth: false },
      mindmap: { useMaxWidth: false },
      timeline: { useMaxWidth: false },
    });
  }, [showGrid, gridColor, gridThickness]);

  const destroyPanZoom = useCallback(() => {
    if (panZoomRef.current) {
      panZoomRef.current.destroy();
      panZoomRef.current = null;
    }
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
  }, []);

  const initializePanZoom = useCallback((svgEl: SVGSVGElement) => {
    // Strip Mermaid's restrictive inline styles
    svgEl.removeAttribute('height');
    svgEl.removeAttribute('width');
    svgEl.style.maxWidth = 'none';
    svgEl.style.width = '100%';
    svgEl.style.height = '100%';
    // Ensure the SVG fills its container and is visible
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    // Force the SVG to be visible
    svgEl.style.display = 'block';
    svgEl.style.visibility = 'visible';
    svgEl.style.opacity = '1';

    // Initialize pan/zoom
    const instance = svgPanZoom(svgEl, {
      zoomEnabled: true,
      controlIconsEnabled: true,
      fit: true,
      center: true,
      minZoom: 0.1,
      maxZoom: 10,
      beforeZoom: () => true,
      onZoom: () => {},
      onPan: () => {},
    });

    panZoomRef.current = instance;

    // Set up ResizeObserver on the wrapper (not the SVG)
    if (wrapperRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (panZoomRef.current) {
          panZoomRef.current.resize();
          panZoomRef.current.fit();
          panZoomRef.current.center();
        }
      });
      resizeObserverRef.current.observe(wrapperRef.current);
    }
  }, []);

  const renderChart = async () => {
    console.log('[MermaidViewer] renderChart called, chart length:', chart.length, 'container:', !!containerRef.current, 'containerRef.current:', containerRef.current);
    if (!containerRef.current || !chart.trim()) {
      console.log('[MermaidViewer] Early return - no container or empty chart');
      setIsLoading(false);
      return;
    }

    // Increment render ID to track stale renders
    const currentRenderId = ++renderIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      // Wait for fonts to be ready so Mermaid calculates text bounds correctly
      await document.fonts.ready;

      // Ignore stale renders - only check renderId (isMountedRef is unreliable with StrictMode)
      if (currentRenderId !== renderIdRef.current) {
        console.log('[MermaidViewer] Early return - stale render', { currentId: currentRenderId, refId: renderIdRef.current });
        return;
      }

      if (!containerRef.current) {
        console.log('[MermaidViewer] Early return - containerRef.current is null');
        return;
      }

      // Render the diagram
      const { svg } = await mermaid.render(`mermaid-${uniqueId}-${currentRenderId}`, chart);
      console.log('[MermaidViewer] mermaid.render returned, SVG length:', svg.length);

      // Ignore stale renders
      if (currentRenderId !== renderIdRef.current) {
        console.log('[MermaidViewer] Early return - stale render after render', { currentId: currentRenderId, refId: renderIdRef.current });
        return;
      }

      if (!containerRef.current) {
        console.log('[MermaidViewer] Early return - containerRef.current is null');
        return;
      }

      // Inject SVG
      containerRef.current.innerHTML = svg;
      console.log('[MermaidViewer] SVG injected into container');
      console.log('[MermaidViewer] Container innerHTML length:', containerRef.current.innerHTML.length);

      // Get the rendered SVG element
      const svgEl = containerRef.current.querySelector('svg');
      console.log('[MermaidViewer] SVG element found:', !!svgEl);
      if (svgEl) {
        console.log('[MermaidViewer] SVG element:', svgEl.tagName, svgEl.id, svgEl.getAttribute('width'), svgEl.getAttribute('height'));
        console.log('[MermaidViewer] SVG viewBox:', svgEl.getAttribute('viewBox'));
        console.log('[MermaidViewer] SVG style:', svgEl.style.cssText);
      } else {
        console.log('[MermaidViewer] Container innerHTML preview:', containerRef.current.innerHTML.slice(0, 200));
      }
      if (!svgEl) {
        throw new Error('Mermaid did not produce an SVG element');
      }

      // Initialize pan/zoom after SVG is in DOM
      initializePanZoom(svgEl);

      onRendered?.();
      console.log('[MermaidViewer] renderChart completed successfully');
    } catch (err) {
      // Only handle error if this render is still current
      if (currentRenderId !== renderIdRef.current) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      // Only set loading false if this render is still current
      if (currentRenderId === renderIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Render when chart or renderKey changes
  useEffect(() => {
    renderChart();
    return () => {
      destroyPanZoom();
    };
  }, [chart, renderKey, showGrid, gridColor, gridThickness]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`${wrapperClass} loading`} role="status" aria-label="Loading diagram">
        <div className="mermaid-spinner" />
        <p>Loading diagram…</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`${wrapperClass} error`} role="alert" aria-label="Diagram error">
        <div className="mermaid-error-icon">⚠️</div>
        <h3>Failed to render diagram</h3>
        <p className="mermaid-error-message">{error}</p>
        <button
          className="mermaid-retry-btn"
          onClick={() => {
            renderIdRef.current = 0;
            renderChart();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const wrapperStyles: React.CSSProperties = asBackground
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: backgroundOpacity,
      }
    : { width: '100%', height: '100%' };

  const containerStyles: React.CSSProperties = {
    width: '100%',
    height: '100%',
  };

  return (
    <div
      className={wrapperClass}
      ref={wrapperRef}
      style={wrapperStyles}
    >
      <div className={containerClass} ref={containerRef} style={containerStyles} data-testid={testId} />
    </div>
  );
}

// Export a hook version for more control if needed
export function useMermaidRenderer() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<ReturnType<typeof svgPanZoom> | null>(null);
  const renderIdRef = useRef(0);

  const render = async (chart: string) => {
    if (!containerRef.current || !chart.trim()) return;

    const currentRenderId = ++renderIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      await document.fonts.ready;
      if (currentRenderId !== renderIdRef.current) return;

      const { svg } = await mermaid.render(`mermaid-${Date.now()}-${currentRenderId}`, chart);

      if (currentRenderId !== renderIdRef.current) return;
      if (!containerRef.current) return;

      containerRef.current.innerHTML = svg;
      const svgEl = containerRef.current.querySelector('svg');
      if (!svgEl) throw new Error('Mermaid did not produce an SVG element');

      // Strip restrictive styles
      svgEl.removeAttribute('height');
      svgEl.removeAttribute('width');
      svgEl.style.maxWidth = 'none';
      svgEl.style.width = '100%';
      svgEl.style.height = '100%';
      svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      panZoomRef.current = svgPanZoom(svgEl, {
        zoomEnabled: true,
        controlIconsEnabled: true,
        fit: true,
        center: true,
        minZoom: 0.1,
        maxZoom: 10,
      });
    } catch (err) {
      if (currentRenderId !== renderIdRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
      setError(errorMessage);
    } finally {
      if (currentRenderId === renderIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const reset = () => {
    if (panZoomRef.current) {
      panZoomRef.current.destroy();
      panZoomRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  };

  return { containerRef, render, reset, isLoading, error };
}