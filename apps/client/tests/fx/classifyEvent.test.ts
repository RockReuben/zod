import { describe, it, expect } from 'vitest';
import { classifyEvent } from '../../src/fx/classifyEvent';
import type { HookEvent } from '../../src/types';

describe('classifyEvent', () => {
  const baseEvent: HookEvent = {
    type: 'event',
    event_id: 1,
    uuid: 'test-uuid',
    session_id: 'test-session',
    source_app: 'test-app',
    agent_name: 'test-agent',
    event_type: 'PostToolUse',
    tool_name: 'Write',
    tool_input: {},
    tool_output: {},
    timestamp: Date.now() / 1000,
  };

  it('classifies Write as write', () => {
    const event = { ...baseEvent, tool_name: 'Write' };
    expect(classifyEvent(event)).toBe('write');
  });

  it('classifies Edit as write', () => {
    const event = { ...baseEvent, tool_name: 'Edit' };
    expect(classifyEvent(event)).toBe('write');
  });

  it('classifies MultiEdit as write', () => {
    const event = { ...baseEvent, tool_name: 'MultiEdit' };
    expect(classifyEvent(event)).toBe('write');
  });

  it('classifies Read as read when trackReads enabled', () => {
    const event = { ...baseEvent, tool_name: 'Read' };
    expect(classifyEvent(event, { trackReads: true })).toBe('read');
  });

  it('returns null for Read when trackReads disabled', () => {
    const event = { ...baseEvent, tool_name: 'Read' };
    expect(classifyEvent(event, { trackReads: false })).toBeNull();
  });

  it('classifies Grep as search when trackSearches enabled', () => {
    const event = { ...baseEvent, tool_name: 'Grep' };
    expect(classifyEvent(event, { trackSearches: true })).toBe('search');
  });

  it('classifies Glob as search when trackSearches enabled', () => {
    const event = { ...baseEvent, tool_name: 'Glob' };
    expect(classifyEvent(event, { trackSearches: true })).toBe('search');
  });

  it('classifies WebSearch as search when trackSearches enabled', () => {
    const event = { ...baseEvent, tool_name: 'WebSearch' };
    expect(classifyEvent(event, { trackSearches: true })).toBe('search');
  });

  it('returns null for search tools when trackSearches disabled', () => {
    const event = { ...baseEvent, tool_name: 'Grep' };
    expect(classifyEvent(event, { trackSearches: false })).toBeNull();
  });

  it('classifies Task as other', () => {
    const event = { ...baseEvent, tool_name: 'Task' };
    expect(classifyEvent(event)).toBe('other');
  });

  it('classifies Bash as other', () => {
    const event = { ...baseEvent, tool_name: 'Bash' };
    expect(classifyEvent(event)).toBe('other');
  });

  it('returns null for unknown tool', () => {
    const event = { ...baseEvent, tool_name: 'UnknownTool' };
    expect(classifyEvent(event)).toBeNull();
  });

  it('returns null when no tool_name', () => {
    const event = { ...baseEvent, tool_name: undefined };
    expect(classifyEvent(event)).toBeNull();
  });

  it('classifies error event_type as error', () => {
    const event = { ...baseEvent, event_type: 'Error' };
    expect(classifyEvent(event)).toBe('error');
  });

  it('classifies RateLimitError as error', () => {
    const event = { ...baseEvent, event_type: 'RateLimitError' };
    expect(classifyEvent(event)).toBe('error');
  });

  it('classifies ModelError as error', () => {
    const event = { ...baseEvent, event_type: 'ModelError' };
    expect(classifyEvent(event)).toBe('error');
  });

  it('classifies tool_output.error as error', () => {
    const event = { ...baseEvent, tool_output: { error: 'Something failed' } };
    expect(classifyEvent(event)).toBe('error');
  });

  it('classifies tool_output.is_error as error', () => {
    const event = { ...baseEvent, tool_output: { is_error: true } };
    expect(classifyEvent(event)).toBe('error');
  });

  it('classifies tool_output.failed as error', () => {
    const event = { ...baseEvent, tool_output: { failed: 'yes' } };
    expect(classifyEvent(event)).toBe('error');
  });

  it('classifies tool_output.rate_limited as error', () => {
    const event = { ...baseEvent, tool_output: { rate_limited: true } };
    expect(classifyEvent(event)).toBe('error');
  });

  it('error takes priority over tool type', () => {
    const event = { ...baseEvent, tool_name: 'Write', event_type: 'Error' };
    expect(classifyEvent(event)).toBe('error');
  });

  it('error takes priority over trackReads', () => {
    const event = { ...baseEvent, tool_name: 'Read', tool_output: { error: 'Failed' }, trackReads: true };
    expect(classifyEvent(event, { trackReads: true })).toBe('error');
  });

  it('error takes priority over trackSearches', () => {
    const event = { ...baseEvent, tool_name: 'Grep', tool_output: { is_error: true }, trackSearches: true };
    expect(classifyEvent(event, { trackSearches: true })).toBe('error');
  });
});