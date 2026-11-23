import { create } from 'zustand';
import { HookEvent, SessionLane, NodeHighlight, InboxMessage, QuestionMessage, ChatItem } from '../types';
import { getAgentColor } from '../utils/agentColors';

const MAX_EVENTS = 1000;
const HIGHLIGHT_FADE_MS = 10000; // 10 seconds
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8081';
const TOKEN = import.meta.env.VITE_TOKEN || 'zod-control-center-token';

/** Question as stored from server (before conversion to QuestionMessage) */
export interface ServerQuestion {
  id: number;
  uuid: string;
  session_id: string;
  agent_name: string;
  question_text: string;
  answer_text: string | null;
  status: 'pending' | 'answered';
  created_at: number;
  answered_at: number | null;
}

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

  // Message state
  messages: Map<string, InboxMessage[]>;
  selectedTarget: string;
  availableTargets: string[];
  chatPanelOpen: boolean;
  messagePollingInterval: ReturnType<typeof setInterval> | null;

  // Question state
  questions: ServerQuestion[];
  questionsPollingInterval: ReturnType<typeof setInterval> | null;

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

  // Message actions
  fetchMessages: (target: string) => Promise<void>;
  sendMessage: (target: string, text: string) => Promise<void>;
  setSelectedTarget: (target: string) => void;
  cycleTarget: () => void;
  addMessage: (target: string, message: InboxMessage) => void;
  updateAvailableTargets: () => void;
  toggleChatPanel: () => void;
  setChatPanelOpen: (open: boolean) => void;
  startMessagePolling: (target: string) => void;
  stopMessagePolling: () => void;

  // Question actions
  fetchQuestions: () => Promise<void>;
  answerQuestion: (questionId: number, answer: string) => Promise<void>;
  addQuestion: (question: ServerQuestion) => void;
  updateQuestion: (questionId: number, updates: Partial<ServerQuestion>) => void;
  startQuestionsPolling: () => void;
  stopQuestionsPolling: () => void;

  // Chat items selector (merges messages + questions for a target)
  getChatItems: (target: string) => ChatItem[];
  getUnreadCount: (target: string) => number;
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
  messages: new Map(),
  selectedTarget: 'lead',
  availableTargets: ['lead'],
  chatPanelOpen: true, // Open by default
  messagePollingInterval: null,

  questions: [],
  questionsPollingInterval: null,

  addEvent: (event: HookEvent) => {
    const { events, replay } = get();
    // Don't add live events during replay
    if (replay.isReplaying) return;

    const newEvents = [...events, event];
    if (newEvents.length > MAX_EVENTS) {
      newEvents.splice(0, newEvents.length - MAX_EVENTS);
    }
    set({ events: newEvents });

    // Handle node_highlight and node_highlight_read events
    if ((event.event_type === 'node_highlight' || event.event_type === 'node_highlight_read') && event.tool_input) {
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

  // Message actions
  fetchMessages: async (target: string) => {
    try {
      const response = await fetch(`${API_BASE}/messages/${encodeURIComponent(target)}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      const messages = data.messages || [];
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(target, messages.reverse()); // Server returns newest first, we want oldest first
        return { messages: newMessages };
      });
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  },

  sendMessage: async (target: string, text: string) => {
    try {
      const response = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target, text }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      // Message will appear in next poll or we could optimistically add it
      get().fetchMessages(target);
    } catch (e) {
      console.error('Failed to send message:', e);
      throw e;
    }
  },

  setSelectedTarget: (target: string) => {
    set({ selectedTarget: target });
    get().fetchMessages(target);
    get().startMessagePolling(target);
  },

  cycleTarget: () => {
    const { availableTargets, selectedTarget } = get();
    const currentIndex = availableTargets.indexOf(selectedTarget);
    const nextIndex = (currentIndex + 1) % availableTargets.length;
    const nextTarget = availableTargets[nextIndex];
    get().setSelectedTarget(nextTarget);
  },

  addMessage: (target: string, message: InboxMessage) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const targetMessages = newMessages.get(target) || [];
      newMessages.set(target, [...targetMessages, message]);
      return { messages: newMessages };
    });
  },

  updateAvailableTargets: () => {
    const { events } = get();
    const sourceApps = new Set<string>();
    const agentNames = new Set<string>();

    for (const event of events) {
      if (event.source_app) sourceApps.add(event.source_app);
      if (event.agent_name) agentNames.add(event.agent_name);
    }

    // Build targets: lead first, then packages (source_app), then agents
    const targets = ['lead', ...Array.from(sourceApps).sort(), ...Array.from(agentNames).sort()];
    set({ availableTargets: targets });
  },

  toggleChatPanel: () => {
    set((state) => ({ chatPanelOpen: !state.chatPanelOpen }));
  },

  setChatPanelOpen: (open: boolean) => {
    set({ chatPanelOpen: open });
    if (!open) {
      get().stopMessagePolling();
    } else {
      get().startMessagePolling(get().selectedTarget);
    }
  },

  startMessagePolling: (target: string) => {
    const { messagePollingInterval } = get();
    if (messagePollingInterval) {
      clearInterval(messagePollingInterval);
    }
    const interval = setInterval(() => {
      get().fetchMessages(target);
    }, 3000); // Poll every 3 seconds
    set({ messagePollingInterval: interval });
  },

  stopMessagePolling: () => {
    const { messagePollingInterval } = get();
    if (messagePollingInterval) {
      clearInterval(messagePollingInterval);
      set({ messagePollingInterval: null });
    }
  },

  // Question actions
  fetchQuestions: async () => {
    try {
      const response = await fetch(`${API_BASE}/questions?status=pending`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (!response.ok) throw new Error('Failed to fetch questions');
      const data = await response.json();
      const questions = data.questions || [];
      set({ questions });
    } catch (e) {
      console.error('Failed to fetch questions:', e);
      set({ questions: [] });
    }
  },

  answerQuestion: async (questionId: number, answer: string) => {
    try {
      const response = await fetch(`${API_BASE}/questions/${questionId}/answer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answer }),
      });
      if (!response.ok) throw new Error('Failed to answer question');
      // Update local state optimistically
      get().updateQuestion(questionId, { status: 'answered', answer_text: answer });
    } catch (e) {
      console.error('Failed to answer question:', e);
      throw e;
    }
  },

  addQuestion: (question: ServerQuestion) => {
    set((state) => ({
      questions: [question, ...state.questions.filter((q) => q.id !== question.id)],
    }));
  },

  updateQuestion: (questionId: number, updates: Partial<ServerQuestion>) => {
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === questionId ? { ...q, ...updates } : q
      ),
    }));
  },

  startQuestionsPolling: () => {
    const { questionsPollingInterval } = get();
    if (questionsPollingInterval) {
      clearInterval(questionsPollingInterval);
    }
    // Initial fetch
    get().fetchQuestions();
    const interval = setInterval(() => {
      get().fetchQuestions();
    }, 3000); // Poll every 3 seconds
    set({ questionsPollingInterval: interval });
  },

  stopQuestionsPolling: () => {
    const { questionsPollingInterval } = get();
    if (questionsPollingInterval) {
      clearInterval(questionsPollingInterval);
      set({ questionsPollingInterval: null });
    }
  },

  // Chat items selector - merges messages and questions for a target
  getChatItems: (target: string) => {
    const { messages, questions } = get();
    const targetMessages = messages.get(target) || [];

    // Filter questions that should appear for this target
    // Questions appear in 'lead' target and when chatting with the specific agent
    const relevantQuestions = questions
      .filter(q => q.status === 'pending')
      .filter(q => target === 'lead' || target === q.agent_name)
      .map(q => ({
        ...q,
        type: 'question' as const,
        text: q.question_text, // For compatibility with InboxMessage display
      })) as QuestionMessage[];

    // Combine and sort by created_at
    const allItems: ChatItem[] = [
      ...targetMessages.map(m => ({ ...m } as ChatItem)),
      ...relevantQuestions,
    ].sort((a, b) => a.created_at - b.created_at);

    return allItems;
  },

  // Unread count includes both unread messages and pending questions
  getUnreadCount: (target: string) => {
    const { messages, questions } = get();
    const targetMessages = messages.get(target) || [];
    const unreadMessages = targetMessages.length; // All messages in store are "unread" until viewed
    const unreadQuestions = questions.filter(
      q => q.status === 'pending' && (target === 'lead' || target === q.agent_name)
    ).length;
    return unreadMessages + unreadQuestions;
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