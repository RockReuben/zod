import { useCodeGraphStore, ViewMode } from '../stores/codeGraph';
import './CodebaseModeSwitcher.css';

const MODE_LABELS: Record<ViewMode, string> = {
  gource: 'Gource Tree',
  voronoi: 'Voronoi',
  treemap: 'Treemap',
  depgraph: 'Dep Graph',
  city3d: '3D City',
};

const MODE_DESCRIPTIONS: Record<ViewMode, string> = {
  gource: 'Animated radial directory tree with agent activity',
  voronoi: 'Voronoi diagram of file relationships (coming soon)',
  treemap: 'Nested rectangles sized by LOC (coming soon)',
  depgraph: 'Force-directed dependency graph (coming soon)',
  city3d: '3D code city visualization (coming soon)',
};

const IMPLEMENTED_MODES: ViewMode[] = ['gource'];

export function CodebaseModeSwitcher() {
  const selectedMode = useCodeGraphStore((state) => state.selectedMode);
  const setMode = useCodeGraphStore((state) => state.setMode);

  return (
    <div className="codebase-mode-switcher" role="tablist" aria-label="Codebase view mode">
      {(['gource', 'voronoi', 'treemap', 'depgraph', 'city3d'] as ViewMode[]).map((mode) => {
        const isImplemented = IMPLEMENTED_MODES.includes(mode);
        const isSelected = selectedMode === mode;

        return (
          <button
            key={mode}
            role="tab"
            aria-selected={isSelected}
            aria-disabled={!isImplemented}
            className={`mode-tab ${isSelected ? 'active' : ''} ${!isImplemented ? 'disabled' : ''}`}
            onClick={() => isImplemented && setMode(mode)}
            disabled={!isImplemented}
            title={MODE_DESCRIPTIONS[mode]}
          >
            <span className="mode-label">{MODE_LABELS[mode]}</span>
            {!isImplemented && <span className="mode-badge">Soon</span>}
          </button>
        );
      })}
    </div>
  );
}