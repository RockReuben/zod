import { useState } from 'react';
import { TimelineView } from './views/TimelineView';
import { DiagramPanel } from './components/DiagramPanel';
import './index.css';

function App() {
  const [activeDiagram, setActiveDiagram] = useState<string>('system-overview');

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
          <DiagramPanel diagramName={activeDiagram} />
        </main>
        <div className="timeline-section">
          <TimelineView />
        </div>
      </div>
    </div>
  );
}

export default App;