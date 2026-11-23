import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { getApiBase, getToken } from '../config';
import { NodeHighlight } from '../types';
import './DiagramPanel.css';

interface DiagramPanelProps {
  diagramName?: string;
  onDiagramError?: (error: string) => void;
  highlights?: NodeHighlight[];
}

export function DiagramPanel({ diagramName = 'system-overview', onDiagramError, highlights = [] }: DiagramPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagramContent, setDiagramContent] = useState<string>('');
  const renderAttempted = useRef(false);

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
      setDiagramContent(content);
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

  const applyHighlights = useCallback((highlights: NodeHighlight[]) => {
    if (!containerRef.current) return;

    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    // Remove existing highlight styles
    const existingStyle = svg.querySelector('style[data-highlight-style]');
    if (existingStyle) {
      existingStyle.remove();
    }

    if (highlights.length === 0) return;

    // Build CSS for highlights
    const styleRules = highlights.map((h) => {
      const nodeId = `node-${h.node}`;
      return `
        #${nodeId} {
          stroke: ${h.color} !important;
          stroke-width: 3px !important;
          filter: drop-shadow(0 0 6px ${h.color}) !important;
          transition: stroke 0.3s, filter 0.3s;
        }
        #${nodeId} * {
          stroke: ${h.color} !important;
        }
      `;
    }).join('\n');

    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.setAttribute('data-highlight-style', 'true');
    styleElement.textContent = styleRules;
    svg.insertBefore(styleElement, svg.firstChild);
  }, []);

  const renderDiagram = useCallback(async () => {
    if (!containerRef.current || !diagramContent || renderAttempted.current) {
      return;
    }
    renderAttempted.current = true;

    const mermaidCode = extractMermaidCode(diagramContent);
    if (!mermaidCode) {
      setError('No mermaid diagram found in file');
      onDiagramError?.('No mermaid diagram found in file');
      return;
    }

    try {
      // Initialize mermaid with config
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
        },
      });

      // Render the diagram
      const { svg } = await mermaid.render(`diagram-${diagramName}`, mermaidCode);

      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
        // Apply highlights after rendering
        applyHighlights(highlights);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram';
      setError(errorMessage);
      onDiagramError?.(errorMessage);
    }
  }, [diagramContent, diagramName, onDiagramError, highlights, applyHighlights]);

  useEffect(() => {
    fetchDiagram();
  }, [fetchDiagram]);

  useEffect(() => {
    if (!isLoading && diagramContent) {
      renderAttempted.current = false;
      renderDiagram();
    }
  }, [isLoading, diagramContent, renderDiagram]);

  // Re-apply highlights when they change (without re-rendering diagram)
  useEffect(() => {
    if (!isLoading && diagramContent && containerRef.current) {
      applyHighlights(highlights);
    }
  }, [highlights, applyHighlights, isLoading, diagramContent]);

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
          renderAttempted.current = false;
          fetchDiagram();
        }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="diagram-panel" role="img" aria-label={`Architecture diagram: ${diagramName}`}>
      <div
        ref={containerRef}
        className="diagram-container"
        data-testid="diagram-container"
        data-diagram-name={diagramName}
      />
    </div>
  );
}