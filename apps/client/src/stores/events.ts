import { create } from 'zustand';
import { HookEvent, SessionLane, NodeHighlight } from '../types';
import { getAgentColor } from '../utils/agentColors';

const MAX_EVENTS = 1000;
const HIGHLIGHT_FADE_MS = 10000; // 10 seconds
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8081';
const TOKEN = import.meta.env.VITE_TOKEN || 'zod-control-center-token';

export interface FilterState {
  sourceApp: string;
  agentName: string;
  eventType: string;
}

export interface SessionInfo {
  session_id: string;
  agent_name: string;
  source_app: string;
  event_count: number;
  start_time: number;
  end_time: number;
}

export interface ReplayState {
  isReplaying: boolean;
  replaySessionId: string | null;
  replaySpeed: number;
  replayProgress: number;
  sessions: SessionInfo[];
}

interface EventsState {
  events: HookEvent[];
  filters: FilterState;
  replay: ReplayState;
  highlights: NodeHighlight[];
  addEvent: (event: HookEvent) => void;
  setFilter: (key: keyof FilterState, value: string) => void;
  resetFilters: () => void;
  getAvailableFilters: () => {
    sourceApps: string[];
    agentNames: string[];
    eventTypes: string[];
  };
  getLanes: () => SessionLane[];
  getFilteredLanes: () => SessionLane[];
  clear: () => void;

  // Replay actions
  fetchSessions: () => Promise<void>;
  startReplay: (sessionId: string) => Promise<void>;
  stopReplay: () => void;
  setReplaySpeed: (speed: number) => void;
  setReplayProgress: (progress: number) => void;
  addHistoricalEvent: (event: HookEvent) => void;

  // Highlight actions
  addHighlight: (highlight: Omit<NodeHighlight, 'color'>) => void;
  removeHighlight: (node: string, agentName: string) => void;
  clearExpiredHighlights: () => void;
  clearAllHighlights: () => void;
}

const initialFilters: FilterState = {
  sourceApp: 'all',
  agentName: 'all',
  eventType: 'all',
};

const initialReplay: ReplayState = {
  isReplaying: false,
  replaySessionId: null,
  replaySpeed: 1,
  replayProgress: 0,
  sessions: [],
};

const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  filters: { ...initialFilters },
  replay: { ...initialReplay },
  highlights: [],

  addEvent: (event: HookEvent) => {
    const { events, replay } = get();
    // Don't add live events during replay
    if (replay.isReplaying) return;

    const newEvents = [...events, event];
    if (newEvents.length > MAX_EVENTS) {
      newEvents.splice(0, newEvents.length - MAX_EVENTS);
    }
    set({ events: newEvents });

    // Handle node_highlight events
    if (event.event_type === 'node_highlight' && event.tool_input) {
      const { diagram, node } = event.tool_input;
      if (diagram && node) {
        get().addHighlight({
          node: node as string,
          agentName: event.agent_name,
          diagram: diagram as string,
          timestamp: (event.timestamp ?? Date.now() / 1000) * 1000, // Convert to ms
        });
      }
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    }));
  },

  resetFilters: () => set({ filters: { ...initialFilters } }),

  getAvailableFilters: () => {
    const { events } = get();
    const sourceApps = new Set<string>();
    const agentNames = new Set<string>();
    const eventTypes = new Set<string>();

    for (const event of events) {
      if (event.source_app) sourceApps.add(event.source_app);
      if (event.agent_name) agentNames.add(event.agent_name);
      if (event.event_type) eventTypes.add(event.event_type);
    }

    return {
      sourceApps: Array.from(sourceApps).sort(),
      agentNames: Array.from(agentNames).sort(),
      eventTypes: Array.from(eventTypes).sort(),
    };
  },

  getLanes: () => {
    const { events } = get();
    return buildLanesFromEvents(events);
  },

  getFilteredLanes: () => {
    const { events, filters } = get();
    const filteredEvents = events.filter((event) => {
      if (filters.sourceApp !== 'all' && event.source_app !== filters.sourceApp) {
        return false;
      }
      if (filters.agentName !== 'all' && event.agent_name !== filters.agentName) {
        return false;
      }
      if (filters.eventType !== 'all' && event.event_type !== filters.eventType) {
        return false;
      }
      return true;
    });

    return buildLanesFromEvents(filteredEvents);
  },

  clear: () => set({ events: [], filters: { ...initialFilters } }),

  // Replay actions
  fetchSessions: async () => {
    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data = await response.json();
      set((state) => ({
        replay: { ...state.replay, sessions: data.sessions || [] },
      }));
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
      set((state) => ({ replay: { ...state.replay, sessions: [] } }));
    }
  },

  startReplay: async (sessionId: string) => {
    const { replay } = get();
    if (replay.isReplaying) return;

    try {
      const response = await fetch(`${API_BASE}/events?session_id=${sessionId}&limit=10000`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      const events = data.events || [];

      // Clear live events, start with empty array for animation
      set({
        events: [],
        replay: {
          ...replay,
          isReplaying: true,
          replaySessionId: sessionId,
          replayProgress: 0,
        },
      });

      // Animate events based on timestamps
      animateReplay(events, get().replay.replaySpeed, get, set);
    } catch (e) {
      console.error('Failed to start replay:', e);
    }
  },

  stopReplay: () => {
    const { replay } = get();
    if (!replay.isReplaying) return;

    set({
      events: [],
      replay: { ...initialReplay, sessions: replay.sessions },
    });
  },

  setReplaySpeed: (speed: number) => {
    set((state) => ({
      replay: { ...state.replay, replaySpeed: speed },
    }));
  },

  setReplayProgress: (progress: number) => {
    set((state) => ({
      replay: { ...state.replay, replayProgress: progress },
    }));
  },

  addHistoricalEvent: (event: HookEvent) => {
    const { events } = get();
    const newEvents = [...events, event];
    if (newEvents.length > MAX_EVENTS) {
      newEvents.splice(0, newEvents.length - MAX_EVENTS);
    }
    set({ events: newEvents });
  },

  // Highlight actions
  addHighlight: (highlight: Omit<NodeHighlight, 'color'>) => {
    const { highlights } = get();
    const color = getAgentColor(highlight.agentName);
    const newHighlight: NodeHighlight = { ...highlight, color };

    // Check if highlight for same agent+node already exists (refresh timestamp)
    const existingIdx = highlights.findIndex(
      (h) => h.node === highlight.node && h.agentName === highlight.agentName
    );

    let updatedHighlights: NodeHighlight[];
    if (existingIdx >= 0) {
      // Update existing highlight with new timestamp
      updatedHighlights = highlights.map((h, idx) =>
        idx === existingIdx ? newHighlight : h
      );
    } else {
      // Add new highlight
      updatedHighlights = [...highlights, newHighlight];
    }

    set({ highlights: updatedHighlights });
  },

  removeHighlight: (node: string, agentName: string) => {
    const { highlights } = get();
    set({
      highlights: highlights.filter((h) => !(h.node === node && h.agentName === agentName)),
    });
  },

  clearExpiredHighlights: () => {
    const { highlights } = get();
    const now = Date.now();
    set({
      highlights: highlights.filter((h) => now - h.timestamp < HIGHLIGHT_FADE_MS),
    });
  },

  clearAllHighlights: () => {
    set({ highlights: [] });
  },
}));

// Replay animation logic
async function animateReplay(
  events: HookEvent[],
  speed: number,
  get: () => EventsState,
  set: (partial: Partial<EventsState> | ((state: EventsState) => Partial<EventsState>)) => void
) {
  if (events.length === 0) {
    set((state: EventsState) => ({ replay: { ...state.replay, replayProgress: 100 } }));
    return;
  }

  const { replay } = get();
  if (!replay.isReplaying) return;

  // Calculate delays between consecutive events
  const delays: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const prevTime = events[i - 1].timestamp ?? events[i - 1].event_id ?? 0;
    const currTime = events[i].timestamp ?? events[i].event_id ?? 0;
    const delay = Math.max(0, (currTime - prevTime) * 1000) / speed; // Convert to ms, apply speed
    delays.push(delay);
  }

  // Add first event immediately
  get().addHistoricalEvent(events[0]);
  set((state: EventsState) => ({ replay: { ...state.replay, replayProgress: (1 / events.length) * 100 } }));

  // Add subsequent events with delays
  for (let i = 1; i < events.length; i++) {
    const { replay: currentReplay } = get();
    if (!currentReplay.isReplaying) break;

    await new Promise((resolve) => setTimeout(resolve, delays[i - 1] || 50 / speed));

    const { replay: checkReplay } = get();
    if (!checkReplay.isReplaying) break;

    get().addHistoricalEvent(events[i]);
    set((state: EventsState) => ({
      replay: { ...state.replay, replayProgress: ((i + 1) / events.length) * 100 },
    }));
  }

  // Replay complete
  const { replay: finalReplay } = get();
  if (finalReplay.isReplaying) {
    set((state: EventsState) => ({ replay: { ...state.replay, replayProgress: 100 } }));
  }
}

function buildLanesFromEvents(events: HookEvent[]): SessionLane[] {
  const lanesMap = new Map<string, SessionLane>();

  for (const event of events) {
    const existing = lanesMap.get(event.session_id);
    if (existing) {
      existing.events.push({ ...event });
    } else {
      lanesMap.set(event.session_id, {
        session_id: event.session_id,
        agent_name: event.agent_name || 'unknown',
        events: [{ ...event }],
      });
    }
  }

  for (const lane of lanesMap.values()) {
    lane.events.sort((a, b) => {
      const ta = a.timestamp ?? a.event_id;
      const tb = b.timestamp ?? b.event_id;
      return ta - tb;
    });
  }

  return Array.from(lanesMap.values()).sort((a, b) => {
    const ta = a.events[0]?.timestamp ?? a.events[0]?.event_id ?? 0;
    const tb = b.events[0]?.timestamp ?? b.events[0]?.event_id ?? 0;
    return ta - tb;
  });
}

export { useEventsStore };