import { useEffect, useRef } from 'react';
import { useEventsStore } from '../stores/events';
import { ChatBox } from './ChatBox';
import { useShortcut } from '../hooks/useKeybindings';
import './ChatPanel.css';

export function ChatPanel() {
  const chatPanelOpen = useEventsStore((s) => s.chatPanelOpen);
  const toggleChatPanel = useEventsStore((s) => s.toggleChatPanel);
  const selectedTarget = useEventsStore((s) => s.selectedTarget);
  const getUnreadCount = useEventsStore((s) => s.getUnreadCount);

  const panelRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  // Toggle panel with shortcut
  useShortcut('toggleChatPanel', () => {
    toggleChatPanel();
  });

  // ESC key handling is now done in ChatBox/QuestionItem where the input is focused.
  // We don't add a document-level handler here to avoid double-toggle.

  // Focus chat input when panel opens
  useEffect(() => {
    if (chatPanelOpen) {
      setTimeout(() => {
        const input = panelRef.current?.querySelector('.chat-input') as HTMLTextAreaElement;
        input?.focus();
      }, 150);
    }
  }, [chatPanelOpen]);

  // Count unread messages + pending questions for badge
  const unreadCount = getUnreadCount(selectedTarget);

  if (!chatPanelOpen) {
    return (
      <button
        ref={toggleButtonRef}
        className="chat-panel-toggle"
        onClick={toggleChatPanel}
        aria-label="Open chat panel (Esc)"
        aria-expanded="false"
        type="button"
      >
        <span className="chat-toggle-icon">💬</span>
        <span className="chat-toggle-label">Chat</span>
        {unreadCount > 0 && (
          <span className="chat-toggle-badge" aria-label={`${unreadCount} unread messages`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="chat-panel" ref={panelRef} role="region" aria-label="Chat panel">
      <div className="chat-panel-header">
        <div className="chat-panel-header-left">
          <span className="chat-toggle-icon">💬</span>
          <span className="chat-toggle-label">Chat</span>
          {unreadCount > 0 && (
            <span className="chat-toggle-badge" aria-label={`${unreadCount} unread messages`}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <div className="chat-panel-header-right">
          <button
            className="chat-panel-toggle-btn"
            onClick={toggleChatPanel}
            aria-label="Close chat panel (Esc)"
            type="button"
          >
            <span className="chat-toggle-icon">💬</span>
          </button>
          <div className="chat-panel-resize-handle" aria-label="Resize chat panel" />
        </div>
      </div>
      <ChatBox />
    </div>
  );
}