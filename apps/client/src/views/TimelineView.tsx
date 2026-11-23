import { useEffect, useMemo, useRef } from 'react';
import { useEventStream } from '../hooks/useEventStream';
import { useEventsStore } from '../stores/events';
import { HookEvent, ConnectionStatus, isDiagramEvent } from '../types';
import { FilterBar } from '../components/FilterBar';
import './TimelineView.css';

// Color mapping for event types
function getEventColor(eventType: string): string {
  if (isDiagramEvent(eventType)) {
    if (eventType === 'unmapped_edit') return '#f97316';
    if (eventType === 'diagram_drift') return '#dc2626';
    if (eventType === 'node_highlight') return '#3b82f6'; // blue for writes
    if (eventType === 'node_highlight_read') return '#06b6d4'; // cyan for reads
  }
  if (eventType.startsWith('Pre')) return '#3b82f6';
  if (eventType.startsWith('Post')) return '#22c55e';
  if (eventType.includes('Stop')) return '#ef4444';
  if (eventType.includes('Subagent')) return '#a855f7';
  if (eventType.includes('Notification')) return '#f59e0b';
  if (eventType.includes('Permission')) return '#ec4899';
  return '#64748b';
}

function formatToolDescription(event: HookEvent): string {
  if (!event.tool_name && !event.tool_input) return '';
  const parts: string[] = [];
  if (event.tool_name) parts.push(event.tool_name);
  if (event.tool_input) {
    const keys = Object.keys(event.tool_input).slice(0, 2);
    const desc = keys.map(k => `${k}: ${String(event.tool_input![k]).slice(0, 50)}`).join(', ');
    if (desc) parts.push(desc);
  }
  return parts.join(' · ');
}

function formatAgentInfo(event: HookEvent): string {
  const parts: string[] = [];
  if (event.agent_name) parts.push(event.agent_name);
  if (event.source_app && event.source_app !== event.agent_name) parts.push(event.source_app);
  return parts.join(' / ');
}

export function TimelineView() {
  const { status } = useEventStream();
  const events = useEventsStore((s) => s.events);
  const filters = useEventsStore((s) => s.filters);
  const getAvailableFilters = useEventsStore((s) => s.getAvailableFilters);
  const timelineListRef = useRef<HTMLDivElement>(null);
  const prevEventCountRef = useRef(events.length);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply filters to events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.sourceApp !== 'all' && event.source_app !== filters.sourceApp) return false;
      if (filters.agentName !== 'all' && event.agent_name !== filters.agentName) return false;
      if (filters.eventType !== 'all' && event.event_type !== filters.eventType) return false;
      return true;
    });
  }, [events, filters]);

  // Sort by timestamp ascending (bottom-ordered: oldest at top, newest at bottom)
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const ta = a.timestamp ?? a.event_id ?? 0;
      const tb = b.timestamp ?? b.event_id ?? 0;
      return ta - tb;
    });
  }, [filteredEvents]);

  // const availableFilters = getAvailableFilters();

  // Compute stats
  const stats = useMemo(() => {
    return {
      total: filteredEvents.length,
      unfiltered: events.length,
    };
  }, [filteredEvents, events.length]);

  // Auto-scroll to bottom when new events arrive (if user isn't manually scrolling)
  useEffect(() => {
    if (events.length > prevEventCountRef.current) {
      // New events arrived - auto-scroll if user isn't actively scrolling
      if (!isUserScrollingRef.current && timelineListRef.current) {
        timelineListRef.current.scrollTop = timelineListRef.current.scrollHeight;
      }
      prevEventCountRef.current = events.length;
    }
  }, [events.length]);

  // Track user scrolling to temporarily disable auto-scroll
  const handleScroll = () => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
      // Re-enable auto-scroll after user stops scrolling
      if (timelineListRef.current) {
        timelineListRef.current.scrollTop = timelineListRef.current.scrollHeight;
      }
    }, 1000);
  };

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

  // Fetch available filters on mount
  useEffect(() => {
    // Force update of available filters
    getAvailableFilters();
  }, [getAvailableFilters]);

  return (
    <div className="timeline-view">
      {/* Header */}
      <header className="timeline-header">
        <div className="timeline-header-left">
          <h2 className="timeline-title">Timeline</h2>
          <span className="timeline-count">
            {stats.total} / {stats.unfiltered} events
          </span>
        </div>
        <div className="timeline-header-right">
          <div
            className="timeline-status-badge"
            style={{ '--status-color': getStatusColor(status) } as React.CSSProperties}
          >
            <span className="timeline-status-dot" />
            <span className="timeline-status-text">
              {getStatusLabel(status)}
            </span>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar />

      {/* Diagram Events Indicator */}
      <DiagramEventsIndicator events={events} />

      {/* Events List - Vertical, bottom-ordered */}
      <main
        ref={timelineListRef}
        className="timeline-list"
        role="log"
        aria-live="polite"
        aria-label="Event timeline"
        onScroll={handleScroll}
      >
        {sortedEvents.length === 0 ? (
          <div className="timeline-empty">
            <div className="empty-icon">📡</div>
            <p>
              {events.length === 0
                ? 'Waiting for events…'
                : 'No events match current filters'}
            </p>
            <p className="empty-hint">
              {events.length === 0
                ? 'Start a Claude Code session with hooks configured to see live activity.'
                : 'Adjust filters to show matching events.'}
            </p>
          </div>
        ) : (
          <ul className="timeline-events">
            {sortedEvents.map((event, index) => (
              <TimelineEventRow
                key={`${event.uuid || event.event_id}-${event.session_id}-${index}`}
                event={event}
                isLast={index === sortedEvents.length - 1}
              />
            ))}
          </ul>
        )}

        {/* Auto-scroll anchor at bottom */}
        <div id="timeline-bottom" />
      </main>
    </div>
  );
}

interface TimelineEventRowProps {
  event: HookEvent;
  isLast: boolean;
}

function TimelineEventRow({ event, isLast }: TimelineEventRowProps) {
  const color = getEventColor(event.event_type);
  const time = event.timestamp
    ? new Date(event.timestamp * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : '—:—:—';
  const toolDesc = formatToolDescription(event);
  const agentInfo = formatAgentInfo(event);
  const sessionShort = event.session_id ? event.session_id.slice(0, 8) : '—';

  return (
    <li className={`timeline-event ${isLast ? 'last' : ''}`} style={{ '--event-color': color } as React.CSSProperties}>
      <div className="event-timeline-marker">
        <div className="event-dot" />
        {!isLast && <div className="event-connector" />}
      </div>
      <div className="event-content">
        <div className="event-header">
          <span className="event-time" title={time}>{time}</span>
          <span className="event-type" style={{ backgroundColor: color }}>
            {event.event_type}
          </span>
          <span className="event-session">{sessionShort}</span>
        </div>
        <div className="event-body">
          {toolDesc && <div className="event-tool">{toolDesc}</div>}
          {agentInfo && <div className="event-agent">{agentInfo}</div>}
        </div>
      </div>
    </li>
  );
}

function DiagramEventsIndicator({ events }: { events: HookEvent[] }) {
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
        {diagramEvents.slice(-5).map((d, idx) => (
          <li key={`${d.event.event_id}-${idx}`} className={`diagram-event-item ${d.event.event_type}`}>
            <span className="diagram-event-type">{d.event.event_type}</span>
            <span className="diagram-event-file">{d.event.tool_input?.file_path as string}</span>
            {d.diagram && (
              <span>
                <span className="diagram-event-diagram">→ {d.diagram}</span>
                <span className="diagram-event-node">({d.node})</span>
              </span>
            )}
            {d.reason && (
              <span className="diagram-event-reason">{d.reason}</span>
            )}
            <span className="diagram-event-time">
              {d.event.timestamp ? new Date(d.event.timestamp * 1000).toLocaleTimeString() : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}