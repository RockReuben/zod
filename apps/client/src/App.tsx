import { useState, useEffect } from 'react';
import { TimelineView } from './views/TimelineView';
import { DiagramPanel } from './components/DiagramPanel';
import { ChatPanel } from './components/ChatPanel';
import { useEventsStore } from './stores/events';
import { useShortcut } from './hooks/useKeybindings';
import './index.css';

function App() {
  const [activeDiagram, setActiveDiagram] = useState<string>('system-overview');
  const highlights = useEventsStore((s) => s.highlights);
  const clearExpiredHighlights = useEventsStore((s) => s.clearExpiredHighlights);
  const updateAvailableTargets = useEventsStore((s) => s.updateAvailableTargets);
  const events = useEventsStore((s) => s.events);

  // Clear expired highlights every second
  useEffect(() => {
    const interval = setInterval(() => {
      clearExpiredHighlights();
    }, 1000);
    return () => clearInterval(interval);
  }, [clearExpiredHighlights]);

  // Update available targets when events change
  useEffect(() => {
    updateAvailableTargets();
  }, [events, updateAvailableTargets]);

  // Initialize shortcuts (this loads the keybindings config)
  useShortcut('toggleChatPanel', () => {}, []);
  useShortcut('focusChat', () => {}, []);
  useShortcut('cycleChatTarget', () => {}, []);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Architecture</h2>
        </div>
        <nav className="diagram-nav">
          <button
            className={`diagram-nav-item ${activeDiagram === 'system-overview' ? 'active' : ''}`}
            onClick={() => setActiveDiagram('system-overview')}
          >
            System Overview
          </button>
          {/* Future diagrams can be added here */}
        </nav>
      </aside>
      <div className="content-column">
        <main className="main-content">
          <DiagramPanel diagramName={activeDiagram} highlights={highlights} />
        </main>
        <div className="timeline-section">
          <TimelineView />
        </div>
        <div className="chat-panel-container">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}

export default App;