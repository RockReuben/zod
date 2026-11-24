import { useState, useEffect } from 'react';
import { TimelineView } from './views/TimelineView';
import { DiagramPanel } from './components/DiagramPanel';
import { CodebaseView } from './views/CodebaseView';
import { ChatPanel } from './components/ChatPanel';
import { ControlPane } from './components/ControlPane';
import { useEventsStore } from './stores/events';
import { useShortcut } from './hooks/useKeybindings';
import { useEventStream } from './hooks/useEventStream';
import './index.css';

function App() {
  const [activeDiagram, setActiveDiagram] = useState<string>('system-overview');
  const [activeView, setActiveView] = useState<'architecture' | 'codebase'>('architecture');
  const highlights = useEventsStore((s) => s.highlights);
  const clearExpiredHighlights = useEventsStore((s) => s.clearExpiredHighlights);
  const updateAvailableTargets = useEventsStore((s) => s.updateAvailableTargets);
  const events = useEventsStore((s) => s.events);
  const planDiff = useEventsStore((s) => s.planDiff);

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

  // Load current diagram when plan changes
  useEffect(() => {
    if (planDiff.activePlan) {
      // The diagram will be loaded by DiagramPanel
      // We just need to ensure proposed diagram is loaded
    }
  }, [planDiff.activePlan]);

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

      {/* Center Pane: Diagram Canvas or Codebase View */}
      <main className={`main-content ${activeView === 'codebase' ? 'codebase-active' : ''}`}>
        {activeView === 'architecture' && (
          <DiagramPanel
            diagramName={activeDiagram}
            highlights={highlights}
            diffMode={planDiff.diffMode}
            proposedDiagram={planDiff.proposedDiagram}
          />
        )}
        {activeView === 'codebase' && (
          <CodebaseView />
        )}
      </main>

      {/* Right Pane: Vertical Timeline */}
      <aside className="timeline-pane">
        <TimelineView />
      </aside>

      {/* Floating Chat Panel at bottom center */}
      <div className="chat-panel-container">
        <ChatPanel />
      </div>

      {/* View Switcher - floating over center pane */}
      <div className="view-switcher" role="tablist" aria-label="View mode">
        <button
          role="tab"
          aria-selected={activeView === 'architecture'}
          className={`view-tab ${activeView === 'architecture' ? 'active' : ''}`}
          onClick={() => setActiveView('architecture')}
          title="Architecture diagrams (Mermaid)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          <span>Architecture</span>
        </button>
        <button
          role="tab"
          aria-selected={activeView === 'codebase'}
          className={`view-tab ${activeView === 'codebase' ? 'active' : ''}`}
          onClick={() => setActiveView('codebase')}
          title="Codebase view (Gource-style tree)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 18 19 21 15 21 13 18 17 18"></polyline>
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <span>Codebase</span>
        </button>
      </div>
    </div>
  );
}

export default App;