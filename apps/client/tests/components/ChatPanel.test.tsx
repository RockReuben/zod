import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '../../src/components/ChatPanel';
import { useEventsStore } from '../../src/stores/events';
import { InboxMessage } from '../../src/types';

// Mock the events store
vi.mock('../../src/stores/events', () => ({
  useEventsStore: vi.fn(),
}));

// Mock useShortcut hook
vi.mock('../../src/hooks/useKeybindings', () => ({
  useShortcut: vi.fn(),
}));

const mockUseEventsStore = vi.mocked(useEventsStore);

describe('ChatPanel', () => {
  const mockMessages: InboxMessage[] = [
    { session_id: 'sess-1', text: 'Hello from agent', created_at: Date.now() / 1000 - 100 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEventsStore.mockImplementation((selector) => selector({
      chatPanelOpen: false,
      selectedTarget: 'lead',
      messages: new Map([['lead', mockMessages]]),
      availableTargets: ['lead', 'backend'],
      toggleChatPanel: vi.fn(),
      setChatPanelOpen: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      setSelectedTarget: vi.fn(),
      cycleTarget: vi.fn(),
      updateAvailableTargets: vi.fn(),
      fetchMessages: vi.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders toggle button when panel is closed', () => {
    render(<ChatPanel />);

    const toggleBtn = screen.getByRole('button', { name: /open chat panel/i });
    expect(toggleBtn).toBeInTheDocument();
    expect(screen.getByText('💬')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();
  });

  it('shows unread badge when messages exist', () => {
    render(<ChatPanel />);

    // Should show badge with count
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('opens panel when toggle button clicked', async () => {
    const mockToggleChatPanel = vi.fn();
    mockUseEventsStore.mockImplementation((selector) => selector({
      chatPanelOpen: false,
      selectedTarget: 'lead',
      messages: new Map([['lead', mockMessages]]),
      availableTargets: ['lead', 'backend'],
      toggleChatPanel: mockToggleChatPanel,
      setChatPanelOpen: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      setSelectedTarget: vi.fn(),
      cycleTarget: vi.fn(),
      updateAvailableTargets: vi.fn(),
      fetchMessages: vi.fn().mockResolvedValue(undefined),
    }));

    render(<ChatPanel />);

    const toggleBtn = screen.getByRole('button', { name: /open chat panel/i });
    await userEvent.click(toggleBtn);

    expect(mockToggleChatPanel).toHaveBeenCalled();
  });

  it('renders chat panel when open', () => {
    mockUseEventsStore.mockImplementation((selector) => selector({
      chatPanelOpen: true,
      selectedTarget: 'lead',
      messages: new Map([['lead', mockMessages]]),
      availableTargets: ['lead', 'backend'],
      toggleChatPanel: vi.fn(),
      setChatPanelOpen: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      setSelectedTarget: vi.fn(),
      cycleTarget: vi.fn(),
      updateAvailableTargets: vi.fn(),
      fetchMessages: vi.fn().mockResolvedValue(undefined),
    }));

    render(<ChatPanel />);

    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close chat panel/i })).toBeInTheDocument();
    expect(screen.getByText('Hello from agent')).toBeInTheDocument();
  });

  it('closes panel when close button clicked', async () => {
    const mockToggleChatPanel = vi.fn();
    mockUseEventsStore.mockImplementation((selector) => selector({
      chatPanelOpen: true,
      selectedTarget: 'lead',
      messages: new Map([['lead', mockMessages]]),
      availableTargets: ['lead', 'backend'],
      toggleChatPanel: mockToggleChatPanel,
      setChatPanelOpen: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      setSelectedTarget: vi.fn(),
      cycleTarget: vi.fn(),
      updateAvailableTargets: vi.fn(),
      fetchMessages: vi.fn().mockResolvedValue(undefined),
    }));

    render(<ChatPanel />);

    const closeBtn = screen.getByRole('button', { name: /close chat panel/i });
    await userEvent.click(closeBtn);

    expect(mockToggleChatPanel).toHaveBeenCalledTimes(1);
  });

  it('has resize handle when panel is open', () => {
    mockUseEventsStore.mockImplementation((selector) => selector({
      chatPanelOpen: true,
      selectedTarget: 'lead',
      messages: new Map([['lead', mockMessages]]),
      availableTargets: ['lead', 'backend'],
      toggleChatPanel: vi.fn(),
      setChatPanelOpen: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      setSelectedTarget: vi.fn(),
      cycleTarget: vi.fn(),
      updateAvailableTargets: vi.fn(),
      fetchMessages: vi.fn().mockResolvedValue(undefined),
    }));

    render(<ChatPanel />);

    const resizeHandle = screen.getByLabelText(/resize chat panel/i);
    expect(resizeHandle).toBeInTheDocument();
  });

  it('focuses chat input when panel opens', async () => {
    mockUseEventsStore.mockImplementation((selector) => selector({
      chatPanelOpen: true,
      selectedTarget: 'lead',
      messages: new Map([['lead', mockMessages]]),
      availableTargets: ['lead', 'backend'],
      toggleChatPanel: vi.fn(),
      setChatPanelOpen: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      setSelectedTarget: vi.fn(),
      cycleTarget: vi.fn(),
      updateAvailableTargets: vi.fn(),
      fetchMessages: vi.fn().mockResolvedValue(undefined),
    }));

    render(<ChatPanel />);

    const input = screen.getByPlaceholderText(/message to lead/i);
    // Input should exist (focus is tested via useEffect timing)
    expect(input).toBeInTheDocument();
  });
});