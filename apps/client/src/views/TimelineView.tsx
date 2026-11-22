import { useEffect, useState } from 'react';
import { useEventStream } from '../hooks/useEventStream';
import { useEventsStore } from '../stores/events';
import { TimelineLane } from '../components/TimelineLane';
import { FilterBar } from '../components/FilterBar';
import { ConnectionStatus, SessionInfo } from '../types';
import './TimelineView.css';

const REPLAY_SPEEDS = [1, 2, 5, 10];

const formatSessionLabel = (session: SessionInfo): string => {
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
        <ReplaySessionSelector
          sessions={replay.sessions}
          onSelect={startReplay}
          disabled={replay.sessions.length === 0}
        />
      )}

      {!replay.isReplaying && <FilterBar />}

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

function ReplaySessionSelector({ sessions, onSelect, disabled }: ReplaySessionSelectorProps) {
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

function ReplayControlsBar({ progress, speed, onSpeedChange, onStop }: ReplayControlsBarProps) {
  return (
    <div className="replay-controls-bar">
      <div className="replay-progress-container">
        <div className="replay-progress-label">Replay Progress</div>
        <div className="replay-progress-bar">
          <div
            className="replay-progress-fill"
            style={{ width: `${progress}%` } as React.CSSProperties}
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