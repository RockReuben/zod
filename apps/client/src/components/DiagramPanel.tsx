import { useEffect, useRef, useState, useCallback } from 'react';
import { getApiBase, getToken } from '../config';
import { NodeHighlight } from '../types';
import { MermaidViewer } from './MermaidViewer';
import './DiagramPanel.css';

interface DiagramPanelProps {
  diagramName?: string;
  onDiagramError?: (error: string) => void;
  highlights?: NodeHighlight[];
}

export function DiagramPanel({ diagramName = 'system-overview', onDiagramError, highlights = [] }: DiagramPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mermaidCode, setMermaidCode] = useState<string>('');
  const renderKeyRef = useRef(0);

  const apiBase = getApiBase();
  const token = getToken();

  const fetchDiagram = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/diagrams/${diagramName}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

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
      const code = extractMermaidCode(content);
      if (!code) {
        throw new Error('No mermaid diagram found in file');
      }
      setMermaidCode(code);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onDiagramError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [diagramName, apiBase, token, onDiagramError]);

  const extractMermaidCode = (content: string): string | null => {
    // Extract mermaid code block from markdown
    const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/;
    const match = content.match(mermaidRegex);
    return match ? match[1].trim() : null;
  };

  const applyHighlights = useCallback((svgEl: SVGSVGElement | null, highlights: NodeHighlight[]) => {
    if (!svgEl) return;

    // Remove existing highlight styles
    const existingStyle = svgEl.querySelector('style[data-highlight-style]');
    if (existingStyle) {
      existingStyle.remove();
    }

    if (highlights.length === 0) return;

    // Get the SVG's ID to construct the mermaid-generated node IDs
    // Mermaid generates IDs like: {svgId}-flowchart-node-{nodeName}-{index}
    const svgId = svgEl.id || 'mermaid-svg';
    const prefix = `${svgId}-flowchart`;

    // Build CSS for highlights using the mermaid-generated ID pattern
    const styleRules = highlights.map((h) => {
      // Match any element whose ID ends with -flowchart-node-{nodeName}-{number}
      // Using attribute selector: [id$="suffix"] matches elements whose ID ends with suffix
      return `
        [id$="-flowchart-node-${h.node}-0"],
        [id$="-flowchart-node-${h.node}-1"],
        [id$="-flowchart-node-${h.node}-2"],
        [id$="-flowchart-node-${h.node}-3"],
        [id$="-flowchart-node-${h.node}-4"],
        [id$="-flowchart-node-${h.node}-5"] {
          stroke: ${h.color} !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0 0 6px ${h.color}) !important;
          transition: stroke 0.3s, filter 0.3s;
        }
        [id$="-flowchart-node-${h.node}-0"] *,
        [id$="-flowchart-node-${h.node}-1"] *,
        [id$="-flowchart-node-${h.node}-2"] *,
        [id$="-flowchart-node-${h.node}-3"] *,
        [id$="-flowchart-node-${h.node}-4"] *,
        [id$="-flowchart-node-${h.node}-5"] * {
          stroke: ${h.color} !important;
        }
      `;
    }).join('\n');

    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.setAttribute('data-highlight-style', 'true');
    styleElement.textContent = styleRules;
    svgEl.insertBefore(styleElement, svgEl.firstChild);
  }, []);

  // Re-render diagram when highlights change (to apply new highlights)
  const handleRendered = useCallback(() => {
    // Find the SVG element rendered by MermaidViewer
    const viewerContainer = document.querySelector('.mermaid-viewer-container');
    if (viewerContainer) {
      const svgEl = viewerContainer.querySelector('svg');
      applyHighlights(svgEl, highlights);
    }
  }, [highlights, applyHighlights]);

  useEffect(() => {
    handleRendered();
  }, [highlights, handleRendered]);

  useEffect(() => {
    fetchDiagram();
  }, [fetchDiagram]);

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
          renderKeyRef.current += 1;
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

      <div className="diagram-panel-inner" style={{ flex: 1, height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <MermaidViewer
          chart={mermaidCode}
          renderKey={String(renderKeyRef.current)}
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
        />
      </div>
    </div>
  );
}