import { useEffect, useRef, useState, useId } from 'react';
import mermaid from 'mermaid';
import svgPanZoom from 'svg-pan-zoom';

type SvgPanZoomInstance = ReturnType<typeof svgPanZoom>;

/**
 * Reusable Mermaid diagram viewer with pan/zoom, auto-fit, and responsive resize.
 * Keeps diagrams centered, scales to fit container, and supports pan/zoom controls.
 */
interface MermaidViewerProps {
  /** The raw mermaid diagram code (not markdown-wrapped) */
  chart: string;
  /** Optional unique key to force re-render when chart changes */
  key?: string;
  /** Optional callback when render fails */
  onError?: (error: string) => void;
  /** Optional callback when render succeeds */
  onRendered?: () => void;
  /** CSS class for the outer wrapper (must have explicit width/height) */
  wrapperClass?: string;
  /** CSS class for the inner SVG container */
  containerClass?: string;
  /** Optional test ID for testing */
  testId?: string;
}

export function MermaidViewer({
  chart,
  key,
  onError,
  onRendered,
  wrapperClass = 'mermaid-viewer-wrapper',
  containerClass = 'mermaid-viewer-container',
  testId,
}: MermaidViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<SvgPanZoomInstance | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const renderIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate a unique ID for each render (sanitized for mermaid)
  const uniqueId = useId().replace(/:/g, '-');

  // Initialize mermaid once with optimal settings
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      // Disable useMaxWidth so Mermaid outputs natural SVG dimensions
      flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' },
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
  }, []);

  const destroyPanZoom = () => {
    if (panZoomRef.current) {
      panZoomRef.current.destroy();
      panZoomRef.current = null;
    }
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
  };

  const initializePanZoom = (svgEl: SVGSVGElement) => {
    // Strip Mermaid's restrictive inline styles
    svgEl.removeAttribute('height');
    svgEl.removeAttribute('width');
    svgEl.style.maxWidth = 'none';
    svgEl.style.width = '100%';
    svgEl.style.height = '100%';
    // Ensure the SVG fills its container
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');

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
  };

  const renderChart = async () => {
    if (!containerRef.current || !chart.trim()) {
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

      // Ignore stale renders
      if (!isMountedRef.current || currentRenderId !== renderIdRef.current) {
        return;
      }

      // Render the diagram
      const { svg } = await mermaid.render(`mermaid-${uniqueId}-${currentRenderId}`, chart);

      if (!isMountedRef.current || currentRenderId !== renderIdRef.current) {
        return;
      }

      if (!containerRef.current) return;

      // Inject SVG
      containerRef.current.innerHTML = svg;

      // Get the rendered SVG element
      const svgEl = containerRef.current.querySelector('svg');
      if (!svgEl) {
        throw new Error('Mermaid did not produce an SVG element');
      }

      // Initialize pan/zoom after SVG is in DOM
      initializePanZoom(svgEl);

      onRendered?.();
    } catch (err) {
      if (!isMountedRef.current || currentRenderId !== renderIdRef.current) {
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      if (isMountedRef.current && currentRenderId === renderIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Render when chart or key changes
  useEffect(() => {
    isMountedRef.current = true;
    renderChart();
    return () => {
      isMountedRef.current = false;
      destroyPanZoom();
    };
  }, [chart, key]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      destroyPanZoom();
    };
  }, []);

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

  return (
    <div className={wrapperClass} ref={wrapperRef} style={{ width: '100%', height: '100%' }}>
      <div className={containerClass} ref={containerRef} style={{ width: '100%', height: '100%' }} data-testid={testId} />
    </div>
  );
}

// Export a hook version for more control if needed
export function useMermaidRenderer() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panZoomRef = useRef<SvgPanZoomInstance | null>(null);
  const renderIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const render = async (chart: string) => {
    if (!containerRef.current || !chart.trim()) return;

    const currentRenderId = ++renderIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      await document.fonts.ready;
      if (!isMountedRef.current || currentRenderId !== renderIdRef.current) return;

      const { svg } = await mermaid.render(`mermaid-${Date.now()}-${currentRenderId}`, chart);

      if (!isMountedRef.current || currentRenderId !== renderIdRef.current) return;
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
      if (!isMountedRef.current || currentRenderId !== renderIdRef.current) return;
      const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
      setError(errorMessage);
    } finally {
      if (isMountedRef.current && currentRenderId === renderIdRef.current) {
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