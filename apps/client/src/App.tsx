import { useState, useEffect } from 'react';
import { TimelineView } from './views/TimelineView';
import { DiagramPanel } from './components/DiagramPanel';
import { ChatPanel } from './components/ChatPanel';
import { ControlPane } from './components/ControlPane';
import { useEventsStore } from './stores/events';
import { useShortcut } from './hooks/useKeybindings';
import { useEventStream } from './hooks/useEventStream';
import './index.css';

function App() {
  const [activeDiagram, setActiveDiagram] = useState<string>('system-overview');
  const highlights = useEventsStore((s) => s.highlights);
  const clearExpiredHighlights = useEventsStore((s) => s.clearExpiredHighlights);
  const updateAvailableTargets = useEventsStore((s) => s.updateAvailableTargets);
  const events = useEventsStore((s) => s.events);

  // Initialize WebSocket event stream
  useEventStream();

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
      {/* Left Pane: Control Panel */}
      <ControlPane
        activeDiagram={activeDiagram}
        onDiagramChange={setActiveDiagram}
      />

      {/* Center Pane: Diagram Canvas */}
      <main className="main-content">
        <DiagramPanel diagramName={activeDiagram} highlights={highlights} />
      </main>

      {/* Right Pane: Vertical Timeline */}
      <aside className="timeline-pane">
        <TimelineView />
      </aside>

      {/* Floating Chat Panel at bottom center */}
      <div className="chat-panel-container">
        <ChatPanel />
      </div>
    </div>
  );
}

export default App;