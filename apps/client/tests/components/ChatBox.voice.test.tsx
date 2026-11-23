import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatBox } from '../../src/components/ChatBox';
import { useEventsStore } from '../../src/stores/events';
import { InboxMessage } from '../../src/types';

// Mock the events store
const mockMessagesMap = new Map<string, InboxMessage[]>();

vi.mock('../../src/stores/events', () => ({
  useEventsStore: vi.fn((selector) => selector({
    selectedTarget: 'lead',
    messages: mockMessagesMap,
    availableTargets: ['lead'],
    sendMessage: vi.fn().mockResolvedValue(undefined),
    setSelectedTarget: vi.fn(),
    cycleTarget: vi.fn(),
    updateAvailableTargets: vi.fn(),
    fetchMessages: vi.fn().mockResolvedValue(undefined),
    events: [],
    highlights: [],
    addEvent: vi.fn(),
    addHighlight: vi.fn(),
    removeHighlight: vi.fn(),
    clearExpiredHighlights: vi.fn(),
    clearAllHighlights: vi.fn(),
    clear: vi.fn(),
    filters: { sourceApp: 'all', agentName: 'all', eventType: 'all' },
    replay: { isReplaying: false, replaySessionId: null, replaySpeed: 1, replayProgress: 0, sessions: [] },
    getLanes: vi.fn(() => []),
    getFilteredLanes: vi.fn(() => []),
    getAvailableFilters: vi.fn(() => ({ sourceApps: [], agentNames: [], eventTypes: [] })),
    fetchSessions: vi.fn(),
    startReplay: vi.fn(),
    stopReplay: vi.fn(),
    setReplaySpeed: vi.fn(),
    setReplayProgress: vi.fn(),
    addHistoricalEvent: vi.fn(),
    chatPanelOpen: false,
    messagePollingInterval: null,
    toggleChatPanel: vi.fn(),
    setChatPanelOpen: vi.fn(),
    startMessagePolling: vi.fn(),
    stopMessagePolling: vi.fn(),
    setFilter: vi.fn(),
    resetFilters: vi.fn(),
    addMessage: vi.fn(),
  })),
}));

// Mock useShortcut hook
vi.mock('../../src/hooks/useKeybindings', () => ({
  useShortcut: vi.fn(),
}));

const mockUseEventsStore = vi.mocked(useEventsStore);

// SpeechRecognition mock factory
interface MockSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  start: vi.Mock;
  stop: vi.Mock;
  abort: vi.Mock;
}

let mockSpeechRecognition: MockSpeechRecognition | null = null;
let OriginalSpeechRecognition: any;
let OriginalWebkitSpeechRecognition: any;

beforeEach(() => {
  vi.clearAllMocks();
  mockMessagesMap.clear();
  mockMessagesMap.set('lead', []);
  mockMessagesMap.set('backend', []);
  mockMessagesMap.set('agent-alpha', []);

  // Reset SpeechRecognition mocks
  mockSpeechRecognition = null;

  // Store originals
  OriginalSpeechRecognition = global.SpeechRecognition;
  OriginalWebkitSpeechRecognition = (global as any).webkitSpeechRecognition;

  // Create mock SpeechRecognition constructor
  const createMockRecognition = () => {
    const mock = {
      continuous: true,
      interimResults: true,
      lang: 'en-US',
      onstart: null,
      onend: null,
      onresult: null,
      onerror: null,
      onnomatch: null,
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
    };
    mockSpeechRecognition = mock;
    return mock;
  };

  global.SpeechRecognition = vi.fn(createMockRecognition) as any;
  (global as any).webkitSpeechRecognition = vi.fn(createMockRecognition);
});

afterEach(() => {
  vi.restoreAllMocks();
  // Restore original SpeechRecognition
  global.SpeechRecognition = OriginalSpeechRecognition;
  (global as any).webkitSpeechRecognition = OriginalWebkitSpeechRecognition;
  mockSpeechRecognition = null;
});

describe('ChatBox - Voice Input (P5.5)', () => {
  // ============================================================
  // 1. Microphone button renders in chat input area
  // ============================================================
  it('renders microphone button in the input area', () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    expect(micButton).toBeInTheDocument();
    expect(micButton).not.toBeDisabled();
  });

  // ============================================================
  // 2. Clicking microphone requests permission and starts SpeechRecognition
  // ============================================================
  it('starts SpeechRecognition when microphone button is clicked', async () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    // Should have created SpeechRecognition instance
    expect(global.SpeechRecognition).toHaveBeenCalledTimes(1);
    expect(mockSpeechRecognition).not.toBeNull();
    expect(mockSpeechRecognition!.start).toHaveBeenCalled();
  });

  it('uses webkitSpeechRecognition when SpeechRecognition not available', async () => {
    // matrix: ChatBox | browser not supported (fallback) | P5.5
    // Remove standard SpeechRecognition, only webkit available
    global.SpeechRecognition = undefined as any;

    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    expect((global as any).webkitSpeechRecognition).toHaveBeenCalledTimes(1);
    expect(mockSpeechRecognition).not.toBeNull();
    expect(mockSpeechRecognition!.start).toHaveBeenCalled();
  });

  // ============================================================
  // 3. Interim speech results appear in textarea as user speaks
  // ============================================================
  it('shows interim speech results in textarea while listening', async () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    // Simulate interim result
    const interimEvent = {
      results: [
        { isFinal: false, [0]: { transcript: 'Hello wor' } },
      ],
      resultIndex: 0,
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      mockSpeechRecognition!.onresult!(interimEvent);
    });

    const textarea = screen.getByPlaceholderText(/message to lead/i);
    expect(textarea).toHaveValue('Hello wor');
  });

  it('appends multiple interim results', async () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    // First interim
    const interim1 = {
      results: [
        { isFinal: false, [0]: { transcript: 'Hello' } },
      ],
      resultIndex: 0,
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      mockSpeechRecognition!.onresult!(interim1);
    });

    let textarea = screen.getByPlaceholderText(/message to lead/i);
    expect(textarea).toHaveValue('Hello');

    // Second interim (continuation)
    const interim2 = {
      results: [
        { isFinal: false, [0]: { transcript: 'Hello world' } },
      ],
      resultIndex: 0,
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      mockSpeechRecognition!.onresult!(interim2);
    });

    textarea = screen.getByPlaceholderText(/message to lead/i);
    expect(textarea).toHaveValue('Hello world');
  });

  // ============================================================
  // 4. Final speech result stays in textarea for editing
  // ============================================================
  it('keeps final speech result in textarea after recognition ends', async () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    // Send final result
    const finalEvent = {
      results: [
        { isFinal: true, [0]: { transcript: 'Hello world' } },
      ],
      resultIndex: 0,
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      mockSpeechRecognition!.onresult!(finalEvent);
    });

    // Simulate recognition end
    act(() => {
      mockSpeechRecognition!.onend!({} as Event);
    });

    const textarea = screen.getByPlaceholderText(/message to lead/i);
    expect(textarea).toHaveValue('Hello world');
  });

  // ============================================================
  // 5. User can edit recognized text before sending
  // ============================================================
  it('allows user to edit recognized text before sending', async () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    const finalEvent = {
      results: [
        { isFinal: true, [0]: { transcript: 'Hello world' } },
      ],
      resultIndex: 0,
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      mockSpeechRecognition!.onresult!(finalEvent);
    });
    act(() => {
      mockSpeechRecognition!.onend!({} as Event);
    });

    const textarea = screen.getByPlaceholderText(/message to lead/i);
    expect(textarea).toHaveValue('Hello world');

    // User edits the text
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'Hello world!');

    expect(textarea).toHaveValue('Hello world!');

    // Can send the edited message
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));
    expect(textarea).toHaveValue('');
  });

  // ============================================================
  // 6. Error handling
  // ============================================================
  it('handles permission denied error', async () => {
    // matrix: ChatBox | permission denied | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    const errorEvent = {
      error: 'not-allowed',
      message: 'Permission denied',
    } as unknown as SpeechRecognitionErrorEvent;

    act(() => {
      mockSpeechRecognition!.onerror!(errorEvent);
    });

    // Should show error state on microphone button
    const micBtnAfterError = screen.getByRole('button', { name: /voice input|microphone/i });
    expect(micBtnAfterError).toHaveAttribute('aria-pressed', 'false');
    // Or check for error styling/message
  });

  it('handles no speech detected error', async () => {
    // matrix: ChatBox | no speech detected | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    const errorEvent = {
      error: 'no-speech',
      message: 'No speech detected',
    } as unknown as SpeechRecognitionErrorEvent;

    act(() => {
      mockSpeechRecognition!.onerror!(errorEvent);
    });

    const micBtnAfterError = screen.getByRole('button', { name: /voice input|microphone/i });
    expect(micBtnAfterError).not.toBeDisabled();
  });

  it('handles network error', async () => {
    // matrix: ChatBox | network error | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    const errorEvent = {
      error: 'network',
      message: 'Network error',
    } as unknown as SpeechRecognitionErrorEvent;

    act(() => {
      mockSpeechRecognition!.onerror!(errorEvent);
    });

    const micBtnAfterError = screen.getByRole('button', { name: /voice input|microphone/i });
    expect(micBtnAfterError).not.toBeDisabled();
  });

  it('shows unsupported browser message when SpeechRecognition unavailable', async () => {
    // matrix: ChatBox | browser not supported | P5.5
    global.SpeechRecognition = undefined as any;
    (global as any).webkitSpeechRecognition = undefined as any;

    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    // Should show an error/toast or disable button with message
    const micBtnAfterError = screen.getByRole('button', { name: /voice input|microphone/i });
    expect(micBtnAfterError).toBeDisabled();
  });

  // ============================================================
  // 7. Microphone button visual states
  // ============================================================
  it('shows listening state while recognition is active', async () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    expect(micButton).not.toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(micButton);

    // Simulate onstart callback being called by SpeechRecognition
    act(() => {
      mockSpeechRecognition!.onstart!({} as Event);
    });

    // Should show pressed/listening state
    expect(micButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('returns to idle state after recognition ends', async () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    act(() => {
      mockSpeechRecognition!.onend!({} as Event);
    });

    // Should return to idle state
    expect(micButton).not.toHaveAttribute('aria-pressed', 'true');
  });

  it('shows error state on recognition error', async () => {
    // matrix: ChatBox | error | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    const errorEvent = {
      error: 'not-allowed',
      message: 'Permission denied',
    } as unknown as SpeechRecognitionErrorEvent;

    act(() => {
      mockSpeechRecognition!.onerror!(errorEvent);
    });

    // Should show error state (could be aria-invalid, different color, etc.)
    expect(micButton).not.toHaveAttribute('aria-pressed', 'true');
  });

  // ============================================================
  // 8. Accessibility
  // ============================================================
  it('has proper ARIA label for microphone button', () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    expect(micButton).toHaveAttribute('aria-label');
  });

  it('is keyboard accessible (Enter/Space to toggle)', async () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    micButton.focus();

    fireEvent.keyDown(micButton, { key: 'Enter' });

    expect(global.SpeechRecognition).toHaveBeenCalledTimes(1);
    expect(mockSpeechRecognition!.start).toHaveBeenCalled();
  });

  it('announces listening state to screen readers', async () => {
    // matrix: ChatBox | valid/typical | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    // Simulate onstart callback being called by SpeechRecognition
    act(() => {
      mockSpeechRecognition!.onstart!({} as Event);
    });

    // Should have aria-live or similar for status announcements
    // or the button itself should convey state via aria-pressed
    expect(micButton).toHaveAttribute('aria-pressed', 'true');
  });

  // ============================================================
  // 9. Works alongside existing keyboard shortcuts
  // ============================================================
  it('does not interfere with Meta+K focus shortcut (invariant)', async () => {
    // matrix: ChatBox | invariant | invariant
    const { useShortcut } = await import('../../src/hooks/useKeybindings');
    const useShortcutMock = vi.mocked(useShortcut);

    render(<ChatBox />);

    // Verify focusChat shortcut is still registered (invariant: existing shortcuts work)
    expect(useShortcutMock).toHaveBeenCalledWith('focusChat', expect.any(Function));
  });

  it('does not interfere with Meta+Shift+K cycle target shortcut (invariant)', async () => {
    // matrix: ChatBox | invariant | invariant
    const { useShortcut } = await import('../../src/hooks/useKeybindings');
    const useShortcutMock = vi.mocked(useShortcut);

    render(<ChatBox />);

    expect(useShortcutMock).toHaveBeenCalledWith('cycleChatTarget', expect.any(Function));
  });

  // ============================================================
  // 10. Additional edge cases (robustness invariants)
  // ============================================================
  it('handles rapid start/stop clicks gracefully', async () => {
    // matrix: ChatBox | concurrent | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });

    // Rapid clicks
    await userEvent.click(micButton);
    await userEvent.click(micButton);
    await userEvent.click(micButton);

    // Should not crash, only one recognition active
    expect(global.SpeechRecognition).toHaveBeenCalledTimes(1);
  });

  it('stops recognition when component unmounts', async () => {
    // matrix: ChatBox | lifecycle | P5.5
    const { unmount } = render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    unmount();

    // Should call stop or abort on unmount
    expect(mockSpeechRecognition!.stop).toHaveBeenCalled();
  });

  it('handles oversized transcript without crashing', async () => {
    // matrix: ChatBox | oversized | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    // Very long transcript
    const longText = 'a'.repeat(10000);
    const finalEvent = {
      results: [
        { isFinal: true, [0]: { transcript: longText } },
      ],
      resultIndex: 0,
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      mockSpeechRecognition!.onresult!(finalEvent);
    });
    act(() => {
      mockSpeechRecognition!.onend!({} as Event);
    });

    const textarea = screen.getByPlaceholderText(/message to lead/i);
    expect(textarea).toHaveValue(longText);
  });

  it('handles special characters in transcript', async () => {
    // matrix: ChatBox | hostile content | P5.5
    render(<ChatBox />);

    const micButton = screen.getByRole('button', { name: /start voice input|microphone/i });
    await userEvent.click(micButton);

    const finalEvent = {
      results: [
        { isFinal: true, [0]: { transcript: 'Hello <script>alert(1)</script> & "world"' } },
      ],
      resultIndex: 0,
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      mockSpeechRecognition!.onresult!(finalEvent);
    });
    act(() => {
      mockSpeechRecognition!.onend!({} as Event);
    });

    const textarea = screen.getByPlaceholderText(/message to lead/i);
    expect(textarea).toHaveValue('Hello <script>alert(1)</script> & "world"');
  });
});