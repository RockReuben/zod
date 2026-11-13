import { useEventStream } from '../hooks/useEventStream';
import { useEventsStore } from '../stores/events';
import { TimelineLane } from '../components/TimelineLane';
import { ConnectionStatus } from '../types';
import './TimelineView.css';

export function TimelineView() {
  const { status } = useEventStream();
  const lanes = useEventsStore((s) => s.getLanes());

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
            <span className="status-text">{getStatusLabel(status)}</span>
          </div>
          <div className="lane-count">{lanes.length} session{lanes.length !== 1 ? 's' : ''}</div>
        </div>
      </header>

      <main className="timeline-container">
        {lanes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📡</div>
            <p>Waiting for events…</p>
            <p className="empty-hint">
              Start a Claude Code session with hooks configured to see live activity.
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