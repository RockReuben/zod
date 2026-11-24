import { useEffect, useState, useCallback } from 'react';
import { MermaidViewer } from './MermaidViewer';
import { parseMermaidNodes, diffDiagrams, renderPlanDiff, ParsedDiagram, DiagramDiff } from '../utils/planDiff';
import './PlanDiffPanel.css';

interface PlanDiffPanelProps {
  currentDiagram: string;
  proposedDiagram: string;
  onError?: (error: string) => void;
}

interface PlanDiffPanelState {
  isLoading: boolean;
  error: string | null;
  combinedDiagram: string;
  diff: DiagramDiff | null;
  currentParsed: ParsedDiagram | null;
  proposedParsed: ParsedDiagram | null;
}

export function PlanDiffPanel({ currentDiagram, proposedDiagram, onError }: PlanDiffPanelProps) {
  const [state, setState] = useState<PlanDiffPanelState>({
    isLoading: true,
    error: null,
    combinedDiagram: '',
    diff: null,
    currentParsed: null,
    proposedParsed: null,
  });

  const computeDiff = useCallback(() => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Parse both diagrams
      const currentParsed = parseMermaidNodes(currentDiagram);
      const proposedParsed = parseMermaidNodes(proposedDiagram);

      // Compute diff
      const diff = diffDiagrams(currentParsed, proposedParsed);

      // Render combined diagram
      const combinedDiagram = renderPlanDiff(currentDiagram, proposedDiagram);

      setState({
        isLoading: false,
        error: null,
        combinedDiagram,
        diff,
        currentParsed,
        proposedParsed,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compute plan diff';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      onError?.(errorMessage);
    }
  }, [currentDiagram, proposedDiagram, onError]);

  useEffect(() => {
    computeDiff();
  }, [computeDiff]);

  // Render legend
  const renderLegend = () => {
    if (!state.diff) return null;

    const hasAdded = state.diff.added.size > 0;
    const hasModified = state.diff.modified.size > 0;
    const hasRemoved = state.diff.removed.size > 0;
    const hasUnchanged = state.diff.unchanged.size > 0;

    if (!hasAdded && !hasModified && !hasRemoved && !hasUnchanged) return null;

    return (
      <div className="plan-diff-legend" role="region" aria-label="Plan diff legend">
        <h4>Legend</h4>
        <div className="legend-items">
          {hasAdded && (
            <div className="legend-item">
              <span className="legend-color added" aria-hidden="true" />
              <span>Added ({state.diff.added.size})</span>
            </div>
          )}
          {hasModified && (
            <div className="legend-item">
              <span className="legend-color modified" aria-hidden="true" />
              <span>Modified ({state.diff.modified.size})</span>
            </div>
          )}
          {hasRemoved && (
            <div className="legend-item">
              <span className="legend-color removed" aria-hidden="true" />
              <span>Removed ({state.diff.removed.size})</span>
            </div>
          )}
          {hasUnchanged && (
            <div className="legend-item">
              <span className="legend-color unchanged" aria-hidden="true" />
              <span>Unchanged ({state.diff.unchanged.size})</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (state.isLoading) {
    return (
      <div className="plan-diff-panel loading" role="status" aria-label="Computing plan diff">
        <div className="plan-diff-spinner" />
        <p>Computing plan diff…</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="plan-diff-panel error" role="alert" aria-label="Plan diff error">
        <div className="plan-diff-error-icon">⚠️</div>
        <h3>Failed to compute plan diff</h3>
        <p className="plan-diff-error-message">{state.error}</p>
        <button className="plan-diff-retry-btn" onClick={computeDiff}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="plan-diff-panel" role="img" aria-label="Plan diff diagram">
      <div className="plan-diff-content">
        <div className="plan-diff-diagram-wrapper">
          <MermaidViewer
            chart={state.combinedDiagram}
            containerClass="plan-diff-diagram-container"
            testId="plan-diff-diagram"
            showGrid={true}
            gridColor="#334155"
            gridThickness={1}
            backgroundOpacity={1}
          />
        </div>
        {renderLegend()}
      </div>
    </div>
  );
}