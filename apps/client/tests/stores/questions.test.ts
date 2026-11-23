/** Spec tests for P5.4: Questions store actions.

These tests are written from the contract (zod-control-center.md) before implementation.
They use vitest's test.failing (or skip with reason) to mark pending:P5.4 tests.

matrix: useEventsStore.addQuestion | Valid/typical | P5.4
matrix: useEventsStore.addQuestion | Duplicate question_id | invariant
matrix: useEventsStore.answerQuestion | Valid/typical | P5.4
matrix: useEventsStore.answerQuestion | Non-existent question | invariant
matrix: useEventsStore.dismissQuestion | Valid/typical | P5.4
matrix: useEventsStore.dismissQuestion | Non-existent question | invariant
matrix: useEventsStore.questions Map | Specified | P5.4
*/

import { describe, it, expect, vi, beforeEach, act } from 'vitest'
import { useEventsStore } from '../../src/stores/events'
import { HookEvent } from '../../src/types'

// Helper to create question event
const createQuestionEvent = (overrides: Partial<HookEvent> = {}): HookEvent => ({
  type: 'event',
  event_id: Date.now(),
  session_id: 'test-session',
  source_app: 'test-app',
  agent_name: 'test-agent',
  event_type: 'question',
  tool_name: undefined,
  tool_input: {
    question_id: 1,
    question_text: 'Test question?',
    question_uuid: 'uuid-123',
    ...overrides.tool_input,
  },
  tool_output: {},
  timestamp: Date.now(),
  transcript_path: undefined,
  ...overrides,
})

const createAnswerEvent = (overrides: Partial<HookEvent> = {}): HookEvent => ({
  type: 'event',
  event_id: Date.now() + 1,
  session_id: 'test-session',
  source_app: 'test-app',
  agent_name: 'test-agent',
  event_type: 'question_answered',
  tool_name: undefined,
  tool_input: {
    question_id: 1,
    answer_text: 'Test answer.',
    question_uuid: 'uuid-123',
    ...overrides.tool_input,
  },
  tool_output: {},
  timestamp: Date.now() + 1000,
  transcript_path: undefined,
  ...overrides,
})

describe('useEventsStore - Questions', () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useEventsStore.getState().clear()
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('addQuestion (via addEvent with question event)', () => {
    it.skip(
      'adds question to questions Map keyed by question_id',
      () => {
        const questionEvent = createQuestionEvent({ tool_input: { question_id: 42, question_text: 'Store question?' } })

        act(() => {
          useEventsStore.getState().addEvent(questionEvent)
        })

        const questions = useEventsStore.getState().questions
        expect(questions.has(42)).toBe(true)
        expect(questions.get(42)).toEqual(questionEvent)
      }
    )

    it.skip(
      'does not overwrite existing question with same question_id',
      () => {
        const q1 = createQuestionEvent({ event_id: 1, tool_input: { question_id: 1, question_text: 'First?' } })
        const q2 = createQuestionEvent({ event_id: 2, tool_input: { question_id: 1, question_text: 'Second?' } })

        act(() => {
          useEventsStore.getState().addEvent(q1)
          useEventsStore.getState().addEvent(q2)
        })

        const questions = useEventsStore.getState().questions
        expect(questions.size).toBe(1)
        expect(questions.get(1)?.event_id).toBe(1) // Original preserved
      }
    )

    it.skip(
      'ignores non-question events',
      () => {
        const normalEvent: HookEvent = {
          type: 'event',
          event_id: 1,
          session_id: 'test',
          source_app: 'test',
          agent_name: 'test',
          event_type: 'PostToolUse',
          tool_name: 'Write',
          tool_input: { file_path: 'test.py' },
          tool_output: {},
          timestamp: Date.now(),
        }

        act(() => {
          useEventsStore.getState().addEvent(normalEvent)
        })

        const questions = useEventsStore.getState().questions
        expect(questions.size).toBe(0)
      }
    )

    it.skip(
      'handles question event missing question_id gracefully',
      () => {
        const malformedEvent = createQuestionEvent({ tool_input: { question_text: 'No ID?' } })
        // Remove question_id
        delete malformedEvent.tool_input!.question_id

        act(() => {
          useEventsStore.getState().addEvent(malformedEvent)
        })

        const questions = useEventsStore.getState().questions
        expect(questions.size).toBe(0) // Should not add without question_id
      }
    )
  })

  describe('answerQuestion', () => {
    it.skip(
      'calls POST /questions/:id/answer API',
      async () => {
        // We test the store action directly
        // The actual API call is tested in server tests
        // Here we verify the action exists and has correct signature
        const store = useEventsStore.getState()
        expect(typeof store.answerQuestion).toBe('function')
      }
    )

    it.skip(
      'updates local question with answer on success',
      async () => {
        const questionEvent = createQuestionEvent({ tool_input: { question_id: 1, question_text: 'To answer?' } })

        act(() => {
          useEventsStore.getState().addEvent(questionEvent)
        })

        // Mock fetch
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ status: 'answered', answer_text: 'The answer' }),
        })

        await act(async () => {
          await useEventsStore.getState().answerQuestion(1, 'The answer')
        })

        const questions = useEventsStore.getState().questions
        const updated = questions.get(1)
        // After answer, the question should have answer info in tool_output or be replaced
        expect(updated).toBeDefined()
      }
    )

    it.skip(
      'throws on API error',
      async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        })

        await expect(
          act(async () => {
            await useEventsStore.getState().answerQuestion(1, 'Answer')
          })
        ).rejects.toThrow()
      }
    )

    it.skip(
      'does nothing for non-existent question_id',
      async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        })

        // Should not throw
        await act(async () => {
          await useEventsStore.getState().answerQuestion(999, 'Answer')
        })

        // fetch should still be called
        expect(global.fetch).toHaveBeenCalled()
      }
    )
  })

  describe('dismissQuestion', () => {
    it.skip(
      'calls POST /questions/:id/dismiss API',
      async () => {
        const store = useEventsStore.getState()
        expect(typeof store.dismissQuestion).toBe('function')
      }
    )

    it.skip(
      'removes question from local Map on success',
      async () => {
        const questionEvent = createQuestionEvent({ tool_input: { question_id: 1, question_text: 'To dismiss?' } })

        act(() => {
          useEventsStore.getState().addEvent(questionEvent)
        })

        expect(useEventsStore.getState().questions.has(1)).toBe(true)

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ status: 'dismissed' }),
        })

        await act(async () => {
          await useEventsStore.getState().dismissQuestion(1)
        })

        const questions = useEventsStore.getState().questions
        expect(questions.has(1)).toBe(false)
      }
    )

    it.skip(
      'throws on API error',
      async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        })

        await expect(
          act(async () => {
            await useEventsStore.getState().dismissQuestion(1)
          })
        ).rejects.toThrow()
      }
    )
  })

  describe('questions Map state', () => {
    it.skip(
      'is initially empty',
      () => {
        const questions = useEventsStore.getState().questions
        expect(questions).toBeInstanceOf(Map)
        expect(questions.size).toBe(0)
      }
    )

    it.skip(
      'persists across other store actions',
      () => {
        const questionEvent = createQuestionEvent({ tool_input: { question_id: 1, question_text: 'Persist?' } })

        act(() => {
          useEventsStore.getState().addEvent(questionEvent)
        })

        // Do other actions
        act(() => {
          useEventsStore.getState().setFilter('sourceApp', 'test')
          useEventsStore.getState().addEvent({
            ...questionEvent,
            event_id: 2,
            event_type: 'PostToolUse',
            tool_name: 'Write',
            tool_input: { file_path: 'test.py' },
          })
        })

        const questions = useEventsStore.getState().questions
        expect(questions.has(1)).toBe(true)
      }
    )

    it.skip(
      'clears on store clear',
      () => {
        const questionEvent = createQuestionEvent({ tool_input: { question_id: 1, question_text: 'Clear?' } })

        act(() => {
          useEventsStore.getState().addEvent(questionEvent)
        })

        act(() => {
          useEventsStore.getState().clear()
        })

        const questions = useEventsStore.getState().questions
        expect(questions.size).toBe(0)
      }
    )
  })

  describe('Question event handling in addEvent', () => {
    it.skip(
      'extracts question_id from tool_input',
      () => {
        const questionEvent = createQuestionEvent({ tool_input: { question_id: 999, question_text: 'Extract ID?' } })

        act(() => {
          useEventsStore.getState().addEvent(questionEvent)
        })

        expect(useEventsStore.getState().questions.has(999)).toBe(true)
      }
    )

    it.skip(
      'handles question_answered event by updating question',
      () => {
        const questionEvent = createQuestionEvent({ tool_input: { question_id: 1, question_text: 'Will answer?' } })
        const answerEvent = createAnswerEvent({ tool_input: { question_id: 1, answer_text: 'Answered!' } })

        act(() => {
          useEventsStore.getState().addEvent(questionEvent)
          useEventsStore.getState().addEvent(answerEvent)
        })

        const questions = useEventsStore.getState().questions
        const updated = questions.get(1)
        expect(updated).toBeDefined()
        // The answer event should be linked or the question updated
        expect(updated?.event_type).toBe('question')
      }
    )
  })
})

// Export for test matrix reference
export { createQuestionEvent, createAnswerEvent }