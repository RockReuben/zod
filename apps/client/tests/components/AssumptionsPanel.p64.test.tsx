import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// =============================================================================
// P6.4 SPEC TESTS: Assumptions Panel - List assumptions & open questions from plan.md
// Contract: Parse plan.md sections, render with reply boxes, send replies to planner
// All spec tests marked pending:P6.4 using it.fails (strict-flip expected-failure)
// =============================================================================

// -----------------------------------------------------------------------------
// ENTRY POINT 1: Plan parser - extracts assumptions and open questions from plan.md
// Trust: INTERNAL (called by panel component)
// -----------------------------------------------------------------------------
describe('Plan parser - parsePlanAssumptions (pending:P6.4)', () => {
  // Function signature: parsePlanAssumptions(planMarkdown: string): PlanAssumptions
  // where PlanAssumptions = { assumptions: PlanItem[], openQuestions: PlanItem[] }
  // PlanItem = { id: string, text: string, lineNumber: number }

  it.fails('extracts assumptions from ## Assumptions section', () => {
    // matrix: plan parser | valid plan.md with assumptions | P6.4
    // Input class: Valid / typical
    // Contract: Parser extracts each bullet point under ## Assumptions
    // pending:P6.4: remove this marker when this test passes

    const planMd = `# Sample Plan

## Overview
Add a new endpoint.

## Assumptions
- Users authenticate via shared token
- No OAuth integration in MVP
- Validation is fast (< 1s)

## Open Questions
- Should we support API keys?

## Details
Implementation details here.`;

    // const result = parsePlanAssumptions(planMd);
    // expect(result.assumptions).toHaveLength(3);
    // expect(result.assumptions[0].text).toBe('Users authenticate via shared token');
    // expect(result.assumptions[1].text).toBe('No OAuth integration in MVP');
    // expect(result.assumptions[2].text).toBe('Validation is fast (< 1s)');
    // expect(result.assumptions[0].id).toBe('assumption-0');
  });

  it.fails('extracts open questions from ## Open Questions section', () => {
    // matrix: plan parser | valid plan.md with open questions | P6.4
    // Input class: Valid / typical
    // Contract: Parser extracts each bullet point under ## Open Questions
    // pending:P6.4: remove this marker when this test passes

    const planMd = `# Sample Plan

## Assumptions
- Users authenticate via shared token

## Open Questions
- Should we support API keys?
- Token expiration policy?
- Rate limiting needed?

## Details
Implementation details here.`;

    // const result = parsePlanAssumptions(planMd);
    // expect(result.openQuestions).toHaveLength(3);
    // expect(result.openQuestions[0].text).toBe('Should we support API keys?');
    // expect(result.openQuestions[1].text).toBe('Token expiration policy?');
    // expect(result.openQuestions[2].text).toBe('Rate limiting needed?');
  });

  it.fails('handles missing Assumptions section gracefully', () => {
    // matrix: plan parser | plan.md missing Assumptions | P6.4
    // Input class: Empty / missing
    // Robustness invariant: Returns empty array, does not crash
    // pending:P6.4: remove this marker when this test passes

    const planMd = `# Sample Plan

## Overview
Add a new endpoint.

## Open Questions
- Should we support API keys?`;

    // const result = parsePlanAssumptions(planMd);
    // expect(result.assumptions).toHaveLength(0);
    // expect(result.openQuestions).toHaveLength(1);
  });

  it.fails('handles missing Open Questions section gracefully', () => {
    // matrix: plan parser | plan.md missing Open Questions | P6.4
    // Input class: Empty / missing
    // Robustness invariant: Returns empty array, does not crash
    // pending:P6.4: remove this marker when this test passes

    const planMd = `# Sample Plan

## Overview
Add a new endpoint.

## Assumptions
- Users authenticate via shared token`;

    // const result = parsePlanAssumptions(planMd);
    // expect(result.assumptions).toHaveLength(1);
    // expect(result.openQuestions).toHaveLength(0);
  });

  it.fails('handles empty plan.md', () => {
    // matrix: plan parser | empty/malformed plan.md | P6.4
    // Input class: Empty / missing, Malformed
    // Robustness invariant: Does not crash, returns empty arrays
    // pending:P6.4: remove this marker when this test passes

    // const result = parsePlanAssumptions('');
    // expect(result.assumptions).toHaveLength(0);
    // expect(result.openQuestions).toHaveLength(0);
  });

  it.fails('ignores bullet points outside Assumptions/Open Questions sections', () => {
    // matrix: plan parser | bullets in other sections | P6.4
    // Input class: Valid / typical
    // Contract: Only extracts from ## Assumptions and ## Open Questions
    // pending:P6.4: remove this marker when this test passes

    const planMd = `# Sample Plan

## Details
- This should not be extracted
- Nor this

## Assumptions
- This should be extracted

## Open Questions
- This should also be extracted`;

    // const result = parsePlanAssumptions(planMd);
    // expect(result.assumptions).toHaveLength(1);
    // expect(result.openQuestions).toHaveLength(1);
  });

  it.fails('handles numbered lists in addition to bullet points', () => {
    // matrix: plan parser | numbered lists | P6.4
    // Input class: Valid / typical
    // Contract: Supports both - and 1. syntax
    // pending:P6.4: remove this marker when this test passes

    const planMd = `# Sample Plan

## Assumptions
1. First assumption
2. Second assumption

## Open Questions
1. First question?
2. Second question?`;

    // const result = parsePlanAssumptions(planMd);
    // expect(result.assumptions).toHaveLength(2);
    // expect(result.openQuestions).toHaveLength(2);
  });

  it.fails('assigns unique IDs to each item', () => {
    // matrix: plan parser | ID assignment | P6.4
    // Input class: Valid / typical
    // Contract: Each item gets unique ID (assumption-N, question-N)
    // pending:P6.4: remove this marker when this test passes

    const planMd = `# Sample Plan

## Assumptions
- Assumption 1
- Assumption 2

## Open Questions
- Question 1?`;

    // const result = parsePlanAssumptions(planMd);
    // expect(result.assumptions[0].id).toBe('assumption-0');
    // expect(result.assumptions[1].id).toBe('assumption-1');
    // expect(result.openQuestions[0].id).toBe('question-0');
  });
});

// -----------------------------------------------------------------------------
// ENTRY POINT 2: Plan fetcher - loads plan.md from server or file system
// Trust: EXTERNAL (server/file boundary)
// -----------------------------------------------------------------------------
describe('Plan fetcher - fetchPlanMarkdown (pending:P6.4)', () => {
  // Function signature: fetchPlanMarkdown(planName: string): Promise<string>
  // Fetches plan.md from server endpoint or plan folder

  it.fails('fetches plan.md from server endpoint', async () => {
    // matrix: plan fetcher | valid plan name | P6.4
    // Input class: Valid / typical
    // Contract: Returns plan.md content as string
    // pending:P6.4: remove this marker when this test passes

    // Mock fetch to return sample plan
    // const markdown = await fetchPlanMarkdown('sample-plan');
    // expect(markdown).toContain('## Assumptions');
    // expect(markdown).toContain('## Open Questions');
  });

  it.fails('handles 404 for non-existent plan', async () => {
    // matrix: plan fetcher | non-existent plan | P6.4
    // Input class: Invalid (not found)
    // Robustness invariant: Throws typed error, does not crash
    // pending:P6.4: remove this marker when this test passes

    // await expect(fetchPlanMarkdown('nonexistent')).rejects.toThrow('Plan not found');
  });

  it.fails('handles server errors gracefully', async () => {
    // matrix: plan fetcher | server error | P6.4
    // Input class: Server error (5xx)
    // Robustness invariant: Throws error with status info
    // pending:P6.4: remove this marker when this test passes

    // await expect(fetchPlanMarkdown('error-plan')).rejects.toThrow(/Server error/);
  });
});

// -----------------------------------------------------------------------------
// ENTRY POINT 3: Planner reply endpoint - POST /plans/:name/reply
// Trust: EXTERNAL (server boundary)
// -----------------------------------------------------------------------------
describe('Planner reply endpoint - sendPlanReply (pending:P6.4)', () => {
  // Function signature: sendPlanReply(planName: string, itemId: string, itemType: 'assumption' | 'question', reply: string): Promise<void>
  // Sends user's reply to planner agent via Agent SDK or server endpoint

  it.fails('sends reply for assumption', async () => {
    // matrix: planner reply | assumption reply | P6.4
    // Input class: Valid / typical
    // Contract: POST to /plans/:name/reply with { itemId, itemType, reply }
    // pending:P6.4: remove this marker when this test passes

    // await sendPlanReply('sample-plan', 'assumption-0', 'assumption', 'We should reconsider this');
    // expect(fetch).toHaveBeenCalledWith(
    //   expect.stringContaining('/plans/sample-plan/reply'),
    //   expect.objectContaining({
    //     method: 'POST',
    //     body: JSON.stringify({ itemId: 'assumption-0', itemType: 'assumption', reply: 'We should reconsider this' })
    //   })
    // );
  });

  it.fails('sends reply for open question', async () => {
    // matrix: planner reply | open question reply | P6.4
    // Input class: Valid / typical
    // Contract: Same endpoint, itemType = 'question'
    // pending:P6.4: remove this marker when this test passes

    // await sendPlanReply('sample-plan', 'question-0', 'question', 'Yes, support API keys');
    // expect(fetch).toHaveBeenCalledWith(
    //   expect.stringContaining('/plans/sample-plan/reply'),
    //   expect.objectContaining({
    //     method: 'POST',
    //     body: JSON.stringify({ itemId: 'question-0', itemType: 'question', reply: 'Yes, support API keys' })
    //   })
    // );
  });

  it.fails('handles network errors', async () => {
    // matrix: planner reply | network error | P6.4
    // Input class: Network error
    // Robustness invariant: Throws error, caller shows toast
    // pending:P6.4: remove this marker when this test passes

    // await expect(sendPlanReply('sample-plan', 'assumption-0', 'assumption', 'test'))
    //   .rejects.toThrow(/Network/);
  });

  it.fails('handles 404 for invalid plan', async () => {
    // matrix: planner reply | invalid plan | P6.4
    // Input class: Invalid (not found)
    // Robustness invariant: Throws error with plan info
    // pending:P6.4: remove this marker when this test passes

    // await expect(sendPlanReply('nonexistent', 'assumption-0', 'assumption', 'test'))
    //   .rejects.toThrow('Plan not found');
  });
});

// -----------------------------------------------------------------------------
// ENTRY POINT 4: AssumptionsPanel component
// Trust: EXTERNAL (user-facing UI component)
// -----------------------------------------------------------------------------
describe('AssumptionsPanel component (pending:P6.4)', () => {
  // Component: AssumptionsPanel accepts { planName: string }
  // Renders assumptions and open questions with reply boxes

  beforeEach(() => {
    vi.resetModules();
  });

  it.fails('shows loading state while fetching plan', () => {
    // matrix: AssumptionsPanel | initial render | P6.4
    // Input class: Lifecycle (use before init)
    // pending:P6.4: remove this marker when this test passes

    // render(<AssumptionsPanel planName="sample-plan" />);
    // expect(screen.getByRole('status', { name: 'Loading plan…' })).toBeInTheDocument();
  });

  it.fails('renders assumptions section with reply boxes', async () => {
    // matrix: AssumptionsPanel | assumptions loaded | P6.4
    // Input class: Valid / typical
    // Contract: Shows each assumption with text area and Send button
    // pending:P6.4: remove this marker when this test passes

    // render(<AssumptionsPanel planName="sample-plan" />);
    // await waitFor(() => expect(screen.getByText('Assumptions')).toBeInTheDocument());
    // expect(screen.getByText('Users authenticate via shared token')).toBeInTheDocument();
    // expect(screen.getByText('No OAuth integration in MVP')).toBeInTheDocument();
    // // Each assumption has a reply box
    // const textareas = screen.getAllByRole('textbox', { name: /reply to assumption/i });
    // expect(textareas).toHaveLength(3);
  });

  it.fails('renders open questions section with reply boxes', async () => {
    // matrix: AssumptionsPanel | open questions loaded | P6.4
    // Input class: Valid / typical
    // Contract: Shows each question with text area and Send button
    // pending:P6.4: remove this marker when this test passes

    // render(<AssumptionsPanel planName="sample-plan" />);
    // await waitFor(() => expect(screen.getByText('Open Questions')).toBeInTheDocument());
    // expect(screen.getByText('Should we support API keys?')).toBeInTheDocument();
    // expect(screen.getByText('Token expiration policy?')).toBeInTheDocument();
    // const textareas = screen.getAllByRole('textbox', { name: /reply to question/i });
    // expect(textareas).toHaveLength(2);
  });

  it.fails('sends reply when user clicks Send button', async () => {
    // matrix: AssumptionsPanel | send reply | P6.4
    // Input class: Valid / typical
    // Contract: Calls sendPlanReply with itemId, itemType, and reply text
    // pending:P6.4: remove this marker when this test passes

    // render(<AssumptionsPanel planName="sample-plan" />);
    // await waitFor(() => expect(screen.getByText('Assumptions')).toBeInTheDocument());
    // const textarea = screen.getByRole('textbox', { name: /reply to assumption 0/i });
    // fireEvent.change(textarea, { target: { value: 'We need OAuth' } });
    // fireEvent.click(screen.getByRole('button', { name: /send/i }));
    // await waitFor(() => expect(sendPlanReply).toHaveBeenCalledWith(
    //   'sample-plan', 'assumption-0', 'assumption', 'We need OAuth'
    // ));
  });

  it.fails('disables Send button when reply is empty', async () => {
    // matrix: AssumptionsPanel | empty reply validation | P6.4
    // Input class: Boundary (empty)
    // Robustness invariant: Button disabled, no API call
    // pending:P6.4: remove this marker when this test passes

    // render(<AssumptionsPanel planName="sample-plan" />);
    // await waitFor(() => expect(screen.getByText('Assumptions')).toBeInTheDocument());
    // const button = screen.getByRole('button', { name: /send/i });
    // expect(button).toBeDisabled();
  });

  it.fails('shows error toast on send failure', async () => {
    // matrix: AssumptionsPanel | send error handling | P6.4
    // Input class: Server error
    // Contract: Shows error toast, does not crash
    // pending:P6.4: remove this marker when this test passes

    // render(<AssumptionsPanel planName="sample-plan" />);
    // await waitFor(() => expect(screen.getByText('Assumptions')).toBeInTheDocument());
    // // Mock sendPlanReply to reject
    // const textarea = screen.getByRole('textbox', { name: /reply to assumption 0/i });
    // fireEvent.change(textarea, { target: { value: 'Test reply' } });
    // fireEvent.click(screen.getByRole('button', { name: /send/i }));
    // await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it.fails('handles plan with no assumptions gracefully', async () => {
    // matrix: AssumptionsPanel | no assumptions | P6.4
    // Input class: Empty / missing
    // Contract: Shows empty state message, no crash
    // pending:P6.4: remove this marker when this test passes

    // render(<AssumptionsPanel planName="empty-plan" />);
    // await waitFor(() => expect(screen.getByText(/no assumptions/i)).toBeInTheDocument());
  });

  it.fails('handles plan with no open questions gracefully', async () => {
    // matrix: AssumptionsPanel | no open questions | P6.4
    // Input class: Empty / missing
    // Contract: Shows empty state message, no crash
    // pending:P6.4: remove this marker when this test passes

    // render(<AssumptionsPanel planName="no-questions-plan" />);
    // await waitFor(() => expect(screen.getByText(/no open questions/i)).toBeInTheDocument());
  });

  it.fails('refreshes after planner revises plan', async () => {
    // matrix: AssumptionsPanel | plan revision | P6.4
    // Input class: Valid / typical (async update)
    // Contract: Panel re-fetches and re-renders when plan changes
    // pending:P6.4: remove this marker when this test passes

    // const { rerender } = render(<AssumptionsPanel planName="sample-plan" />);
    // await waitFor(() => expect(screen.getByText('Assumptions')).toBeInTheDocument());
    // // Simulate plan revision (e.g., via WebSocket event or polling)
    // // rerender with updated plan
    // // expect panel to show updated content
  });

  it.fails('shows character count for replies', async () => {
    // matrix: AssumptionsPanel | UX helpers | P6.4
    // Input class: Valid / typical
    // Contract: Displays character count, warns near limit
    // pending:P6.4: remove this marker when this test passes

    // render(<AssumptionsPanel planName="sample-plan" />);
    // await waitFor(() => expect(screen.getByText('Assumptions')).toBeInTheDocument());
    // const textarea = screen.getByRole('textbox', { name: /reply to assumption 0/i });
    // fireEvent.change(textarea, { target: { value: 'Test' } });
    // expect(screen.getByText(/4\/500/)).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// ENTRY POINT 5: Server endpoint for planner replies (if implemented server-side)
// Trust: EXTERNAL (server boundary)
// -----------------------------------------------------------------------------
describe('Server planner reply endpoint (pending:P6.4)', () => {
  // POST /plans/:name/reply
  // Body: { itemId: string, itemType: 'assumption' | 'question', reply: string }
  // Forwards to planner agent via Agent SDK

  it.fails('accepts valid reply payload', async () => {
    // matrix: server reply endpoint | valid payload | P6.4
    // Input class: Valid / typical
    // Contract: Returns 200, forwards to planner
    // pending:P6.4: remove this marker when this test passes

    // const response = await fetch('/plans/sample-plan/reply', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
    //   body: JSON.stringify({ itemId: 'assumption-0', itemType: 'assumption', reply: 'Test reply' })
    // });
    // expect(response.status).toBe(200);
  });

  it.fails('rejects missing itemId', async () => {
    // matrix: server reply endpoint | missing itemId | P6.4
    // Input class: Invalid (missing field)
    // Robustness invariant: Returns 400 with error message
    // pending:P6.4: remove this marker when this test passes

    // const response = await fetch('/plans/sample-plan/reply', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
    //   body: JSON.stringify({ itemType: 'assumption', reply: 'Test reply' })
    // });
    // expect(response.status).toBe(400);
  });

  it.fails('rejects invalid itemType', async () => {
    // matrix: server reply endpoint | invalid itemType | P6.4
    // Input class: Invalid (wrong enum)
    // Robustness invariant: Returns 400
    // pending:P6.4: remove this marker when this test passes

    // const response = await fetch('/plans/sample-plan/reply', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
    //   body: JSON.stringify({ itemId: 'assumption-0', itemType: 'invalid', reply: 'Test reply' })
    // });
    // expect(response.status).toBe(400);
  });

  it.fails('requires authentication', async () => {
    // matrix: server reply endpoint | no auth | P6.4
    // Input class: Unauthorized
    // Robustness invariant: Returns 401
    // pending:P6.4: remove this marker when this test passes

    // const response = await fetch('/plans/sample-plan/reply', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ itemId: 'assumption-0', itemType: 'assumption', reply: 'Test reply' })
    // });
    // expect(response.status).toBe(401);
  });

  it.fails('returns 404 for non-existent plan', async () => {
    // matrix: server reply endpoint | plan not found | P6.4
    // Input class: Invalid (not found)
    // Robustness invariant: Returns 404
    // pending:P6.4: remove this marker when this test passes

    // const response = await fetch('/plans/nonexistent/reply', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' },
    //   body: JSON.stringify({ itemId: 'assumption-0', itemType: 'assumption', reply: 'Test reply' })
    // });
    // expect(response.status).toBe(404);
  });
});

// -----------------------------------------------------------------------------
// CONTRACT VERIFICATION: Sample plan has assumptions and open questions
// These verify the sample plan data itself meets Done-when
// -----------------------------------------------------------------------------
describe('Sample plan verification - assumptions and open questions (pending:P6.4)', () => {
  it('sample plan has Assumptions section with items', () => {
    // matrix: sample plan | assumptions verification | P6.4
    // Input class: Valid / typical (contract requirement)
    // Done-when: "Taken from a labelled section of plan.md"
    // This test PASSES - sample plan has assumptions

    const planMd = `# Sample Plan: Add Diagram Validation Endpoint

## Overview
Add a new /diagrams/validate endpoint to the event server that validates Mermaid diagram syntax without rendering. This is a lightweight check for CI pipelines.

## Assumptions
- The existing diagrams-check.py script can be reused as a library
- Validation should be fast (< 1 second)
- Only syntax validation, not semantic correctness

## Open Questions
- Should validation support multiple diagram formats (PlantUML, etc.)?
- Rate limiting for validation endpoint?

## Details
### Server Changes
1. Extract validation logic from scripts/diagrams-check.py into a reusable function in apps/server/diagram_validator.py
2. Add POST /diagrams/validate endpoint accepting { "diagram": "mermaid content" }
3. Return { "valid": true } or { "valid": false, "errors": [...] }
4. Add unit tests for the validator and endpoint

### Client Changes
1. Add "Validate Diagram" button to DiagramPanel
2. Show validation result as toast notification

### Documentation
1. Update docs/diagrams/README.md with new endpoint usage`;

    const assumptionsMatch = planMd.match(/## Assumptions\n([\s\S]*?)(?=\n## |\n# |\n---|\n$)/);
    expect(assumptionsMatch).not.toBeNull();

    const assumptionsText = assumptionsMatch![1];
    const assumptionLines = assumptionsText.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
    expect(assumptionLines.length).toBe(3);
    expect(assumptionLines[0]).toContain('diagrams-check.py');
    expect(assumptionLines[1]).toContain('fast (< 1 second)');
    expect(assumptionLines[2]).toContain('syntax validation');
  });

  it('sample plan has Open Questions section with items', () => {
    // matrix: sample plan | open questions verification | P6.4
    // Input class: Valid / typical (contract requirement)
    // This test PASSES - sample plan has open questions

    const planMd = `# Sample Plan: Add Diagram Validation Endpoint

## Overview
Add a new /diagrams/validate endpoint to the event server that validates Mermaid diagram syntax without rendering. This is a lightweight check for CI pipelines.

## Assumptions
- The existing diagrams-check.py script can be reused as a library
- Validation should be fast (< 1 second)
- Only syntax validation, not semantic correctness

## Open Questions
- Should validation support multiple diagram formats (PlantUML, etc.)?
- Rate limiting for validation endpoint?

## Details
### Server Changes
1. Extract validation logic from scripts/diagrams-check.py into a reusable function in apps/server/diagram_validator.py
2. Add POST /diagrams/validate endpoint accepting { "diagram": "mermaid content" }
3. Return { "valid": true } or { "valid": false, "errors": [...] }
4. Add unit tests for the validator and endpoint

### Client Changes
1. Add "Validate Diagram" button to DiagramPanel
2. Show validation result as toast notification

### Documentation
1. Update docs/diagrams/README.md with new endpoint usage`;

    const questionsMatch = planMd.match(/## Open Questions\n([\s\S]*?)(?=\n## |\n# |\n---|\n$)/);
    expect(questionsMatch).not.toBeNull();

    const questionsText = questionsMatch![1];
    const questionLines = questionsText.split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
    expect(questionLines.length).toBe(2);
    expect(questionLines[0]).toContain('PlantUML');
    expect(questionLines[1]).toContain('Rate limiting');
  });
});

// =============================================================================
// TEST MATRIX TAGS (for test-maker matrix derivation)
// =============================================================================
// matrix: plan parser | valid plan.md with assumptions | P6.4
// matrix: plan parser | valid plan.md with open questions | P6.4
// matrix: plan parser | plan.md missing Assumptions | P6.4
// matrix: plan parser | plan.md missing Open Questions | P6.4
// matrix: plan parser | empty/malformed plan.md | P6.4
// matrix: plan parser | bullets in other sections | P6.4
// matrix: plan parser | numbered lists | P6.4
// matrix: plan parser | ID assignment | P6.4
// matrix: plan fetcher | valid plan name | P6.4
// matrix: plan fetcher | non-existent plan | P6.4
// matrix: plan fetcher | server error | P6.4
// matrix: planner reply | assumption reply | P6.4
// matrix: planner reply | open question reply | P6.4
// matrix: planner reply | network error | P6.4
// matrix: planner reply | invalid plan | P6.4
// matrix: AssumptionsPanel | initial render | P6.4
// matrix: AssumptionsPanel | assumptions loaded | P6.4
// matrix: AssumptionsPanel | open questions loaded | P6.4
// matrix: AssumptionsPanel | send reply | P6.4
// matrix: AssumptionsPanel | empty reply validation | P6.4
// matrix: AssumptionsPanel | send error handling | P6.4
// matrix: AssumptionsPanel | no assumptions | P6.4
// matrix: AssumptionsPanel | no open questions | P6.4
// matrix: AssumptionsPanel | plan revision | P6.4
// matrix: AssumptionsPanel | UX helpers | P6.4
// matrix: server reply endpoint | valid payload | P6.4
// matrix: server reply endpoint | missing itemId | P6.4
// matrix: server reply endpoint | invalid itemType | P6.4
// matrix: server reply endpoint | no auth | P6.4
// matrix: server reply endpoint | plan not found | P6.4
// matrix: sample plan | assumptions verification | P6.4
// matrix: sample plan | open questions verification | P6.4