import { useState, useEffect } from 'react';
import { TimelineView } from './views/TimelineView';
import { DiagramPanel } from './components/DiagramPanel';
import { useEventsStore } from './stores/events';
import './index.css';

function App() {
  const [activeDiagram, setActiveDiagram] = useState<string>('system-overview');
  const highlights = useEventsStore((s) => s.highlights);
  const clearExpiredHighlights = useEventsStore((s) => s.clearExpiredHighlights);

  // Clear expired highlights every second
  useEffect(() => {
    const interval = setInterval(() => {
      clearExpiredHighlights();
    }, 1000);
    return () => clearInterval(interval);
  }, [clearExpiredHighlights]);

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
      </div>
    </div>
  );
}

export default App;