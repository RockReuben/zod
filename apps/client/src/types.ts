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
export type DiagramEventType = 'unmapped_edit' | 'diagram_drift' | 'node_highlight' | 'node_highlight_read';

export function isDiagramEvent(eventType: string): eventType is DiagramEventType {
  return eventType === 'unmapped_edit' || eventType === 'diagram_drift' || eventType === 'node_highlight' || eventType === 'node_highlight_read';
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
  type: 'message';
  session_id: string | null;
  text: string;
  created_at: number;
}

/** Question from agent to user (server representation) */
export interface Question {
  id: number;
  uuid: string;
  session_id: string;
  agent_name: string;
  question_text: string;
  answer_text: string | null;
  status: 'pending' | 'answered';
  created_at: number;
  answered_at: number | null;
}

/** Question rendered inline in chat history */
export interface QuestionMessage {
  type: 'question';
  id: number;
  uuid: string;
  session_id: string;
  agent_name: string;
  question_text: string;
  answer_text: string | null;
  status: 'pending' | 'answered';
  created_at: number;
  answered_at: number | null;
  // For compatibility with InboxMessage display
  text: string;
}

/** Union type for chat history items (messages + questions) */
export type ChatItem = InboxMessage | QuestionMessage;

/** Type guard for QuestionMessage */
export function isQuestionMessage(item: ChatItem): item is QuestionMessage {
  return item.type === 'question';
}

/** Speech Recognition API types (webkitSpeechRecognition / SpeechRecognition) */
export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  grammars: SpeechGrammarList;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

export interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechGrammarList {
  length: number;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
  addFromURI(src: string, weight?: number): void;
  addFromString(string: string, weight?: number): void;
}

export interface SpeechGrammar {
  src: string;
  weight: number;
}

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}