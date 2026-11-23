import { useEffect, useRef } from 'react';
import { useEventsStore } from '../stores/events';
import { ChatBox } from './ChatBox';
import { useShortcut } from '../hooks/useKeybindings';
import './ChatPanel.css';

export function ChatPanel() {
  const chatPanelOpen = useEventsStore((s) => s.chatPanelOpen);
  const toggleChatPanel = useEventsStore((s) => s.toggleChatPanel);
  const selectedTarget = useEventsStore((s) => s.selectedTarget);
  const messages = useEventsStore((s) => s.messages.get(selectedTarget) || []);

  const panelRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  // Toggle panel with shortcut
  useShortcut('toggleChatPanel', () => {
    toggleChatPanel();
  });

  // Focus chat input when panel opens
  useEffect(() => {
    if (chatPanelOpen) {
      // Small delay to allow panel animation
      setTimeout(() => {
        const input = panelRef.current?.querySelector('.chat-input') as HTMLTextAreaElement;
        input?.focus();
      }, 150);
    }
  }, [chatPanelOpen]);

  // Count unread messages for badge
  const unreadCount = messages.length; // Simplified - could track read state

  if (!chatPanelOpen) {
    return (
      <button
        ref={toggleButtonRef}
        className="chat-panel-toggle"
        onClick={toggleChatPanel}
        aria-label="Open chat panel (Meta+/)"
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
        <button
          className="chat-panel-toggle-btn"
          onClick={toggleChatPanel}
          aria-label="Close chat panel (Meta+/)"
          type="button"
        >
          <span className="chat-toggle-icon">💬</span>
          <span className="chat-toggle-label">Chat</span>
        </button>
        <div className="chat-panel-resize-handle" aria-label="Resize chat panel" />
      </div>
      <ChatBox />
    </div>
  );
}