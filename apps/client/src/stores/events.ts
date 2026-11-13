import { create } from 'zustand';
import { HookEvent, SessionLane } from '../types';

const MAX_EVENTS = 1000;

interface EventsState {
  events: HookEvent[];
  addEvent: (event: HookEvent) => void;
  getLanes: () => SessionLane[];
  clear: () => void;
}

const useEventsStore = create<EventsState>((set, get) => ({
  events: [],

  addEvent: (event: HookEvent) => {
    const { events } = get();
    const newEvents = [...events, event];
    // FIFO eviction
    if (newEvents.length > MAX_EVENTS) {
      newEvents.splice(0, newEvents.length - MAX_EVENTS);
    }
    set({ events: newEvents });
  },

  getLanes: () => {
    const { events } = get();
    const lanesMap = new Map<string, SessionLane>();

    for (const event of events) {
      const existing = lanesMap.get(event.session_id);
      if (existing) {
        existing.events.push(event);
      } else {
        lanesMap.set(event.session_id, {
          session_id: event.session_id,
          agent_name: event.agent_name || 'unknown',
          events: [event],
        });
      }
    }

    // Sort events within each lane by timestamp (fallback to created_at via event_id ordering)
    for (const lane of lanesMap.values()) {
      lane.events.sort((a, b) => {
        const ta = a.timestamp ?? a.event_id;
        const tb = b.timestamp ?? b.event_id;
        return ta - tb;
      });
    }

    // Return lanes sorted by first event timestamp (oldest session first)
    return Array.from(lanesMap.values()).sort((a, b) => {
      const ta = a.events[0]?.timestamp ?? a.events[0]?.event_id ?? 0;
      const tb = b.events[0]?.timestamp ?? b.events[0]?.event_id ?? 0;
      return ta - tb;
    });
  },

  clear: () => set({ events: [] }),
}));

export { useEventsStore };