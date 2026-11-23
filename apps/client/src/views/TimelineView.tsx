import { useEffect, useState, useMemo } from 'react';
import { useEventStream } from '../hooks/useEventStream';
import { useEventsStore } from '../stores/events';
import { TimelineLane } from '../components/TimelineLane';
import { FilterBar } from '../components/FilterBar';
import { ConnectionStatus, SessionInfo, isDiagramEvent } from '../types';
import './TimelineView.css';

const REPLAY_SPEEDS = [1, 2, 5, 10];

function DiagramEventsIndicator() {
  const events = useEventsStore((s) => s.events);
  const diagramEvents = useMemo(() => {
    return events
      .filter((e) => isDiagramEvent(e.event_type))
      .map((e) => ({
        event: e,
        diagram: e.tool_input?.diagram as string | undefined,
        node: e.tool_input?.node as string | undefined,
        reason: e.tool_input?.reason as string | undefined,
      }));
  }, [events]);

  if (diagramEvents.length === 0) return null;

  // Count by type
  const unmappedCount = diagramEvents.filter((d) => d.event.event_type === 'unmapped_edit').length;
  const driftCount = diagramEvents.filter((d) => d.event.event_type === 'diagram_drift').length;

  return (
    <div className="diagram-events-indicator" role="region" aria-label="Diagram mapping warnings">
      <div className="diagram-events-header">
        <span className="diagram-events-icon">⚠️</span>
        <span className="diagram-events-title">Diagram Mapping Issues</span>
        <span className="diagram-events-count">
          {unmappedCount > 0 && <span className="unmapped-count">Unmapped: {unmappedCount}</span>}
          {driftCount > 0 && <span className="drift-count">Drift: {driftCount}</span>}
        </span>
      </div>
      <ul className="diagram-events-list" aria-label="List of diagram mapping issues">
        {diagramEvents.slice(-10).map((d, idx) => (
          <li key={`${d.event.event_id}-${idx}`} className={`diagram-event-item ${d.event.event_type}`}>
            <span className="diagram-event-type">{d.event.event_type}</span>
            <span className="diagram-event-file">{d.event.tool_input?.file_path as string}</span>
            {d.diagram && (
              <>
                <span className="diagram-event-diagram">→ {d.diagram}</span>
                <span className="diagram-event-node">({d.node})</span>
              </>
            )}
            {d.reason && <span className="diagram-event-reason">{d.reason}</span>}
            <span className="diagram-event-time">
              {d.event.timestamp ? new Date(d.event.timestamp * 1000).toLocaleTimeString() : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const formatSessionLabel = (session: SessionInfo): string => {
  const date = new Date(session.start_time * 1000);
  const timeStr = date.toLocaleTimeString();
  return `${session.session_id} (${session.source_app}, ${session.agent_name}, ${session.event_count} events, ${timeStr})`;
};

export function TimelineView() {
  const { status } = useEventStream();
  const lanes = useEventsStore((s) => s.getFilteredLanes());
  const totalEvents = useEventsStore((s) => s.events.length);
  const visibleEvents = lanes.reduce((sum, lane) => sum + lane.events.length, 0);

  const replay = useEventsStore((s) => s.replay);
  const fetchSessions = useEventsStore((s) => s.fetchSessions);
  const startReplay = useEventsStore((s) => s.startReplay);
  const stopReplay = useEventsStore((s) => s.stopReplay);
  const setReplaySpeed = useEventsStore((s) => s.setReplaySpeed);

  const [showReplaySelector, setShowReplaySelector] = useState(false);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const getStatusColor = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return '#22c55e';
      case 'reconnecting':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getStatusLabel = (status: ConnectionStatus): string => {
    switch (status) {
      case 'connected':
        return 'Live';
      case 'reconnecting':
        return 'Reconnecting…';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className="timeline-view">
      <header className="view-header">
        <h1>Zod Control Center</h1>
        <div className="header-right">
          <div
            className="status-badge"
            style={{ '--status-color': getStatusColor(status) } as React.CSSProperties}
          >
            <span className="status-dot" />
            <span className="status-text">
              {replay.isReplaying ? `Replay (${replay.replaySpeed}x)` : getStatusLabel(status)}
            </span>
          </div>
          <div className="lane-count">
            {lanes.length} session{lanes.length !== 1 ? 's' : ''}
            {totalEvents > 0 && (
              <span className="event-count-detail">
                · {visibleEvents} of {totalEvents} events
              </span>
            )}
          </div>
        </div>
      </header>

      {replay.isReplaying ? (
        <ReplayControlsBar
          progress={replay.replayProgress}
          speed={replay.replaySpeed}
          onSpeedChange={setReplaySpeed}
          onStop={stopReplay}
        />
      ) : (
        <>
          <div className="replay-toggle-row">
            <button
              className={`replay-toggle-btn ${showReplaySelector ? 'active' : ''}`}
              onClick={() => setShowReplaySelector(!showReplaySelector)}
              type="button"
            >
              {showReplaySelector ? '✕ Hide Replay' : '▶ Replay Session'}
            </button>
          </div>
          {showReplaySelector && (
            <ReplaySessionSelector
              sessions={replay.sessions}
              onSelect={(sessionId) => {
                startReplay(sessionId);
                setShowReplaySelector(false);
              }}
              disabled={replay.sessions.length === 0}
            />
          )}
        </>
      )}

      {!replay.isReplaying && <FilterBar />}

      {/* Diagram events indicator */}
      <DiagramEventsIndicator />

      <main className="timeline-container">
        {lanes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <p>
              {totalEvents === 0
                ? replay.isReplaying
                  ? 'Replaying historical events…'
                  : 'Waiting for events…'
                : 'No events match current filters'}
            </p>
            <p className="empty-hint">
              {totalEvents === 0
                ? replay.isReplaying
                  ? 'Historical session is playing back…'
                  : 'Start a Claude Code session with hooks configured to see live activity.'
                : 'Adjust filters to show matching events.'}
            </p>
          </div>
        ) : (
          <div className="lanes-grid" role="list" aria-label="Agent sessions">
            {lanes.map((lane) => (
              <TimelineLane key={lane.session_id} lane={lane} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

interface ReplaySessionSelectorProps {
  sessions: SessionInfo[];
  onSelect: (sessionId: string) => void;
  disabled: boolean;
}

export function ReplaySessionSelector({ sessions, onSelect, disabled }: ReplaySessionSelectorProps) {
  const [selectedSession, setSelectedSession] = useState<string>('');

  const handleStart = () => {
    if (selectedSession) {
      onSelect(selectedSession);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="replay-selector empty">
        <span>No historical sessions found</span>
      </div>
    );
  }

  return (
    <div className="replay-selector">
      <label htmlFor="replay-session-select" className="replay-label">
        Replay Session:
      </label>
      <select
        id="replay-session-select"
        className="replay-select"
        value={selectedSession}
        onChange={(e) => setSelectedSession(e.target.value)}
        disabled={disabled}
      >
        <option value="">— Select a session to replay —</option>
        {sessions.map((session) => (
          <option key={session.session_id} value={session.session_id}>
            {formatSessionLabel(session)}
          </option>
        ))}
      </select>
      <button
        className="replay-start-btn"
        onClick={handleStart}
        disabled={!selectedSession || disabled}
      >
        Start Replay
      </button>
    </div>
  );
}

interface ReplayControlsBarProps {
  progress: number;
  speed: number;
  onSpeedChange: (speed: number) => void;
  onStop: () => void;
}

export function ReplayControlsBar({ progress, speed, onSpeedChange, onStop }: ReplayControlsBarProps) {
  return (
    <div className="replay-controls-bar">
      <div className="replay-progress-container">
        <div className="replay-progress-label">Replay Progress</div>
        <div className="replay-progress-bar">
          <div
            className="replay-progress-fill"
            style={{ width: `${progress}%` } as React.CSSProperties}
            data-testid="replay-progress-fill"
          />
        </div>
        <div className="replay-progress-text">{Math.round(progress)}%</div>
      </div>
      <div className="replay-controls">
        <label className="replay-speed-label">
          Speed:
          <select
            className="replay-speed-select"
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
          >
            {REPLAY_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>
        <button className="replay-stop-btn" onClick={onStop}>
          Stop Replay
        </button>
      </div>
    </div>
  );
}