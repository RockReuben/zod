import { useMemo, useEffect } from 'react';
import { useEventsStore } from '../stores/events';
import { useEventStream } from '../hooks/useEventStream';
import { ConnectionStatus, DiffMode } from '../types';
import { AssumptionsPanel } from './AssumptionsPanel';
import './ControlPane.css';

interface ControlPaneProps {
  onDiagramChange?: (diagramName: string) => void;
  activeDiagram?: string;
}

export function ControlPane({ onDiagramChange, activeDiagram = 'system-overview' }: ControlPaneProps) {
  const { status } = useEventStream();
  const filters = useEventsStore((s) => s.filters);
  const setFilter = useEventsStore((s) => s.setFilter);
  const events = useEventsStore((s) => s.events);
  const replay = useEventsStore((s) => s.replay);
  const availableFilters = useEventsStore((s) => s.getAvailableFilters());
  const trackReads = useEventsStore((s) => s.trackReads);
  const setTrackReads = useEventsStore((s) => s.setTrackReads);
  const trackSearches = useEventsStore((s) => s.trackSearches);
  const setTrackSearches = useEventsStore((s) => s.setTrackSearches);

  // Plan diff state
  const planDiff = useEventsStore((s) => s.planDiff);
  const setActivePlan = useEventsStore((s) => s.setActivePlan);
  const setDiffMode = useEventsStore((s) => s.setDiffMode);
  const setAvailablePlans = useEventsStore((s) => s.setAvailablePlans);

  // Compute stats
  const stats = useMemo(() => {
    const totalEvents = events.length;
    const activeSessions = new Set(events.map(e => e.session_id)).size;
    const activeAgents = new Set(events.map(e => e.agent_name).filter(Boolean)).size;
    return { totalEvents, activeSessions, activeAgents };
  }, [events]);

  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected': return '#22c55e';
      case 'reconnecting': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#64748b';
    }
  };

  const getStatusLabel = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected': return 'Live';
      case 'reconnecting': return 'Reconnecting…';
      case 'error': return 'Error';
      default: return 'Disconnected';
    }
  };

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilter(key, value);
  };

  // Load available plans on mount
  useEffect(() => {
    const knownPlans = ['sample-plan'];
    const planInfos = knownPlans.map(name => ({
      name,
      path: `docs/plans/${name}/`,
      hasProposedDiagram: true,
    }));
    setAvailablePlans(planInfos);
  }, [setAvailablePlans]);

  const handlePlanChange = (planName: string | null) => {
    setActivePlan(planName);
    // When plan changes, reset diff mode
    if (!planName) {
      setDiffMode('none');
    }
  };

  const handleDiffModeChange = (mode: DiffMode) => {
    setDiffMode(mode);
  };

  return (
    <div className="control-pane">
      {/* Header */}
      <header className="control-pane-header">
        <h2 className="control-pane-title">Controls</h2>
        <div
          className="control-status-badge"
          style={{ '--status-color': getStatusColor(status) } as React.CSSProperties}
        >
          <span className="control-status-dot" />
          <span className="control-status-text">
            {replay.isReplaying ? `Replay (${replay.replaySpeed}x)` : getStatusLabel(status)}
          </span>
        </div>
      </header>

      {/* Diagram Selector */}
      <section className="control-section">
        <label className="control-label" htmlFor="diagram-select">Diagram</label>
        <select
          id="diagram-select"
          className="control-select"
          value={activeDiagram}
          onChange={(e) => onDiagramChange?.(e.target.value)}
        >
          <option value="system-overview">System Overview</option>
          {/* Future diagrams can be added here */}
        </select>
      </section>

      {/* Plan Selector */}
      <section className="control-section">
        <label className="control-label" htmlFor="plan-select">Plan</label>
        <select
          id="plan-select"
          className="control-select"
          value={planDiff.activePlan || 'none'}
          onChange={(e) => handlePlanChange(e.target.value || null)}
        >
          <option value="none">No Plan (Current Only)</option>
          {planDiff.availablePlans.map((plan) => (
            <option key={plan.name} value={plan.name}>{plan.name}</option>
          ))}
        </select>
      </section>

      {/* Diff Mode Selector */}
      <section className="control-section">
        <label className="control-label" htmlFor="diff-mode-select">Diff Mode</label>
        <select
          id="diff-mode-select"
          className="control-select"
          value={planDiff.diffMode}
          onChange={(e) => handleDiffModeChange(e.target.value as DiffMode)}
          disabled={!planDiff.activePlan}
        >
          <option value="none">None (Current Only)</option>
          <option value="overlay">Overlay (Single Canvas)</option>
          <option value="side-by-side">Side by Side</option>
          <option value="code">Code Changes</option>
        </select>
      </section>

      {/* Filters */}
      <section className="control-section">
        <label className="control-label" htmlFor="session-filter">Session</label>
        <select
          id="session-filter"
          className="control-select"
          value={filters.sourceApp}
          onChange={(e) => handleFilterChange('sourceApp', e.target.value)}
        >
          <option value="all">All Sessions</option>
          {availableFilters.sourceApps.map((app) => (
            <option key={app} value={app}>{app}</option>
          ))}
        </select>
      </section>

      <section className="control-section">
        <label className="control-label" htmlFor="agent-filter">Agent</label>
        <select
          id="agent-filter"
          className="control-select"
          value={filters.agentName}
          onChange={(e) => handleFilterChange('agentName', e.target.value)}
        >
          <option value="all">All Agents</option>
          {availableFilters.agentNames.map((agent) => (
            <option key={agent} value={agent}>{agent}</option>
          ))}
        </select>
      </section>

      <section className="control-section">
        <label className="control-label" htmlFor="event-filter">Event Type</label>
        <select
          id="event-filter"
          className="control-select"
          value={filters.eventType}
          onChange={(e) => handleFilterChange('eventType', e.target.value)}
        >
          <option value="all">All Types</option>
          {availableFilters.eventTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </section>

      {/* Show Reads Toggle */}
      <section className="control-section">
        <label className="control-label" htmlFor="track-reads-toggle">Show Reads</label>
        <div className="control-toggle">
          <input
            type="checkbox"
            id="track-reads-toggle"
            checked={trackReads}
            onChange={(e) => setTrackReads(e.target.checked)}
            title="Show file read events on diagram"
          />
          <label htmlFor="track-reads-toggle" className="control-toggle-label">
            Show file reads on diagram
          </label>
        </div>
      </section>

      {/* Show Searches Toggle */}
      <section className="control-section">
        <label className="control-label" htmlFor="track-searches-toggle">Show Searches</label>
        <div className="control-toggle">
          <input
            type="checkbox"
            id="track-searches-toggle"
            checked={trackSearches}
            onChange={(e) => setTrackSearches(e.target.checked)}
            title="Show file search events (Grep/Glob) on diagram"
          />
          <label htmlFor="track-searches-toggle" className="control-toggle-label">
            Show file searches on diagram
          </label>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="control-section control-stats">
        <div className="control-stats-grid">
          <div className="control-stat">
            <span className="control-stat-value">{stats.totalEvents}</span>
            <span className="control-stat-label">Events</span>
          </div>
          <div className="control-stat">
            <span className="control-stat-value">{stats.activeSessions}</span>
            <span className="control-stat-label">Sessions</span>
          </div>
          <div className="control-stat">
            <span className="control-stat-value">{stats.activeAgents}</span>
            <span className="control-stat-label">Agents</span>
          </div>
        </div>
      </section>

      {/* Reset Filters Button */}
      <section className="control-section">
        <button
          className="control-reset-btn"
          onClick={() => {
            setFilter('sourceApp', 'all');
            setFilter('agentName', 'all');
            setFilter('eventType', 'all');
          }}
          disabled={filters.sourceApp === 'all' && filters.agentName === 'all' && filters.eventType === 'all'}
        >
          Reset Filters
        </button>
      </section>

      {/* Plan Assumptions Panel */}
      {planDiff.activePlan && (
        <section className="control-section assumptions-section-wrapper">
          <AssumptionsPanel planName={planDiff.activePlan} />
        </section>
      )}
    </div>
  );
}