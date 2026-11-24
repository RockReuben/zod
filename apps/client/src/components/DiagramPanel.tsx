import { useEffect, useRef, useState, useCallback } from 'react';
import { getApiBase, getToken } from '../config';
import { NodeHighlight, DiffMode } from '../types';
import { MermaidViewer } from './MermaidViewer';
import { PlanDiffPanel } from './PlanDiffPanel';
import { FxLayer } from '../fx/FxLayer';
import './DiagramPanel.css';

interface DiagramPanelProps {
  diagramName?: string;
  onDiagramError?: (error: string) => void;
  highlights?: NodeHighlight[];
  diffMode?: DiffMode;
  proposedDiagram?: string;
}

// Extract mermaid code block from markdown
const extractMermaidCode = (content: string): string | null => {
  const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/;
  const match = content.match(mermaidRegex);
  console.log('[DiagramPanel] extractMermaidCode:', match ? 'found' : 'NOT FOUND', match?.[1]?.slice(0, 100));
  return match ? match[1].trim() : null;
};

export function DiagramPanel({
  diagramName = 'system-overview',
  onDiagramError,
  highlights = [],
  diffMode = 'none',
  proposedDiagram = ''
}: DiagramPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mermaidCode, setMermaidCode] = useState<string>('');
  const [renderKey, setRenderKey] = useState(0);
  const [diagramRendered, setDiagramRendered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const apiBase = getApiBase();
  const token = getToken();

  const fetchDiagram = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[DiagramPanel] Fetching diagram:', `${apiBase}/diagrams/${diagramName}`);
      const response = await fetch(`${apiBase}/diagrams/${diagramName}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('[DiagramPanel] Response status:', response.status);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Diagram "${diagramName}" not found`);
        }
        if (response.status === 401) {
          throw new Error('Unauthorized - check token');
        }
        throw new Error(`Failed to load diagram: ${response.status} ${response.statusText}`);
      }

      const content = await response.text();
      console.log('[DiagramPanel] Response content length:', content.length);
      const code = extractMermaidCode(content);
      if (!code) {
        console.log('[DiagramPanel] ERROR: No mermaid code extracted');
        throw new Error('No mermaid diagram found in file');
      }
      console.log('[DiagramPanel] Mermaid code length:', code.length);
      setMermaidCode(code);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.log('[DiagramPanel] ERROR:', errorMessage);
      setError(errorMessage);
      onDiagramError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [diagramName, apiBase, token, onDiagramError]);

  const applyHighlights = useCallback((svgEl: SVGSVGElement | null, highlights: NodeHighlight[]) => {
    if (!svgEl) return;

    // Remove existing highlight styles
    const existingStyle = svgEl.querySelector('style[data-highlight-style]');
    if (existingStyle) {
      existingStyle.remove();
    }

    if (highlights.length === 0) return;

    // Build selector list for a single node (matches all Mermaid ID patterns)
    const buildNodeSelector = (nodeName: string): string => {
      return `[id$="node-${nodeName}"], [id$="flowchart-node-${nodeName}"], [id$="flowchart-subgraph-${nodeName}"]`;
    };

    // Build CSS for highlights using the actual Mermaid-generated node ID pattern
    const styleRules = highlights.map((h) => {
      const selector = buildNodeSelector(h.node);
      return `
        ${selector} {
          stroke: ${h.color} !important;
          stroke-width: 5px !important;
          filter: drop-shadow(0 0 10px ${h.color}) drop-shadow(0 0 20px ${h.color}) !important;
          fill: ${h.color}22 !important;
          transition: stroke 0.3s, filter 0.3s, fill 0.3s;
          animation: pulse-highlight 1.5s ease-in-out infinite;
        }
        ${selector} * {
          stroke: ${h.color} !important;
          stroke-width: 2px !important;
        }
      `;
    }).join('\n');

    // Add keyframes for pulse animation
    const keyframes = `
      @keyframes pulse-highlight {
        0%, 100% {
          filter: drop-shadow(0 0 10px ${highlights[0].color}) drop-shadow(0 0 20px ${highlights[0].color});
        }
        50% {
          filter: drop-shadow(0 0 20px ${highlights[0].color}) drop-shadow(0 0 40px ${highlights[0].color});
        }
      }
    `;

    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.setAttribute('data-highlight-style', 'true');
    styleElement.textContent = keyframes + styleRules;
    svgEl.insertBefore(styleElement, svgEl.firstChild);
  }, []);

  // Re-render diagram when highlights change (to apply new highlights)
  const handleRendered = useCallback(() => {
    // Find the SVG element rendered by MermaidViewer
    const viewerContainer = svgContainerRef.current;
    if (viewerContainer) {
      const svgEl = viewerContainer.querySelector('svg');
      applyHighlights(svgEl, highlights);
      setDiagramRendered(true);
    }
  }, [highlights, applyHighlights]);

  useEffect(() => {
    handleRendered();
  }, [highlights, handleRendered]);

  useEffect(() => {
    // fetchDiagram calls setIsLoading/setError/setMermaidCode internally
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
    fetchDiagram();
  }, [fetchDiagram]);

  // If diff mode is active and we have a proposed diagram, render PlanDiffPanel
  if (diffMode !== 'none' && proposedDiagram) {
    return (
      <div className="diagram-panel" role="img" aria-label={`Plan diff: ${diagramName}`} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="diagram-panel-inner" style={{ flex: 1, height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
          <PlanDiffPanel
            currentDiagram={mermaidCode}
            proposedDiagram={proposedDiagram}
            onError={onDiagramError}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="diagram-panel loading" role="status" aria-label="Loading diagram">
        <div className="diagram-spinner" />
        <p>Loading diagram…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="diagram-panel error" role="alert" aria-label="Diagram error">
        <div className="diagram-error-icon">⚠️</div>
        <h3>Failed to load diagram</h3>
        <p className="diagram-error-message">{error}</p>
        <button className="diagram-retry-btn" onClick={() => {
          setRenderKey(k => k + 1);
          fetchDiagram();
        }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="diagram-panel" role="img" aria-label={`Architecture diagram: ${diagramName}`} style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Zod badge floating over diagram */}
      <div className="zod-badge" aria-hidden="true">Zod</div>

      <div className="diagram-panel-inner" style={{ flex: 1, height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <MermaidViewer
          chart={mermaidCode}
          renderKey={String(renderKey)}
          onError={onDiagramError}
          onRendered={handleRendered}
          wrapperClass="mermaid-viewer-wrapper"
          containerClass="mermaid-viewer-container"
          testId="diagram-container"
          asBackground={false}
          showGrid={true}
          gridColor="#334155"
          gridThickness={1}
          backgroundOpacity={1}
          wrapperRef={wrapperRef}
          containerRef={svgContainerRef}
        />
        {diagramRendered && (
          <FxLayer
            svgContainerRef={svgContainerRef}
            wrapperRef={wrapperRef}
            isReady={diagramRendered}
            diagramName={diagramName}
            enabled={true}
          />
        )}
      </div>
    </div>
  );
}