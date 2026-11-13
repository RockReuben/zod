import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { SessionLane, HookEvent } from '../types';
import './TimelineLane.css';

interface TimelineLaneProps {
  lane: SessionLane;
}

function getEventColor(eventType: string): string {
  // Color by event type category
  if (eventType.startsWith('Pre')) return '#3b82f6'; // blue
  if (eventType.startsWith('Post')) return '#22c55e'; // green
  if (eventType.includes('Stop')) return '#ef4444'; // red
  if (eventType.includes('Subagent')) return '#a855f7'; // purple
  if (eventType.includes('Notification')) return '#f59e0b'; // amber
  if (eventType.includes('Permission')) return '#ec4899'; // pink
  return '#64748b'; // slate
}

function formatToolInput(input?: Record<string, unknown>): string {
  if (!input) return '';
  const keys = Object.keys(input).slice(0, 3);
  return keys.map((k) => `${k}: ${String(input[k]).slice(0, 40)}`).join(', ');
}

export function TimelineLane({ lane }: TimelineLaneProps) {
  const { session_id, agent_name, events } = lane;

  // Calculate relative positions based on timestamps
  const eventsWithPosition = useMemo(() => {
    if (events.length === 0) return [];

    const timestamps = events.map((e) => e.timestamp ?? e.event_id ?? 0);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const timeRange = maxTime - minTime || 1; // avoid div by zero

    return events.map((event, index) => {
      const time = event.timestamp ?? event.event_id ?? 0;
      // Position as percentage (5% to 95% to leave margin)
      const position = 5 + ((time - minTime) / timeRange) * 90;
      return { event, position, index };
    });
  }, [events]);

  const shortSessionId = useMemo(
    () => session_id.slice(0, 8) + '…',
    [session_id]
  );

  return (
    <div className="timeline-lane" data-session-id={session_id}>
      <div className="lane-header">
        <span className="agent-name" title={agent_name}>
          {agent_name}
        </span>
        <span className="session-id" title={session_id}>
          {shortSessionId}
        </span>
        <span className="event-count">{events.length} events</span>
      </div>

      <div className="lane-timeline" role="list" aria-label={`Events for ${agent_name}`}>
        {eventsWithPosition.map(({ event, position }) => (
          <EventMarker
            key={`${event.event_id}-${event.session_id}`}
            event={event}
            position={position}
          />
        ))}
      </div>

      {/* Time axis labels */}
      <div className="time-axis" aria-hidden="true">
        <span className="time-label time-start">Start</span>
        <span className="time-label time-end">Now</span>
      </div>
    </div>
  );
}

interface EventMarkerProps {
  event: HookEvent;
  position: number;
}

function EventMarker({ event, position }: EventMarkerProps) {
  const color = getEventColor(event.event_type);
  const timeAgo = event.timestamp
    ? formatDistanceToNow(new Date(event.timestamp * 1000), { addSuffix: true })
    : 'unknown time';

  return (
    <div
      className="event-marker"
      style={{
        left: `${position}%`,
        '--event-color': color,
      } as React.CSSProperties}
      title={
        `${event.event_type} • ${event.tool_name ?? '—'}\n` +
        `${timeAgo}\n` +
        `Input: ${formatToolInput(event.tool_input)}`
      }
      role="listitem"
      aria-label={`${event.event_type} at ${timeAgo}`}
    >
      <div className="event-dot" />
      <div className="event-tooltip">
        <div className="tooltip-row">
          <strong>{event.event_type}</strong>
          <span className="tooltip-time">{timeAgo}</span>
        </div>
        {event.tool_name && (
          <div className="tooltip-row">
            <span className="tooltip-label">Tool:</span>
            <span>{event.tool_name}</span>
          </div>
        )}
        {event.tool_input && Object.keys(event.tool_input).length > 0 && (
          <div className="tooltip-row">
            <span className="tooltip-label">Input:</span>
            <span className="tooltip-input">{formatToolInput(event.tool_input)}</span>
          </div>
        )}
        <div className="tooltip-row">
          <span className="tooltip-label">Session:</span>
          <span>{event.session_id.slice(0, 12)}…</span>
        </div>
      </div>
    </div>
  );
}