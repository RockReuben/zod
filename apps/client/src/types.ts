/** Event types matching the server's WebSocket broadcast format */
export interface HookEvent {
  type: 'event';
  event_id: number;
  session_id: string;
  source_app: string;
  agent_name: string;
  event_type: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: Record<string, unknown>;
  timestamp?: number;
  transcript_path?: string;
}

/** Session lane for the timeline view */
export interface SessionLane {
  session_id: string;
  agent_name: string;
  events: HookEvent[];
}

/** Connection status for WebSocket */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'error';

/** Session metadata for replay selector */
export interface SessionInfo {
  session_id: string;
  agent_name: string;
  source_app: string;
  event_count: number;
  start_time: number;
  end_time: number;
}