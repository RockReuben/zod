/** Event classification - maps hook events to visual effect kinds */

import type { HookEvent } from '../types';
import type { FxKind } from './motionConfig';

/** Write tool names that trigger 'write' effects */
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

/** Read tool names that trigger 'read' effects */
const READ_TOOLS = new Set(['Read']);

/** Search tool names that trigger 'search' effects */
const SEARCH_TOOLS = new Set(['Grep', 'Glob', 'WebSearch']);

/** Event types that indicate an error/failure */
const ERROR_EVENT_TYPES = new Set([
  'Error',
  'RateLimitError',
  'ModelError',
  'ToolError',
  'FailedToolUse',
]);

/** Tool output fields that indicate failure */
const ERROR_OUTPUT_FIELDS = ['error', 'is_error', 'failed'];

/**
 * Classify a hook event into a visual effect kind.
 * Returns null for events that should not produce any visual effect.
 *
 * Priority order:
 * 1. Error events → 'error'
 * 2. Write tools → 'write'
 * 3. Read tools → 'read' (if trackReads enabled)
 * 4. Search tools → 'search' (if trackSearches enabled)
 * 5. Other mapped events → 'other'
 * 6. Non-activity events → null
 */
export function classifyEvent(
  event: HookEvent,
  options: { trackReads?: boolean; trackSearches?: boolean } = {}
): FxKind | null {
  const { trackReads = false, trackSearches = false } = options;

  // Check for error conditions first (highest priority)
  if (isErrorEvent(event)) {
    return 'error';
  }

  const toolName = event.tool_name;

  // No tool name = not an activity event we can classify
  if (!toolName) {
    return null;
  }

  // Write tools
  if (WRITE_TOOLS.has(toolName)) {
    return 'write';
  }

  // Read tools (only if enabled)
  if (READ_TOOLS.has(toolName)) {
    return trackReads ? 'read' : null;
  }

  // Search tools (only if enabled)
  if (SEARCH_TOOLS.has(toolName)) {
    return trackSearches ? 'search' : null;
  }

  // Other recognized tool types that might be mapped
  // These don't get default effects but could be mapped by the server
  const OTHER_MAPPED_TOOLS = new Set(['Task', 'Bash', 'TodoWrite', 'NotebookEdit', 'NotebookRead']);
  if (OTHER_MAPPED_TOOLS.has(toolName)) {
    return 'other';
  }

  // Unknown tool - no visual effect
  return null;
}

/** Check if an event represents an error/failure condition */
function isErrorEvent(event: HookEvent): boolean {
  // Check event_type for error indicators
  if (ERROR_EVENT_TYPES.has(event.event_type)) {
    return true;
  }

  // Check tool_output for error fields
  if (event.tool_output) {
    for (const field of ERROR_OUTPUT_FIELDS) {
      if (field in event.tool_output) {
        const value = event.tool_output[field];
        if (value === true || (typeof value === 'string' && value.length > 0)) {
          return true;
        }
      }
    }
  }

  // Check for rate limiting in tool_output
  if (event.tool_output?.rate_limited === true) {
    return true;
  }

  return false;
}

/** Get the list of tool names for a given kind (for testing/debugging) */
export function getToolsForKind(kind: FxKind): readonly string[] {
  switch (kind) {
    case 'write':
      return [...WRITE_TOOLS];
    case 'read':
      return [...READ_TOOLS];
    case 'search':
      return [...SEARCH_TOOLS];
    case 'error':
      return []; // Errors are not tool-specific
    case 'other':
      return ['Task', 'Bash', 'TodoWrite', 'NotebookEdit', 'NotebookRead'];
    default:
      return [];
  }
}

/** Check if a tool name is recognized (for testing) */
export function isRecognizedTool(toolName: string): boolean {
  return (
    WRITE_TOOLS.has(toolName) ||
    READ_TOOLS.has(toolName) ||
    SEARCH_TOOLS.has(toolName) ||
    ['Task', 'Bash', 'TodoWrite', 'NotebookEdit', 'NotebookRead'].includes(toolName)
  );
}