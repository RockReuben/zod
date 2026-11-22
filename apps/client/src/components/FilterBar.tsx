import { useEventsStore } from '../stores/events';
import './FilterBar.css';

export function FilterBar() {
  const filters = useEventsStore((s) => s.filters);
  const setFilter = useEventsStore((s) => s.setFilter);
  const resetFilters = useEventsStore((s) => s.resetFilters);
  const getAvailableFilters = useEventsStore((s) => s.getAvailableFilters);

  const { sourceApps, agentNames, eventTypes } = getAvailableFilters();

  const isFiltered =
    filters.sourceApp !== 'all' ||
    filters.agentName !== 'all' ||
    filters.eventType !== 'all';

  return (
    <div className="filter-bar" role="search" aria-label="Filter events">
      <div className="filter-group">
        <label htmlFor="filter-package" className="filter-label">
          Package:
        </label>
        <select
          id="filter-package"
          className="filter-select"
          value={filters.sourceApp}
          onChange={(e) => setFilter('sourceApp', e.target.value)}
        >
          <option value="all">All Packages ({sourceApps.length})</option>
          {sourceApps.map((app) => (
            <option key={app} value={app}>
              {app}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-agent" className="filter-label">
          Agent:
        </label>
        <select
          id="filter-agent"
          className="filter-select"
          value={filters.agentName}
          onChange={(e) => setFilter('agentName', e.target.value)}
        >
          <option value="all">All Agents ({agentNames.length})</option>
          {agentNames.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-event-type" className="filter-label">
          Event Type:
        </label>
        <select
          id="filter-event-type"
          className="filter-select"
          value={filters.eventType}
          onChange={(e) => setFilter('eventType', e.target.value)}
        >
          <option value="all">All Event Types ({eventTypes.length})</option>
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {isFiltered && (
        <button
          type="button"
          className="reset-filters-btn"
          onClick={resetFilters}
          aria-label="Reset all filters"
        >
          Clear filters ✕
        </button>
      )}
    </div>
  );
}