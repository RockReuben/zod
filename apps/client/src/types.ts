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

/** Diagram-related event types */
export type DiagramEventType = 'unmapped_edit' | 'diagram_drift' | 'node_highlight';

export function isDiagramEvent(eventType: string): eventType is DiagramEventType {
  return eventType === 'unmapped_edit' || eventType === 'diagram_drift' || eventType === 'node_highlight';
}

/** Node highlight information for diagram visualization */
export interface NodeHighlight {
  node: string;
  agentName: string;
  diagram: string;
  timestamp: number; // Unix timestamp in milliseconds
  color: string;
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

/** Inbox message from server */
export interface InboxMessage {
  session_id: string | null;
  text: string;
  created_at: number;
}