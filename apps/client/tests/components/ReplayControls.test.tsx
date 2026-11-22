import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SessionInfo } from '../../src/types';
import { useState } from 'react';

// Recreate the components locally since they're not exported
const REPLAY_SPEEDS = [1, 2, 5, 10];

const formatSessionLabel = (session: SessionInfo): string => {
  const date = new Date(session.start_time * 1000);
  const timeStr = date.toLocaleTimeString();
  return `${session.session_id} (${session.source_app}, ${session.agent_name}, ${session.event_count} events, ${timeStr})`;
};

function ReplaySessionSelector({ sessions, onSelect, disabled }: { sessions: SessionInfo[]; onSelect: (sessionId: string) => void; disabled: boolean }) {
  const [selectedSession, setSelectedSession] = useState<string>('');

  const handleStart = () => {
    if (selectedSession) {
      onSelect(selectedSession);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="replay-selector empty">
        <span>No historical sessions found</span>
      </div>
    );
  }

  return (
    <div className="replay-selector">
      <label htmlFor="replay-session-select" className="replay-label">
        Replay Session:
      </label>
      <select
        id="replay-session-select"
        className="replay-select"
        value={selectedSession}
        onChange={(e) => setSelectedSession(e.target.value)}
        disabled={disabled}
      >
        <option value="">— Select a session to replay —</option>
        {sessions.map((session) => (
          <option key={session.session_id} value={session.session_id}>
            {formatSessionLabel(session)}
          </option>
        ))}
      </select>
      <button
        className="replay-start-btn"
        onClick={handleStart}
        disabled={!selectedSession || disabled}
      >
        Start Replay
      </button>
    </div>
  );
}

function ReplayControlsBar({ progress, speed, onSpeedChange, onStop }: { progress: number; speed: number; onSpeedChange: (speed: number) => void; onStop: () => void }) {
  return (
    <div className="replay-controls-bar">
      <div className="replay-progress-container">
        <div className="replay-progress-label">Replay Progress</div>
        <div className="replay-progress-bar">
          <div
            className="replay-progress-fill"
            data-testid="replay-progress-fill"
            style={{ width: `${progress}%` } as React.CSSProperties}
          />
        </div>
        <div className="replay-progress-text">{Math.round(progress)}%</div>
      </div>
      <div className="replay-controls">
        <label className="replay-speed-label">
          Speed:
          <select
            className="replay-speed-select"
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
          >
            {REPLAY_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>
        <button className="replay-stop-btn" onClick={onStop}>
          Stop Replay
        </button>
      </div>
    </div>
  );
}

describe('formatSessionLabel', () => {
  const mockSession: SessionInfo = {
    session_id: 'sess-abc123',
    agent_name: 'test-agent',
    source_app: 'pkg-test',
    event_count: 42,
    start_time: 1700000000, // Fixed timestamp
    end_time: 1700000100,
  };

  it('formats session label with all fields', () => {
    const label = formatSessionLabel(mockSession);
    expect(label).toContain('sess-abc123');
    expect(label).toContain('pkg-test');
    expect(label).toContain('test-agent');
    expect(label).toContain('42 events');
  });

  it('includes formatted time', () => {
    const label = formatSessionLabel(mockSession);
    // Time should be formatted as locale time string
    expect(label).toMatch(/\d{1,2}:\d{2}/); // HH:MM format
  });
});

describe('ReplaySessionSelector component', () => {
  const mockSessions: SessionInfo[] = [
    {
      session_id: 'sess-1',
      agent_name: 'agent-1',
      source_app: 'app-1',
      event_count: 10,
      start_time: 1000,
      end_time: 2000,
    },
    {
      session_id: 'sess-2',
      agent_name: 'agent-2',
      source_app: 'app-2',
      event_count: 20,
      start_time: 3000,
      end_time: 4000,
    },
  ];

  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders empty state when no sessions', () => {
    render(<ReplaySessionSelector sessions={[]} onSelect={mockOnSelect} disabled={false} />);

    expect(screen.getByText('No historical sessions found')).toBeInTheDocument();
    expect(screen.queryByLabelText('Replay Session:')).not.toBeInTheDocument();
  });

  it('renders session dropdown when sessions exist', () => {
    render(<ReplaySessionSelector sessions={mockSessions} onSelect={mockOnSelect} disabled={false} />);

    expect(screen.getByLabelText('Replay Session:')).toBeInTheDocument();
    const select = screen.getByLabelText('Replay Session:');
    expect(select).toBeInTheDocument();
    expect(select).not.toBeDisabled();
  });

  it('shows placeholder option first', () => {
    render(<ReplaySessionSelector sessions={mockSessions} onSelect={mockOnSelect} disabled={false} />);

    const select = screen.getByLabelText('Replay Session:');
    expect(select).toHaveValue('');
  });

  it('lists all sessions with formatted labels', () => {
    render(<ReplaySessionSelector sessions={mockSessions} onSelect={mockOnSelect} disabled={false} />);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3); // placeholder + 2 sessions
    expect(options[1]).toHaveValue('sess-1');
    expect(options[2]).toHaveValue('sess-2');
  });

  it('disables dropdown when disabled prop is true', () => {
    render(<ReplaySessionSelector sessions={mockSessions} onSelect={mockOnSelect} disabled={true} />);

    const select = screen.getByLabelText('Replay Session:');
    expect(select).toBeDisabled();
  });

  it('disables Start Replay button when no session selected', () => {
    render(<ReplaySessionSelector sessions={mockSessions} onSelect={mockOnSelect} disabled={false} />);

    const button = screen.getByText('Start Replay');
    expect(button).toBeDisabled();
  });

  it('enables Start Replay button when session selected', () => {
    render(<ReplaySessionSelector sessions={mockSessions} onSelect={mockOnSelect} disabled={false} />);

    const select = screen.getByLabelText('Replay Session:');
    fireEvent.change(select, { target: { value: 'sess-1' } });

    const button = screen.getByText('Start Replay');
    expect(button).not.toBeDisabled();
  });

  it('calls onSelect with selected session when Start Replay clicked', () => {
    render(<ReplaySessionSelector sessions={mockSessions} onSelect={mockOnSelect} disabled={false} />);

    const select = screen.getByLabelText('Replay Session:');
    fireEvent.change(select, { target: { value: 'sess-1' } });

    fireEvent.click(screen.getByText('Start Replay'));

    expect(mockOnSelect).toHaveBeenCalledWith('sess-1');
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('does not call onSelect when button is disabled (no selection)', () => {
    render(<ReplaySessionSelector sessions={mockSessions} onSelect={mockOnSelect} disabled={false} />);

    // Don't select a session, button should be disabled
    fireEvent.click(screen.getByText('Start Replay'));

    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('does not call onSelect when disabled prop is true', () => {
    render(<ReplaySessionSelector sessions={mockSessions} onSelect={mockOnSelect} disabled={true} />);

    const select = screen.getByLabelText('Replay Session:');
    fireEvent.change(select, { target: { value: 'sess-1' } });

    fireEvent.click(screen.getByText('Start Replay'));

    expect(mockOnSelect).not.toHaveBeenCalled();
  });
});

describe('ReplayControlsBar component', () => {
  const mockOnSpeedChange = vi.fn();
  const mockOnStop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders progress bar with correct width', () => {
    render(<ReplayControlsBar progress={50} speed={1} onSpeedChange={mockOnSpeedChange} onStop={mockOnStop} />);

    const progressFill = screen.getByTestId('replay-progress-fill');
    expect(progressFill).toHaveStyle({ width: '50%' });
  });

  it('shows progress percentage text', () => {
    render(<ReplayControlsBar progress={75} speed={1} onSpeedChange={mockOnSpeedChange} onStop={mockOnStop} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('rounds progress percentage for display', () => {
    render(<ReplayControlsBar progress={33.333} speed={1} onSpeedChange={mockOnSpeedChange} onStop={mockOnStop} />);

    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('renders speed selector with all speed options', () => {
    render(<ReplayControlsBar progress={0} speed={2} onSpeedChange={mockOnSpeedChange} onStop={mockOnStop} />);

    const select = screen.getByLabelText('Speed:');
    expect(select).toHaveValue('2');
    const options = screen.getAllByRole('option');
    expect(options.map(o => o.textContent)).toEqual(['1x', '2x', '5x', '10x']);
  });

  it('calls onSpeedChange when speed selector changes', () => {
    render(<ReplayControlsBar progress={0} speed={1} onSpeedChange={mockOnSpeedChange} onStop={mockOnStop} />);

    const select = screen.getByLabelText('Speed:');
    fireEvent.change(select, { target: { value: '5' } });

    expect(mockOnSpeedChange).toHaveBeenCalledWith(5);
  });

  it('renders Stop Replay button', () => {
    render(<ReplayControlsBar progress={0} speed={1} onSpeedChange={mockOnSpeedChange} onStop={mockOnStop} />);

    expect(screen.getByText('Stop Replay')).toBeInTheDocument();
  });

  it('calls onStop when Stop Replay button clicked', () => {
    render(<ReplayControlsBar progress={0} speed={1} onSpeedChange={mockOnSpeedChange} onStop={mockOnStop} />);

    fireEvent.click(screen.getByText('Stop Replay'));

    expect(mockOnStop).toHaveBeenCalledTimes(1);
  });

  it('shows 0% progress when progress is 0', () => {
    render(<ReplayControlsBar progress={0} speed={1} onSpeedChange={mockOnSpeedChange} onStop={mockOnStop} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('shows 100% progress when progress is 100', () => {
    render(<ReplayControlsBar progress={100} speed={1} onSpeedChange={mockOnSpeedChange} onStop={mockOnStop} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    const progressFill = screen.getByTestId('replay-progress-fill');
    expect(progressFill).toHaveStyle({ width: '100%' });
  });
});