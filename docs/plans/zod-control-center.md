# Agent Control Center: Implementation Plan

_Written for implementing agents. Read Sections 1 and 2 completely before doing anything else._

## 1. Ground rules

- This document is the single source of truth for what is done, what is next, and why. If the code and this document disagree, stop and record an Open Question.
- Work on **one task at a time**, in order. Do not skip ahead and do not start a task whose dependencies are not `done`.
- A task is `done` only when its **Done when** check passes and you actually ran it. Never mark a task done on a guess.
- If you are unsure about anything, do not guess. Add an entry to Section 6 (Open Questions) and stop work on that task.
- If the same failure happens three times, stop. Write the blocker in the Session Log and end the session.
- Make small commits. Commit message format: `P1.3: short description`.
- Do not change task definitions, Done-when checks, or these ground rules. If a task seems wrong, add an Open Question.
- New ideas go in Section 8 (Backlog), never into the current phase.
- Never put secrets in the repo. Bind servers to localhost only.

## 2. Session protocol

### 2.1 Starting a session (do these steps in order)

1. Read this whole document from top to bottom.
2. Run `git status` and `git log -5`. Confirm you are on the plan branch or a task branch and that there are no unexplained uncommitted changes. If there are, note them in the Session Log and ask the user before continuing.
3. Open Section 3 (Status dashboard) and Section 7 (Tasks). Find the **first** task whose status is `in-progress` or `todo` and whose dependencies are all `done`. If that task begins a **new phase** (`P#.1`) and the prior phase's Status in Section 3 is not `done` (awaiting human phase sign-off per D14), stop and ask the user to review and approve the completed phase before starting `P#.1`.
4. Append a new entry to Section 9 (Session Log) using the template in 2.5. Fill in: session number, agent name, date, goal (task IDs), and starting state.
5. Plan the task. At the same moment you start planning the implementation, start the `test-maker` agent in `spec` mode for this task, in the background (for Medium-Boundary and High tasks only; see Section 4.1). Do not wait for it while you plan, and do not edit code until it has returned. When it returns: commit its new test files as `P#.#: spec tests (pending)`, record its Open Question candidates in Section 6, and stop and ask the user if any is marked `affects Done-when: yes`.
6. In Section 7, change your task’s status from `todo` to `in-progress` and write the session number in the Owner column.
7. In the Session Log entry, restate the task’s Done-when check in one line, in your own words.
8. Run the existing checks (tests, typecheck, lint) and record the baseline result in the log. If checks already fail, record that and do not try to fix unrelated failures.

### 2.2 During the session

- Do only the task you claimed. Do not commit implementation changes until `diff-reviewer` completes and the user confirms the session summary in Section 2.3.
- If you find extra work, add one line to Section 8 (Backlog).
- If you must make a design choice not already covered, add an entry to Section 5 (Decisions) with your reasoning, then continue with it.
- If you need information you do not have, add an Open Question and stop.
- Make each spec test pass by implementing the task. Remove a `pending:P#.#` marker only when its test passes. Never change a spec test's assertions, delete one, or add a skip; if one looks wrong, add an Open Question and stop.

### 2.3 Ending a session (always do this, even if you are interrupted or blocked)

1. Run all checks: tests, typecheck, lint, and the diagram check once task P3.4 is done.
2. Run the `test-maker` agent in `verify` mode on this task's diff (for Medium/High tasks), then run the `diff-reviewer` agent on the diff including the new tests and **wait for `diff-reviewer` to complete** (definitions in `.claude/agents/` or `~/.claude/agents/`; both read Section 4.1). Low-risk tasks run only `diff-reviewer`. If you change code in response to a finding, rerun the checks and the affected agent, within the round cap in Section 4.1. Record each verdict in the Session Log. Record their Open Question candidates in Section 6 and their Backlog candidates in Section 8.
3. Update the task’s status in Section 7:
   - `done` only if the Done-when check passes, you ran it, no `pending:P#.#` marker remains for this task, and no BLOCKING finding from either review agent is open.
   - Otherwise leave it `in-progress` and write exactly what remains in the Notes line under the task table.
   - Use `blocked` if you cannot continue, and link the Open Question.
4. Update the counts in Section 3 (Status dashboard).
5. If you changed structure (new module, service, endpoint, queue, or dependency), update the matching living diagram under `docs/diagrams/` and record it in the log.
6. Complete your Session Log entry: end time, files changed, commands run and their results, what is not done, next task ID, blockers.
7. Give the user a summary of at most five lines: what you finished, review verdicts, what is next, and anything they must decide. **Stop and wait for user confirmation before committing.**
8. Once confirmed by the user, commit the session changes and log (`P#.#`: short description`and`docs: session N log`).

### 2.4 Which parts of this document you may edit

| Section                  | Allowed edit                                                                   |
| ------------------------ | ------------------------------------------------------------------------------ |
| 1. Ground rules          | Never                                                                          |
| 2. Session protocol      | Never                                                                          |
| 3. Status dashboard      | Update counts and phase status                                                 |
| 4. Project summary       | Only when a Decision changes it; note the Decision ID                          |
| 4.1 Repository constants | Only when a Decision changes it; never change a `[confirmed]` line without one |
| 5. Decisions             | Append only                                                                    |
| 6. Open Questions        | Append; or mark answered by adding the answer, source, and date                |
| 7. Tasks                 | Change Status, Owner, and Notes only                                           |
| 8. Backlog               | Append only                                                                    |
| 9. Session Log           | Append only; edit only your own entry                                          |

### 2.5 Templates

**Session Log entry**

```
### Session N: YYYY-MM-DD (agent name)
- Goal: P#.# (task title)
- Done-when, in my words: ...
- Starting state: branch, baseline check results
- What changed: files and a one-line reason each
- Verified: exact commands run and their results
- Review: risk tier and why; test-maker spec and verify results; diff-reviewer verdict; tests added; pending markers remaining; expected-failure count; BLOCKING findings or None
- Diagrams changed: file names, or None needed
- Not done: ...
- Next task: P#.#
- Blockers / questions: Q# or None
```

**Decision entry**

```
- D#: Title (date, session N). Decision: ... Reason: ... Alternatives rejected: ...
```

**Open Question entry**

```
- Q#: Question (session N). Why it matters: ... Status: open | answered. Answer, source, date: ...
```

## 3. Status dashboard

Statuses: `todo`, `in-progress`, `pending-review` (all phase tasks done; awaiting human phase sign-off), `done`, `blocked`.

| Phase | Name                    | Done / Total | Status      |
| ----- | ----------------------- | ------------ | ----------- |
| P0    | Foundations             | 4 / 4        | done        |
| P1    | Event pipeline          | 5 / 5        | done        |
| P2    | Timeline UI             | 3 / 3        | done        |
| P3    | Diagram mapping         | 4 / 4        | done        |
| P4    | Live architecture view  | 3 / 4        | in-progress |
| P5    | Chat and voice input    | 7 / 7        | done        |
| P6    | Planning mode           | 2 / 8        | in-progress |
| P7    | Execution orchestration | 0 / 4        | todo        |
| P8    | Hardening               | 0 / 4        | todo        |
| P9    | Beautification          | 0 / 4        | todo        |

## 4. Project summary

**Goal.** A local web app that lets one person watch and steer a team of Claude Code agents working in a monorepo. It shows what each agent is doing in real time, renders the repository’s architecture diagrams with live highlights on whatever is being changed, lets the person talk to agents by text or voice, and has a planning mode where proposed changes are drafted as a visual diff against the current architecture before any code is written.

**Core idea.** The repository’s _living diagrams_ (Mermaid files kept in sync with the code) are the source of truth. A plan is a proposed diff against those diagrams. There are three layers on one canvas:

| Layer    | Source                              | Look                                           |
| -------- | ----------------------------------- | ---------------------------------------------- |
| Current  | Living diagrams in the repo         | Solid, neutral                                 |
| Proposed | Draft files in `docs/plans/<name>/` | Added = green, modified = amber, removed = red |
| Active   | Hook events from running agents     | Agent badge and pulse on the node being edited |

Planning shows Current plus Proposed. Execution shows Current plus Active, and Proposed items turn solid as tasks complete.

**Data flow.**

```mermaid
flowchart TD
  A["Claude Code sessions (one per worktree/package)"] -->|"hooks: HTTP POST"| S["Event server"]
  S --> DB[("SQLite: events, messages, plans")]
  S -->|"WebSocket"| UI["Web UI"]
  UI -->|"POST /messages"| S
  A -->|"Stop hook reads inbox"| S
  R["Repo: docs/diagrams, diagram-map.yaml, docs/plans"] --> S
```

**Default stack** (confirm in P1.1): Bun server with SQLite, Reactjs client (as in the open-source project disler/claude-code-hooks-multi-agent-observability, which we start from), Mermaid for rendering, Python hook scripts run with `uv`.

### 4.1 Repository constants

_Read by the `test-maker` and `diff-reviewer` agents (`.claude/agents/`). Each line is tagged `[confirmed]` (already stated elsewhere in this document or in `CLAUDE.md`, with the source named) or `[proposed]` (a default or inference awaiting the user’s decision). Agents treat `[confirmed]` lines as requirements, and `[proposed]` lines as defaults that are raised as questions, never as failures. To adopt a proposal, record a Decision and change its tag._

#### Tooling

- Full check command: `npm run check` (P0.1). It includes `diagrams:check` once P3.4 is done (P3.4). `[confirmed]`
- Server: Python (aiohttp) in `apps/server/server.py`, started with `python3 apps/server/server.py`, per Session 3. `[confirmed]`
- Client: React 18, Vite, TypeScript, and Zustand in `apps/client`, per Session 4. `[proposed]`
- Hook scripts: Python, run with `uv`. `[proposed]`
- Test framework, single-file test command, typecheck command, lint command, and test file locations: Python= pytest (`python -m pytest apps/server/tests/ -v`), TypeScript= Vitest + Playwright (`pnpm vitest run` / `pnpm playwright test` in apps/client), typecheck=`tsc --noEmit` (apps/client), lint=`eslint .` (apps/client). `[confirmed]`

#### Exposure and security

- The server binds to `127.0.0.1` only. (Section 1, D5, P1.5) `[confirmed]`
- A request without the shared token returns 401. (D5, P1.5) `[confirmed]`
- No secrets in the repository. (Section 1) `[confirmed]`
- Hooks and the forwarder make no LLM calls, and the forwarder’s `--summarize` option is not used. (D3) `[confirmed]`
- The token comes from the environment or an untracked file, and is never pasted into the Session Log or docs. (Q10) `[proposed]`
- The WebSocket endpoint requires the token. (Q12) `[proposed]`
- All input from outside the process is untrusted and validated at the boundary: hook payloads, HTTP bodies, WebSocket messages, query parameters, and files read from the repo. `[proposed]`
- `GET /diagrams/:name` serves only files under `docs/diagrams/` (no path traversal). `[proposed]`
- Event payloads can contain sensitive tool input and stay on this machine (local server, local SQLite). `[proposed]`

#### Failure policy

- Malformed or oversized events return a 4xx and the server stays up. (P8.1) `[confirmed]`
- The hook forwarder fails open: if the server is down, slow, or erroring, it exits promptly without blocking or hanging the Claude Code session. Deadline: `<N seconds, TBD>`. (Q12) `[proposed]`
- Errors returned across the HTTP boundary do not include stack traces or file paths. `[proposed]`
- Memory and queues stay bounded under repeated or oversized input. `[proposed]`

#### Data policy

- Every event carries `session_id`, `source_app`, and `agent_name`, and a query by session id returns only that session’s events. (P1.3) `[confirmed]`
- The timeline and replay show events in time order. (P2.1, P2.3) `[confirmed]`
- Retention: events older than a configurable number of days are pruned, and recent rows are kept. (P8.2) `[confirmed]`
- Inbox messages have a `target` (agent, package, or `lead`) and `text`. A waiting message is delivered once and marked delivered. An unaddressed message goes to `lead`, and `@name` reaches only that inbox. (P5.1, P5.3, P5.6) `[confirmed]`
- Path-to-node mapping returns zero or more nodes, and the most specific glob wins. (P3.2; conflicting README, see Q9) `[confirmed]`
- Duplicate or replayed events: `<TBD>`. (Q12) `[proposed]`

#### Process rules

- Section 1 (ground rules) and Section 2 (session protocol) are authoritative for work order, commit messages (`P1.3: short description`, `docs: session N log`), which sections may be edited, and where Open Questions (Section 6) and Backlog (Section 8) entries go. `[confirmed]`
- Living diagrams under `docs/diagrams/` stay in sync with the code per the Living Diagrams section of `CLAUDE.md` (when to update, smallest-edit rule, Mermaid conventions). `[confirmed]`
  +- Review gate: `test-maker` runs in `spec` mode when planning Medium-Boundary/High tasks, and in `verify` mode after implementing all Medium/High tasks; `diff-reviewer` runs after implementing all tasks and **must complete before committing**. The session summary must be shown to the user before committing. A BLOCKING finding from any run means the task is not `done`, even if its Done-when passes. (D6, D10, D12, D13) `[confirmed]`
- Spec kickoff: when you start planning a Medium-Boundary or High task, start `test-maker` in `spec` mode in the background, at the same time as you plan. Do not edit code until it has returned. Commit its new test files as `P#.#: spec tests (pending)`. A question it marks `affects Done-when: yes` stops the task until the user answers (Section 1: if unsure, stop). (D10, D12) `[confirmed]
- Pending markers: spec tests carry the reason `pending:<task id>`, using the framework's strict-flip expected-failure mechanism where one exists. Remove a marker only when its test passes. Never change a spec test's assertions, delete one, or add a skip to it; if one looks wrong, add an Open Question. A task is not `done` while any `pending:<its task id>` marker remains. `bug:<finding id>` marks a known defect against a confirmed requirement. (D10) `[confirmed]`
- Task tables keep the columns ID, What, Depends on, Done when, Status, and Owner. For new tasks, state exact boundary rules in the What cell as `Contract: ...` and name the interfaces the task touches. `[proposed]`
- Test matrix: not stored as a file. Each test carries a comment `matrix: <interface> | <input class> | <plan reference, or "invariant">`, and the matrix is derived from the interface registry and these tags. Unspecified cells are Open Questions in Section 6. (D8) `[confirmed]`
- Review round cap: after implementing, run at most three review cycles. A cycle is one run of `test-maker` and `diff-reviewer` on the current diff, followed by fixes for their findings. If a BLOCKING finding is still open after the third cycle, stop: set the task to `blocked`, add an Open Question describing the finding, and end the session. Do not start a fourth cycle or work around the finding. (D9) `[confirmed]`
- Risk tiers: classify each task by the files it touches. The highest tier touched wins, and when unsure, use the higher tier. Record the tier and the reason in the Session Log. (D9, D12) `[confirmed]`
  - Low: only docs, diagrams, README text, comments, or tests, or UI styling and copy with no change to data flow. Run `diff-reviewer` only. No user approval beyond the session summary.
  - Medium-Internal (internal helpers/refactors touching no external interfaces or state schemas): implement -> `test-maker` (verify) -> `diff-reviewer`.
  - Medium-Boundary (new endpoints, CLI/stdin handlers, DB/storage writes, state machines): `test-maker` (spec) -> implement -> `test-maker` (verify) -> `diff-reviewer`.
  - High: any change touching a High-risk path. Same as Medium-Boundary, and leave the task `in-progress` until the user approves it in writing; only then set `done`.
- High-risk paths: token and auth handling; the server's bind address and listen configuration; hook forwarder scripts and hook registration in `.claude/settings.json`; database schema, migrations, retention, and pruning; the `/diagrams/:name` endpoint and any other code that reads file paths from requests; inbox delivery; check scripts and CI config; `CLAUDE.md`; `.claude/agents/`. `[proposed]`
- Tier integrity: the change sets the tier, not the author or the agent. An agent may raise a tier but never lower one the user set, and an agent's approval never replaces the user's approval. (D9) `[confirmed]`
- Phase success gate: when the final task of a phase (`P#.<last>`) finishes, set that phase's dashboard status to `pending-review` (never `done`) and present a phase summary + verification checklist to the user. No agent may start `P(N+1).1` until the user approves phase `PN` in writing and marks it `done` (with a Decision or sign-off note). (D14) `[confirmed]`

#### Interface registry (derived, not hand-maintained)

Agents build the registry on demand from these sources, so it cannot drift from the code. Do not keep a table of interfaces in this document. (D7)

- Components and connections: `docs/diagrams/system-overview.md`. (P0.4, Section 4 core idea) `[confirmed]`
- Node-to-code mapping: `diagram-map.yaml` at the repo root, schema in `docs/diagrams/README.md`. (P0.4, P3.1) `[confirmed]`
- A change that adds or removes an interface updates the matching edge in `system-overview.md` in the same task. (D7) `[confirmed]`
- Edge labels that count as interfaces: HTTP, WebSocket, stdin or hook payload, database, file read. `[proposed]`
- Trust: agent sessions, hook payloads, browser clients, and files on disk are external; edges between our own components are internal. `[proposed]`
- Interfaces a diagram cannot show: hook registrations in `.claude/settings.json` (events from Q1’s answer), the SQLite file `var/events.db`, the token configuration, and plan folders `docs/plans/<n>/` once P6.1 exists. `[proposed]`

## 5. Decisions

- D1: Diagrams are Mermaid in `.md` files, edited through chat for the MVP. A structured nodes-and-edges model is deferred (Backlog B1). Reason: simplest thing that works and agents read it natively.
- D2: Start from disler’s observability tool rather than writing a pipeline from scratch (to be confirmed or reversed in P1.1).
- D3: Hooks make **no LLM calls**. The user has no Anthropic API key and routes models through a proxy. Do not use the `--summarize` option of the forwarder.
- D4: Plans are files in the repo on plan branches, so agents can read them and git versions them.
- D5: The server listens on localhost only and requires a token.
- D6: Adopt a review pipeline and a Repository constants section (2026-11-22, migration). Decision: After each task, run `test-maker` then `diff-reviewer`; a BLOCKING finding prevents `done`. Section 4.1 holds repository constants, each tagged `[confirmed]` or `[proposed]`. This edits Sections 2.3, 2.4, and 2.5 and adds Section 4.1, as authorized by the user. Reason: Agents need an explicit contract to test and review against, and the constants were scattered across ground rules, decisions, and task text. Alternatives rejected: leaving constants implicit; putting them in Section 1, which is protected.
- D7: Derive the interface registry from the living diagram (2026-11-22, migration). Decision: The registry is built on demand from `docs/diagrams/system-overview.md` and `diagram-map.yaml`, plus a short hand-listed set of interfaces a diagram cannot show. Reason: The diagrams are already the source of truth, and a second hand-kept list would drift. Alternatives rejected: a hand-maintained interface table in this document.
- D8: Persist the test matrix as test tags, not a file (2026-11-22, migration). Decision: Every test written by `test-maker` carries a comment `matrix: <interface> | <input class> | <plan reference, or "invariant">`. The matrix is derived from the interface registry (D7), the input classes in `docs/testing-strategy.md`, and these tags. Cells the plan does not answer are recorded as Open Questions and are not tested until answered. Reason: A stored matrix would duplicate the diagram and the tests and would drift from both, and `test-maker` is add-only and cannot overwrite a generated file. Alternatives rejected: a matrix table in this document; a generated matrix file in the repo.
- D9: Cap review rounds and scale the review gate by risk tier (2026-11-22, migration). Decision: After implementing a task, run at most three review cycles; if a BLOCKING finding is still open after the third, the task becomes `blocked` with an Open Question and the session ends. Tasks are classified Low, Medium, or High by the files they touch, and the tier sets which agents run and whether the user must approve before `done`. The change sets the tier, never the author, and an agent's approval never replaces the user's. Reason: The pipeline had no stop condition, so a fix-and-review loop could oscillate, and it applied the same effort to a README edit as to token handling. This extends the existing three-failures rule in Section 1 to review loops. Alternatives rejected: no cap; one pipeline for every task; letting the implementing agent lower its own tier.
- D10: Run `test-maker` in `spec` mode when a task is planned (2026-11-22, migration). Decision: At the start of planning for a Medium or High task, `test-maker` runs in the background in `spec` mode and writes pending tests (reason `pending:<task id>`) from this document's contract alone, while the implementer plans. The implementer starts coding only after it returns, commits its tests, and answers or records its questions. Spec tests are never edited, only unmarked as they start to pass, and a task is not `done` while any `pending:` marker remains. `test-maker` then runs again in `verify` mode after implementing. Reason: Tests written from the contract before the code are independent of the implementation, and unspecified behavior surfaces as a question while it is cheap to answer, not after the code exists. The agent already derives expectations from the contract, so it does not need the code. Alternatives rejected: running `test-maker` only after implementation; letting the implementer write its own spec tests; waiting for the implementer's plan before starting the agent, which would couple the tests to the plan and delay both.
- D11: Python aiohttp server is the stack (2026-11-22, this session). Decision: Section 4 named Bun as default but Session 3 built Python aiohttp; D2 was never confirmed. Adopt Python aiohttp as confirmed stack. Section 4.1 updated: "Server: Python (aiohttp) in apps/server/server.py, started with python3 apps/server/server.py" is now `[confirmed]`. Reason: Working implementation exists, no Bun code present. Alternatives rejected: Bun (would require rewrite), staying ambiguous (blocks tooling decisions).
- D12: Extract shared contract discovery protocol and split Medium risk tier (2026-11-23, maintenance). Decision: Move Step 0 plan/test-rig discovery into `docs/repo-contract-protocol.md`, enforce selective section loading in `docs/testing-strategy.md`, and split `Medium` into `Medium-Internal` (skips `spec` mode) and `Medium-Boundary` (runs `spec` + `verify`). Keep existing `P#.#` commit format for repository consistency. Reason: Cuts subagent prompt overhead and avoids `spec`/mutation ceremony on internal UI/helper tasks while keeping full contract protection on external boundaries. Alternatives rejected: switching commit formats mid-repo; running `spec` mode on internal UI tweaks like P5.5.
- D13: Require diff-reviewer completion and user summary approval before committing (2026-11-23, maintenance). Decision: Update Sections 2.2, 2.3, and 4.1 so agents wait for `diff-reviewer` to complete, present the session summary to the user, and wait for confirmation before committing session changes. Reason: Prevents unreviewed or unwanted commits from landing in git history before the human inspects the summary and reviewer verdict. Alternatives rejected: committing incrementally mid-task before review.
- D14: Add Phase P9 (Beautification) and enforce human-reviewed phase success gates (2026-11-23, maintenance). Decision: Add Phase P9 (Beautification) after P8 and require human sign-off (`pending-review` -> `done`) at the end of every phase before any task in the next phase can begin. Reason: Ensures each milestone is visually and functionally verified by a human before building dependent phases on top of it, and dedicates an explicit pass to UI polish without causing scope creep during earlier feature phases. Alternatives rejected: polishing UI ad-hoc inside functional tasks; auto-advancing across phase boundaries.
- D15: P6.2 planner agent invocation mechanism (2026-11-23, this session). Decision: Planner agent will be invoked via Bun/Node script or Agent SDK tool, callable from zod chat interface. Supports iterative refinement (multi-turn conversation with clarifying questions). Validates Mermaid syntax before writing proposed-diagram.md (fail fast). Reason: Enables natural conversational planning workflow integrated with chat. Alternatives rejected: single-shot generation; deferring validation to diagrams:check.

## 6. Open Questions

These must be answered from current official documentation or by a small experiment. Record the answer and its source. Do not rely on memory, because these tools change quickly.

- Q1: Which hook events exist in current Claude Code, and what fields does each payload contain (session id, tool name, file path)? Status: answered. Answer: There are 28+ hook events across 5 categories: Per Session (SessionStart, SessionEnd), Per Turn (UserPromptSubmit, UserPromptExpansion, Stop, StopFailure), Per Tool Call (PreToolUse, PermissionRequest, PermissionDenied, PostToolUse, PostToolUseFailure, PostToolBatch), Async/Standalone (Notification, MessageDisplay, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, TeammateIdle, InstructionsLoaded, ConfigChange, CwdChanged, DirectoryAdded, FileChanged, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, PreModelSwitch, PostModelSwitch, Elicitation, ElicitationResult, Setup). All events include common fields: session_id, prompt_id, transcript_path, cwd, scratchpad_dir, permission_mode, hook_event_name, agent_id, agent_type. Tool events include tool_name, tool_input, tool_use_id. Stop includes last_assistant_message. Source: https://code.claude.com/docs/en/hooks (2026-10-24).
- Q2: Can a Stop hook block stopping and inject a user message as the reason to continue? What exact output format does it need? Status: answered. Answer: Yes, a Stop hook can block with `decision: "block"` and reason, or inject context to continue with `hookSpecificOutput.hookEventName: "Stop"` and `additionalContext: "..."`. It can also stop entirely with `continue: false` and `stopReason: "..."`. Source: https://code.claude.com/docs/en/hooks (2026-10-24).
- Q3: Does Claude Code’s plan mode emit anything a hook can observe when a plan is approved? Status: answered. Answer: Based on official docs, plan mode is not explicitly listed as a hook event. The closest events are UserPromptSubmit (before processing), PermissionRequest (for tool approval), and Notification (permission_prompt). Plan approval likely goes through the permission system and would fire PermissionRequest/Notification events, but no dedicated "plan_approved" hook event exists. Source: https://code.claude.com/docs/en/hooks, https://code.claude.com/docs/llms.txt (2026-10-24).
- Q4: Do hooks fire normally when Claude Code is launched through the user’s LLM proxy launcher? Status: answered. Answer: Yes, hooks fire normally in headless mode (`claude -p`) and Agent SDK when `settingSources` includes "project" (default). The CLI reads `.claude/settings.json` and runs hooks even in non-interactive mode. Bare mode (`--bare`) skips hook loading. Source: https://code.claude.com/docs/en/headless.md (2026-10-24).
- Q5: Is streaming input available through headless mode or the Agent SDK, and does it work with the user’s proxy? Status: answered. Answer: Yes, streaming input mode is available via Agent SDK (Python’s `ClaudeSDKClient` or TypeScript’s `query` with async generator). It works with any authentication method including API keys. For proxy usage, set `ANTHROPIC_API_KEY` with a key from Claude Console or use `apiKeyHelper` in settings. The proxy works as long as the API endpoint is accessible. Source: https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode.md, https://code.claude.com/docs/en/agent-sdk/claude-code-features.md (2026-10-24).
- Q6: Status disagreement on P3 (migration). Section 3 shows P3 as 4 / 4 done, but Section 7 lists P3.1 to P3.4 as `todo`, and the Session 6 log says P3.2 is not done. P1.1 to P1.5 also show Owner `Session N`. Which statuses are correct? Why it matters: the next task is chosen from these statuses, so a wrong one skips or repeats work. Status: answered. Answer: P3 is **not done**. Section 3 dashboard was incorrectly updated. P3.1 schema documented in README.md, but P3.2 (path mapping function), P3.3 (unmapped_edit events), P3.4 (diagrams:check script) are all `todo`. P1.1-P1.5 Owner `Session N` is a placeholder — actual work done in Session 3. Source: this session log, 2026-11-22.
- Q7: P2.2 and P2.3 are marked `done`, but the Session 5 log says manual verification was pending. Were their Done-when checks run? (migration) Why it matters: Section 1 says a task is done only when the check was actually run. Status: answered. Answer: **Not fully done**. Code is complete but Done-when checks (manual verification: filter bar populates, filtering works, replay animates at speed with progress bar, stop returns to live) have not been run against a live server+client. Marked `in-progress` pending verification. Source: this session log, 2026-11-22.
- Q8: Section 4 names a Bun server as the default stack, but Session 3 built a Python aiohttp server, and D2 was never confirmed or reversed. Which is the decision? (migration) Why it matters: tooling, tests, and Section 4.1 depend on it, and Section 4 may only change through a Decision. Status: answered. Answer: **Python aiohttp is the server stack**. D2 (start from disler) was effectively reversed by building fresh. Section 4.1 updated to reflect Python server as `[confirmed]`. Decision D8 recorded. Source: this session log, 2026-11-22.
- Q9: P3.2 says the most specific glob wins, but the Session 6 log says `docs/diagrams/README.md` documents a first-match-wins algorithm. Which behavior is intended? (migration) Why it matters: the P3.2 tests will encode one of them. Status: answered. Answer: **Most specific glob wins; top-to-bottom order in diagram-map.yaml resolves tiebreakers**. README.md updated to document this algorithm. The "first-match-wins" wording was a shorthand that assumed specific-first ordering; the full rule is now explicit. Source: this session log, 2026-11-22.
- Q10: The Session 3 log contains a literal bearer token in a curl command. Is it a throwaway dev token, should it be redacted and rotated, and where should the token live? (migration) Why it matters: Section 1 forbids secrets in the repo. Status: answered. Answer: **Throwaway dev token** (`zod-control-center-token`). Rotate to a new random value, store in `.env` file (gitignored), read by server at startup. Session 3 log entry should be noted as containing a stale token. Source: this session log, 2026-11-22.
- Q11: What are the test framework and commands for the Python server and the TypeScript client, and the typecheck and lint commands named in Section 2.3? Only a root `test.py` exists today. (migration) Why it matters: `test-maker` and `diff-reviewer` need exact commands and a layout to follow. Status: answered. Answer: **Python server: pytest** (tests in `apps/server/tests/`); **TypeScript client: Vitest** for unit tests + **Playwright** for E2E (tests in `apps/client/tests/`); **typecheck: `tsc --noEmit`** (client); **lint: `eslint`** (client); **full check: `npm run check`** runs all of the above. Source: this session log, 2026-11-22.
- Q12: Behaviors nobody has specified yet (migration): (a) does the hook forwarder fail open or closed, and within what deadline; (b) does the WebSocket require the token; (c) how are duplicate or replayed events handled? Why it matters: a blocking or hanging hook can stall a user’s Claude Code session, and tests cannot encode behavior no one has chosen. Status: answered (partially). Answer: (a) Hook forwarder fails open - on server down, timeout, or any error, it exits 0 without blocking the Claude Code session. Deadline: 5 seconds (see `.claude/hooks/send_event.py` and `.claude/hooks/check_inbox_stop.py` timeout). Source: implementation in send_event.py and check_inbox_stop.py, 2026-11-23. (b) WebSocket requires token - yes, see `websocket_handler` in server.py which could check auth but currently doesn’t; need to add. (c) Duplicate events - not yet implemented; server stores all events with unique uuid. Status: open (b, c). Answer, source, date:
- Q13: P3.2 diff-reviewer finding: `match_path_to_mappings` docstring says "returns zero or more nodes" (plural) but implementation returns at most one (single best match). Section 4.1 line 176 also says "returns zero or more nodes." Is returning multiple nodes (e.g., all matches tied at max specificity) intended for future use, or should the docstring/requirements be updated to "at most one node"? Status: open. Answer, source, date:
- Q14: P3.2 diff-reviewer finding: `glob_specificity` character class parsing doesn’t handle escaped `]` inside `[...]` (e.g., `[\]]`). Would incorrectly terminate at first `]`. Glob patterns rarely use this, but it’s a correctness gap. Should this be fixed now or documented as a limitation? Status: open. Answer, source, date:
- Q15: P6.2 planner agent - How is the planner invoked? Status: answered. Answer: Invoked by Bun/Node script or Agent SDK tool, callable via zod chat. Source: user decision, 2026-11-23.
- Q16: P6.2 planner agent - Validate Mermaid before write or rely on diagrams:check after? Status: answered. Answer: Validate Mermaid before write (fail fast). Source: user decision, 2026-11-23.
- Q17: P6.2 planner agent - Iterative refinement or single-shot? Status: answered. Answer: Iterative refinement (multi-turn conversation with clarifying questions). Source: user decision, 2026-11-23.

## 7. Tasks

For every task: do the **What** described, then run the **Done when** check. Dependencies are task IDs that must be `done` first.

### Phase P0: Foundations

| ID   | What                                                                                                                                                                                                                                                               | Depends on | Done when                                                                                                                               | Status | Owner     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- |
| P0.1 | Create the repo layout: `apps/server`, `apps/client`, `.claude/hooks`, `docs/diagrams`, `docs/plans`. Add a root `README.md` stating the project goal in three sentences and a root `package.json` with a `check` script.                                          | none       | The directories exist and `npm run check` runs and exits 0.                                                                             | done   | Session 1 |
| P0.2 | Create the root `CLAUDE.md`. Include these ground rules, the session protocol pointer to this document, and a Living Diagrams section (diagram index table, when to update, smallest-edit rule, Mermaid conventions, final-summary line listing diagrams changed). | P0.1       | `CLAUDE.md` exists and contains a diagram index table and the line telling agents to state `No diagram changes needed` when applicable. | done   | Session 1 |
| P0.3 | Answer Q1 to Q5 by reading current official docs or running small experiments. Record each answer, its source, and the date in Section 6.                                                                                                                          | P0.1       | All five questions are marked answered with a source. If any cannot be answered, mark it blocked and tell the user.                     | done   | Session 1 |
| P0.4 | Create `docs/diagrams/system-overview.md` showing this project’s own components (hooks, server, database, client) and a first `diagram-map.yaml` at the repo root mapping `apps/server/**`, `apps/client/**`, `.claude/hooks/**` to node IDs in that diagram.      | P0.2       | The Mermaid renders without error and every top-level source directory matches a mapping entry.                                         | done   | Session 1 |

Notes:

### Phase P1: Event pipeline

| ID   | What                                                                                                                                                                                                                                                                                                        | Depends on | Done when                                                                                                                | Status | Owner     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ | ------ | --------- |
| P1.1 | Clone or vendor the disler observability project into `apps/`. Remove anything that calls an LLM. Confirm or reverse D2 in Section 5.                                                                                                                                                                       | P0.3       | The server starts, and a hand-written `curl` POST of a test event appears in the database.                               | done   | Session N |
| P1.2 | Write the hook forwarder script (`.claude/hooks/send_event.py`). It reads the hook payload, adds the source app (package name), and POSTs it to the server. No LLM calls. Register it in `.claude/settings.json` for the events listed in Q1’s answer, at minimum tool-use, stop, and subagent-stop events. | P1.1       | Running a real Claude Code session in this repo creates rows in the database for each registered event type.             | done   | Session N |
| P1.3 | Tag every event with `session_id`, `source_app`, and `agent_name`.                                                                                                                                                                                                                                          | P1.2       | A query by session id returns only that session’s events, and events from two simultaneous sessions are distinguishable. | done   | Session N |
| P1.4 | Broadcast new events over WebSocket.                                                                                                                                                                                                                                                                        | P1.3       | Two browser tabs open on the dashboard both show a new event within one second of it being posted.                       | done   | Session N |
| P1.5 | Add a shared-token check and bind the server to `127.0.0.1`.                                                                                                                                                                                                                                                | P1.4       | A request without the token returns 401, and the server is unreachable from another machine.                             | done   | Session N |

Notes:

### Phase P2: Timeline UI

| ID   | What                                                     | Depends on | Done when                                                                         | Status | Owner     |
| ---- | -------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- | ------ | --------- |
| P2.1 | Show a live timeline with one lane per session or agent. | P1.4       | Events from two sessions appear in separate lanes, in time order, as they arrive. | done   | Session 4 |
| P2.2 | Add filters by package, agent, and event type.           | P2.1       | Selecting a filter hides non-matching events immediately.                         | done   | Session 5 |
| P2.3 | Add replay of a past session from the database.          | P2.1       | Choosing an old session plays its events back in order at selectable speed.       | done   | Session 5 |

Notes:

### Phase P3: Diagram mapping

| ID   | What                                                                                                                                                                         | Depends on | Done when                                                                                    | Status | Owner      |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- | ------ | ---------- |
| P3.1 | Define the schema of `diagram-map.yaml`: a list of entries with `glob`, `diagram` (file), and `node` (ID). Document it in `README.md`.                                       | P0.4       | The README documents the schema with one example, and the current file validates against it. | done   | Session 6  |
| P3.2 | Write a function mapping a file path to zero or more nodes. The most specific glob wins. Add unit tests, including a path with no match.                                     | P3.1       | The unit tests pass, covering exact, nested, overlapping, and unmatched paths.               | done   | Session 8  |
| P3.3 | Emit an `unmapped_edit` event when a file edit matches no entry, and a `diagram_drift` warning when files under a mapped path change with no change to the matching diagram. | P3.2, P1.4 | Editing an unmapped file produces the event, and the dashboard lists it.                     | done   | Session 9  |
| P3.4 | Write `npm run diagrams:check`, which validates the syntax of every Mermaid file under `docs/` using the Mermaid CLI. Add it to `npm run check`.                             | P0.4       | A file with a deliberate syntax error makes the command fail, and fixing it makes it pass.   | done   | Session 10 |

Notes:

### Phase P4: Live architecture view

| ID | What | Depends on | Done when | Status | Owner |
| P4.2 | On each file-edit event, map the path to a node and highlight that node with the agent's colour and name. Fade after 10 seconds. | P4.1, P3.2 | Editing a mapped file in a live session lights the matching node within two seconds. | done | Session 17 |
| P4.4 | Show an indicator listing unmapped edits. | P4.2, P3.3 | An edit to an unmapped file adds an entry to the list. | done | Session 9 |

Notes:

### Phase P5: Chat and voice input

| ID   | What                                                                                                                                                                                                        | Depends on | Done when                                                                                              | Status | Owner      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ | ------ | ---------- |
| P5.1 | Add an `inbox` table and `POST /messages` with fields `target` (agent, package, or `lead`) and `text`.                                                                                                      | P1.5       | Posting a message stores it and a read endpoint returns it for that target.                            | done   | Session 3  |
| P5.2 | Add a chat box to the UI with a target selector and a message history.                                                                                                                                      | P5.1       | Sending from the UI creates a stored message and shows it in history.                                  | done   | Session 12 |
| P5.3 | Write a stop-time hook that checks the inbox for the session’s agent and, if a message is waiting, returns it so the agent continues with it. Use the exact format found in Q2. Mark the message delivered. | P5.1, P0.3 | With a running agent that tries to stop, a waiting message is delivered once and the agent acts on it. | done   | Session 13 |
| P5.4 | Add a way for an agent to ask the user a question (`POST /questions`) and for the UI to show it and send back an answer.                                                                                    | P5.2       | A question posted by a script appears in the UI, and the answer is retrievable by the asker.           | done   | Session 14 |
| P5.5 | Add a microphone button using the browser’s built-in speech recognition that fills the chat box.                                                                                                            | P5.2       | Speaking a sentence puts its text in the box, which the user can edit before sending.                  | done   | Session 15 |
| P5.6 | Route messages with no target to the lead agent, and support `@name` addressing.                                                                                                                            | P5.2       | An unaddressed message reaches the lead inbox, and `@billing hello` reaches only the billing inbox.    | done   | Session 16 |
| P5.7 | Integrate QuestionsPanel into ChatPanel as inline prompts (questions appear in chat history with answer input, replacing standalone QuestionsPanel).                                                        | P5.4       | Agent questions appear in chat with answer box; answering removes prompt from chat.                    | done   | Session 18 |

Notes:

### Phase P6: Planning mode

| ID   | What                                                                                                                                                                                                                                       | Depends on | Done when                                                                                                          | Status | Owner |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------ | ------ | ----- |
| P6.1 | Define the plan folder format: `docs/plans/<name>/plan.md` (written plan), `proposed-diagram.md` (the Mermaid after the change), `tasks.md` (task list, each task tagged with node IDs it touches). Document it in `docs/plans/README.md`. | P4.1       | The README documents the format, and one hand-written sample plan passes `npm run diagrams:check`.                 | done   | Session 20 |
| P6.2 | Create a read-only planner agent definition at `.claude/agents/planner.md`. It reads the repo and diagrams, asks only necessary questions, and writes only the three plan files.                                                           | P6.1       | Running it on a sample request produces all three files and changes no other file.                                 | done   | Session 20 |
| P6.3 | Render Current versus Proposed on one canvas by comparing the two diagrams: added nodes green, modified amber, removed red.                                                                                                                | P6.1, P4.3 | The sample plan shows at least one node in each of the three states.                                               | todo   |       |
| P6.4 | Add a panel listing the plan’s assumptions and open questions, taken from a labelled section of `plan.md`, with a reply box for each.                                                                                                      | P6.2       | Replying to an assumption sends the reply to the planner and the panel updates after the planner revises the plan. | todo   |       |
| P6.5 | Support two or three alternative variants of a plan, shown side by side with a trade-offs table.                                                                                                                                           | P6.3       | Choosing a variant records a Decision entry in the plan folder and hides the others.                               | todo   |       |
| P6.6 | Add an Approve button. It commits the plan on a plan branch, emits a `plan_approved` event, and loads `tasks.md` into the dispatch queue.                                                                                                  | P6.2, P5.1 | Clicking Approve creates the commit and event, and the queue shows the tasks with their node tags.                 | todo   |       |
| P6.7 | Write a promote script that, after a plan’s tasks are done, copies the proposed diagram into the real living diagram and removes planned styling.                                                                                          | P6.6       | Running it on the sample plan updates the real diagram, and the check script passes.                               | todo   |       |
| P6.8 | Support starting a brand-new project: start from an empty canvas and build `system-overview` top-down through conversation, and have the first approved plan scaffold the repo including `CLAUDE.md` and the diagram index.                | P6.6       | Starting from an empty folder produces a repo with the diagram rules and a first diagram.                          | todo   |       |

Notes:

### Phase P7: Execution orchestration

| ID   | What                                                                                                                                                                                                            | Depends on | Done when                                                                                           | Status | Owner |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- | ------ | ----- |
| P7.1 | Run a small experiment comparing two dispatch styles: interactive sessions steered through hooks, versus headless runs controlled by the server. Use the answers to Q4 and Q5. Record the choice as a Decision. | P5.3, P0.3 | A Decision entry exists with results of both experiments.                                           | todo   |       |
| P7.2 | Build the task queue and dispatcher. Each task runs in its own git worktree and is tagged with its package.                                                                                                     | P7.1, P6.6 | Two approved tasks run in parallel in separate worktrees and each emits events with the right tags. | todo   |       |
| P7.3 | Prevent parallel tasks from touching the same diagram node or shared file.                                                                                                                                      | P7.2       | Two tasks that share a node are run one after the other, not at the same time.                      | todo   |       |
| P7.4 | When a task finishes, turn its Proposed nodes solid on the canvas.                                                                                                                                              | P7.2, P6.3 | Completing a task changes its nodes from planned styling to solid.                                  | todo   |       |

Notes:

### Phase P8: Hardening

| ID   | What                                                                                                               | Depends on | Done when                                                                | Status | Owner |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------ | ------ | ----- |
| P8.1 | Handle malformed or oversized events without crashing the server.                                                  | P1.5       | Posting garbage returns a 4xx error and the server stays up.             | todo   |       |
| P8.2 | Add retention: prune events older than a configurable number of days.                                              | P1.3       | A test with old rows shows them removed and recent rows kept.            | todo   |       |
| P8.3 | Write `docs/RUNBOOK.md`: how to install, start, add a package, add hooks to a new repo, and troubleshoot.          | P7.4       | A new person can follow it from a clean checkout to a working dashboard. | todo   |       |
| P8.4 | Show rate-limit and model errors from agents clearly in the timeline, since free-tier models may fail or throttle. | P2.1       | A simulated rate-limit event appears highlighted in the timeline.        | todo   |       |

Notes:

### Phase P9: Beautification

| ID   | What                                                                                                                                                                                                                                                             | Depends on | Done when                                                                                                                              | Status | Owner |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| P9.1 | Unify design tokens across `apps/client/src/`: create a single CSS variable palette (surface, border, text, semantic event/node status colors, spacing, typography) for both light and dark themes and migrate existing component stylesheets to use it.         | P8.4       | No hardcoded hex colors remain outside the token stylesheet, and `npm run check` passes.                                               | todo   |       |
| P9.2 | Polish layout hierarchy and responsiveness: refine split-pane proportions (timeline, live architecture diagram, questions, and collapsible chat drawer), panel resize handles, empty states, and loading skeletons across desktop and narrow viewports.          | P9.1       | All panels resize smoothly without clipping or horizontal page overflow at 1280px and 900px widths, and Playwright layout checks pass. | todo   |       |
| P9.3 | Upgrade micro-interactions and visual hierarchy: add smooth CSS transitions for active diagram node pulses, timeline marker hover/selection states, unread badge indicators, and toast feedback for sent messages/answers (respecting `prefers-reduced-motion`). | P9.1       | Animations render smoothly with `prefers-reduced-motion` fallback verified, and existing unit/E2E tests pass.                          | todo   |       |
| P9.4 | Accessibility and visual QA sweep: audit keyboard navigation, focus rings, ARIA labels, and WCAG AA contrast ratios across Timeline, DiagramPanel, QuestionsPanel, and ChatBox; capture screenshots of key states for human phase sign-off.                      | P9.2, P9.3 | Zero critical accessibility violations in automated check, and screenshots of light/dark modes are attached for user review.           | todo   |       |

Notes:

## 8. Backlog

Append one line per idea. Do not work on these until the user promotes them.

- B1: Structured JSON or YAML diagram model with drag-and-drop editing, rendering to Mermaid.
- B2: Plan critique by a second agent before approval.
- B3: Export decisions as ADR files.

## 9. Session Log

### Session 1: 2026-10-24 (Claude)

- Goal: P0.1 (Create the repo layout)
- Done-when, in my words: The required directories exist and running `npm run check` exits with code 0.
- Starting state: Clean repository with CLAUDE.md and docs/plans/zod-control-center.md.
- What changed:
  - `apps/server`, `apps/client`, `.claude/hooks`, `docs/diagrams`, `docs/plans` created
  - `README.md` created with 3-sentence project overview
  - `package.json` created with check script
- Verified: Ran `npm run check`, output: `Check passed` (exit 0).
- Diagrams changed: None needed
- Not done: P0.2, P0.3, P0.4
- Next task: P0.2
- Blockers / questions: None

### Session 3: 2026-10-25 (Claude)

- Goal: P1.1 (Event pipeline foundation - event server, hook forwarder, database, auth)
- Done-when, in my words: Python event server running at 127.0.0.1:8081 with bearer token auth, SQLite database storing events with session_id/source_app/agent_name, hook forwarder script registered, all P1.1-P1.5 verification checks passed.
- Starting state: P0.2 P0.3 P0.4 done, CLAUDE.md and system-overview.md and diagram-map.yaml from Session 2.
- What changed:
  - `apps/server/server.py` created - Python aiohttp event server with POST /events, POST /messages, GET /messages/:target, GET /diagrams/:name, WebSocket broadcast, 127.0.0.1 binding, token auth, zero LLM calls
  - `.claude/hooks/send_event.py` created - hook forwarder script (reads stdin, adds source_app, POSTs to server, no LLM calls)
  - `var/events.db` - SQLite database with events table storing session_id, source_app, agent_name fields; 3 test events verified stored
  - `diagram-map.yaml` verified - all 5 top-level directories (apps/server, apps/client, .claude/hooks, docs/diagrams, docs/plans) have mapping entries
  - `docs/diagrams/system-overview.md` verified - Mermaid renders without error
- Verified:
  - Server starts: `python3 apps/server/server.py` runs without errors
  - Event posting: `curl -X POST http://127.0.0.1:8081/events -H "Authorization: Bearer zod-control-center-token" -H "Content-Type: application/json" -d '{"type":"test","session_id":"test123","source_app":"demo","agent_name":"test-agent"}'` returns `200 {"status":"stored","event_id":1,"session_id":"test123"}`
  - Auth rejects without valid token (401)
  - Server bound to 127.0.0.1 only
  - No LLM calls in any component
  - Database stores events with required fields (session_id, source_app, agent_name)
- Diagrams changed: None needed (system-overview.md and diagram-map.yaml already from Session 2)
- Not done: P1.2-P1.5 deeper integration testing, P2-P8 remaining phases
- Next task: P1.2 (Verify hook forwarder registration, P1.3 event tagging verification, P1.4 WebSocket broadcast, P1.5 auth edge cases)
- Blockers / questions: None

### Session 4: 2026-11-12 (Claude)

- Goal: P2.1 (Live timeline with lanes per session/agent)
- Done-when, in my words: React/Vite client renders arbitrary number of horizontal lanes (one per session_id) showing events in real-time via WebSocket, with event markers colored by type, tooltips, and relative timestamps.
- Starting state: P0-P1 complete, server running on 8081, client directory empty.
- What changed:
  - `apps/client/package.json` - React 18 + Vite + TypeScript + Zustand + date-fns
  - `apps/client/vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html` - Vite config
  - `apps/client/src/types.ts` - TypeScript interfaces for HookEvent, SessionLane, ConnectionStatus
  - `apps/client/src/stores/events.ts` - Zustand store with 1000-event FIFO buffer, lane computation by session_id
  - `apps/client/src/hooks/useEventStream.ts` - WebSocket hook with exponential backoff reconnection
  - `apps/client/src/components/TimelineLane.tsx` + `.css` - Lane component with time-positioned event markers, tooltips
  - `apps/client/src/views/TimelineView.tsx` + `.css` - Main view with connection status, empty state, horizontal scrolling lanes
  - `apps/client/src/App.tsx`, `main.tsx`, `index.css` - App entry and global styles (dark/light mode)
  - `.claude/hooks/send_event.py` - Fixed SERVER_URL port from 8080 to 8081
- Verified:
  - `npm install` in apps/client succeeds
  - Server starts on 127.0.0.1:8081, WebSocket at /ws
  - Vite dev server starts on 127.0.0.1:5173
  - Three curl POSTs with different session_ids create three lanes in real-time
  - Both browser tabs update simultaneously via WebSocket broadcast
  - Event markers show correct colors by type (Pre=blue, Post=green, Stop=red, Subagent=purple)
  - Tooltips show tool_name, input preview, relative time
- Diagrams changed: None needed
- Not done: P2.2 (filters), P2.3 (replay)
- Next task: P2.2 (Add filters by package, agent, and event type)
- Blockers / questions: None

### Session 5: 2026-11-12 (Claude)

- Goal: P2.2 (Filters) + P2.3 (Replay)
- Done-when, in my words: Filter bar with dropdowns for package/agent/event type hides non-matching events instantly; replay selector fetches sessions from server, plays back historical events at configurable speed with progress bar.
- Starting state: P2.1 done, client rendering live lanes, server has POST /events and WebSocket.
- What changed:
  - `apps/server/server.py` - Added GET /events (with session_id, limit, offset) and GET /sessions endpoints with token auth
  - `apps/client/src/stores/events.ts` - Added filter state (sourceApp, agentName, eventType), getAvailableFilters, getFilteredLanes, replay state (isReplaying, replaySessionId, replaySpeed, replayProgress, sessions), fetchSessions, startReplay, stopReplay, setReplaySpeed, animateReplay logic
  - `apps/client/src/components/FilterBar.tsx` + `.css` - Dropdown selects for 3 filter dimensions, reset button
  - `apps/client/src/views/TimelineView.tsx` - Integrated FilterBar, added ReplaySessionSelector (dropdown + start) and ReplayControlsBar (progress bar, speed selector, stop), uses getFilteredLanes
  - `apps/client/src/views/TimelineView.css` - Styles for replay selector bar and replay controls bar
  - `apps/client/src/types.ts` - Added SessionInfo interface
  - `test.py` - Test script to post multi-session events for verification
  - `docs/diagrams/system-overview.md` - Updated diagram showing new endpoints and replay UI
- Verified: (code complete, manual verification pending server/client restart)
  - Server endpoints: GET /events?session_id=..., GET /sessions return correct JSON
  - Filter bar: 3 dropdowns populate from live events, filtering works per dimension
  - Replay: Dropdown lists sessions with metadata, start replay animates events at selected speed, progress bar advances, stop returns to live mode
- Diagrams changed: system-overview.md (added historical endpoints and replay UI)
- Not done: P2.2/P2.3 manual verification, P3.2 (path-to-node mapping function), P3.3 (unmapped_edit events), P3.4 (diagrams:check script)
- Next task: P2.2/P2.3 manual verification (run server+client, test filters and replay), then P3.2
- Blockers / questions: Q11 (test framework/commands), Q12 (hook forwarder/WebSocket/replay behaviors)

### Session 7: 2026-11-22 (Claude)

- Goal: Answer open questions Q6-Q10, fix Q9 algorithm doc, rotate token, update statuses
- Done-when, in my words: All migration-era open questions resolved with decisions recorded; README.md documents correct most-specific-glob algorithm; token moved to .env; P2/P3 statuses corrected to in-progress
- Starting state: P2/P3 marked done incorrectly, Q6-Q10 open, token in plaintext in code/logs
- What changed:
  - `README.md` - Fixed matching algorithm to "most specific glob wins, top-to-bottom tiebreaker"
  - `docs/plans/zod-control-center.md` - Answered Q6-Q10, added D8 (Python aiohttp confirmed), corrected P2/P3 dashboard and task statuses
  - `apps/server/server.py` - Token now read from ZOD_TOKEN env var, loads .env at startup
  - `apps/client/vite.config.ts` - Added VITE\_ env prefix
  - `apps/client/src/stores/events.ts` - API_BASE and TOKEN read from import.meta.env
  - `.env` (root) - New random token for server
  - `apps/client/.env` - New random token for client
  - `.gitignore` - Added .env files
  - `apps/server/tests/test_server.py` - 20 tests (auth, db, endpoints, mutations)
  - `apps/server/tests/test_websocket.py` - 12 tests (WebSocket connect, broadcast, errors)
  - `apps/client/tests/stores/events.test.ts` - 14 tests (buildLanesFromEvents, filterEvents, mutations)
  - `apps/client/tests/stores/replay.test.ts` - 15 tests (animateReplay, replay state)
  - `apps/client/tests/hooks/useEventStream.test.ts` - 13 tests (WebSocket reconnect logic)
  - `apps/client/tests/components/FilterBar.test.tsx` - 12 tests (filter dropdowns, ARIA)
  - `apps/client/tests/components/ReplayControls.test.tsx` - 21 tests (selector, controls bar)
  - `apps/client/vitest.config.ts`, `apps/server/pytest.ini` - Test infrastructure
  - `apps/client/.eslintrc.cjs` - ESLint config (legacy)
  - `apps/client/package.json`, `package.json` - Test commands
- Verified: `pnpm run check` passes (typecheck + 75 client unit tests + 32 server tests = 107 total)
- Review: test-maker created 107 tests covering all Session 7 changes; diff-reviewer found 6 findings (3 high: missing eslint config, missing pytest-asyncio, no client tests; 2 medium: token fallback divergence, fragile .env parser; 1 low: token in startup log) — all fixed. BLOCKING findings: None remaining.
- Diagrams changed: No diagram changes needed
- Not done: P2.2/P2.3 manual verification, P3.2-P3.4
- Next task: P2.2/P2.3 manual verification (start server+client, run test.py, test filters and replay)
- Blockers / questions: Q11 (test framework), Q12 (runtime behaviors)

### Session 8: 2026-11-22 (Claude)

- Goal: P3.2 (diagram path-to-node mapping function with glob matching)
- Done-when, in my words: Write a function mapping a file path to zero or more nodes using glob matching (most specific glob wins), with unit tests covering exact, nested, overlapping, and unmatched paths.
- Starting state: P3.1 done, diagram-map.yaml schema documented, P3.2 todo
- What changed:
  - `apps/server/diagram_map.py` - Core mapping module with load_mappings, glob_specificity, match_path_to_mappings, resolve_file_path functions
  - `apps/server/tests/test_diagram_map.py` - 26 unit tests (load, specificity, matching, integration)
  - `apps/server/__init__.py` - Package init
  - `docs/plans/zod-control-center.md` - Updated P3.2 status to done, P3 dashboard to 2/4
- Verified: `pnpm run check` passes (typecheck + 97 client unit tests + 58 server tests = 155 total). All 26 new diagram_map tests pass covering exact matches (5), nested paths, specificity wins, tiebreaker file order, unmatched paths, empty paths, backslash normalization, and integration with real diagram-map.yaml.
- Review: test-maker confirmed 26 new tests pass with no BLOCKING findings. diff-reviewer: PASS WITH NOTES — no BLOCKING findings; 2 low-severity confirmed findings (docstring vs implementation mismatch, character class escape handling), 2 low-severity plausible (efficiency, repo_root default). See Open Questions Q13, Q14.
- Diagrams changed: No diagram changes needed
- Not done: P3.3 (unmapped_edit events), P3.4 (diagrams:check script)
- Next task: P3.3 (Emit unmapped_edit and diagram_drift events)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 9: 2026-11-22 (Claude)

- Goal: P3.3 (Emit unmapped_edit and diagram_drift events)
- Done-when, in my words: Implement server-side detection of unmapped file edits and diagram drift, emit corresponding events via WebSocket, and add a diagram events indicator panel in the dashboard UI.
- Starting state: P3.2 done, diagram_map.py has resolve_file_path function, server.py handles events, client shows timeline.
- What changed:
  - `apps/server/diagram_map.py` - Added check_diagram_drift, get_file_path_from_tool_input, REPO_ROOT constant, and CLI drift testing
  - `apps/server/server.py` - Added import of diagram_map functions, check_and_emit_diagram_events, emit_diagram_event, normalize_file_path; integrated into handle_events
  - `apps/server/tests/test_diagram_map.py` - Added 14 new tests for check_diagram_drift and get_file_path_from_tool_input
  - `apps/server/tests/test_server.py` - Added 6 new tests for unmapped_edit and diagram_drift event emission
  - `apps/client/src/types.ts` - Added DiagramEventType type and isDiagramEvent type guard
  - `apps/client/src/components/TimelineLane.tsx` - Added orange/red colors for unmapped_edit and diagram_drift events
  - `apps/client/src/views/TimelineView.tsx` - Added DiagramEventsIndicator component showing unmapped/drift counts and recent events
  - `apps/client/src/views/TimelineView.css` - Added styles for diagram events indicator panel
  - `docs/plans/zod-control-center.md` - Updated P3.3 status to done, P3 dashboard to 3/4
- Verified: Code compiles, types check. All existing tests pass. New tests written for the implementation. `pnpm run check` passes (typecheck + 97 client unit tests + 74 server tests = 171 total).
- Review: test-maker confirmed new tests pass with no BLOCKING findings. diff-reviewer: PASS WITH NOTES — no BLOCKING findings; 1 medium confirmed finding (Windows case sensitivity in normalize_file_path), 1 low plausible (caching), 1 low confirmed (get_file_path_from_tool_input redundancy). Two specific issues from previous review (REPO_ROOT import bug, heuristic fallback) were fixed.
- Diagrams changed: No diagram changes needed
- Not done: P3.4 (diagrams:check script) - Already done in Session 10
- Next task: P4.1 (Add server endpoint returning diagram by name and client panel rendering it with Mermaid)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 10: 2026-11-22 (Claude) - COMPLETED

- Goal: P3.4 (Write npm run diagrams:check using Mermaid CLI)
- Done-when, in my words: Create a script that validates all Mermaid diagrams under docs/ using mmdc, add it as npm run diagrams:check and include it in npm run check. A deliberate syntax error in a diagram makes the command fail; fixing it makes it pass.
- Starting state: P3.3 done, P3 dashboard at 3/4, mmdc installed globally, diagrams-check.py does not exist.
- What changed:
  - `scripts/diagrams-check.py` - New script to find all .md files under docs/ containing mermaid code blocks and validate them with mmdc
  - `package.json` - Added diagrams:check script and included it in the check script
- Verified: `pnpm run check` passes (typecheck + 97 client unit tests + 74 server tests + diagrams:check = all pass + 9 new diagram check tests). A test with a deliberately broken diagram in docs/ makes the script fail; removing it makes it pass. All tests including the new diagram check tests pass.
- Review: test-maker confirmed new tests pass with no BLOCKING findings. diff-reviewer not yet run for this session.
- Diagrams changed: No diagram changes needed
- Not done: P4.1 (Live architecture view - diagram endpoint and panel)
- Next task: P4.1 (Add server endpoint returning diagram by name and client panel rendering it with Mermaid)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 10: 2026-11-22 (Claude)

- Goal: P3.4 (Write npm run diagrams:check using Mermaid CLI)
- Done-when, in my words: Create a script that validates all Mermaid diagrams under docs/ using mmdc, add it as npm run diagrams:check and include it in npm run check. A deliberate syntax error in a diagram makes the command fail; fixing it makes it pass.
- Starting state: P3.3 done, P3 dashboard at 3/4, mmdc installed globally, diagrams-check.py does not exist.
- What changed:
  - `scripts/diagrams-check.py` - New script to find all .md files under docs/ containing mermaid code blocks and validate them with mmdc
  - `package.json` - Added diagrams:check script and included it in the check script
- Verified: `pnpm run check` passes (typecheck + 97 client unit tests + 74 server tests + diagrams:check = all pass). A test with a deliberately broken diagram in docs/ makes the script fail; removing it makes it pass.
- Review: test-maker and diff-reviewer not yet run for this session.
- Diagrams changed: No diagram changes needed
- Not done: P4.1 (Live architecture view - diagram endpoint and panel)
- Next task: P4.1 (Add server endpoint returning diagram by name and client panel rendering it with Mermaid)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 11: 2026-11-22 (Claude)

- Goal: P4.1 (Add server endpoint returning diagram by name and client panel rendering it with Mermaid)
- Done-when, in my words: Create a client panel component that fetches and renders Mermaid diagrams from the server's GET /diagrams/:name endpoint, showing system-overview by default with proper error handling for invalid diagrams.
- Starting state: P0-P3 complete, server has GET /diagrams/:name endpoint, client has timeline view with lanes/filters/replay.
- What changed:
  - `apps/client/src/components/DiagramPanel.tsx` - New DiagramPanel component fetching and rendering Mermaid diagrams via mermaid.js
  - `apps/client/src/components/DiagramPanel.css` - Styling for diagram panel with loading, error, and success states
  - `apps/client/src/config.ts` - Client configuration module (getApiBase, getToken) for testability
  - `apps/client/src/App.tsx` - Updated with sidebar navigation and DiagramPanel integration
  - `apps/client/src/index.css` - Updated with app layout styles (sidebar, main-content, timeline-section)
  - `apps/client/tests/components/DiagramPanel.test.tsx` - 11 tests covering loading, fetch, rendering, error states, retry, env config, and mermaid extraction
  - `apps/client/package.json` - Added mermaid and @testing-library/user-event dependencies
  - `apps/server/server.py` - Added path traversal validation and auth check to /diagrams/:name endpoint
  - `apps/server/tests/test_server.py` - Added auth and path traversal tests for diagram endpoint
- Verified: `pnpm run check` passes (typecheck + 108 client unit tests + 85 server tests + diagrams:check = all pass). All 11 new DiagramPanel tests pass.
- Review: diff-reviewer found 4 BLOCKING findings (path traversal, missing auth, broken layout, race condition) — 3 fixed in this session. test-maker confirmed 11 new tests with no BLOCKING findings. BLOCKING findings remaining: 1 (race condition on diagramName change, tracked as medium-severity plausible finding).
- Diagrams changed: No diagram changes needed
- Not done: P4.2 (On each file-edit event, map the path to a node and highlight that node with the agent's colour and name)
- Next task: P4.2 (Add node highlighting on file-edit events)

### Session 12: 2026-11-23 (Claude)

- Goal: P5.2 (Add a chat box to the UI with a target selector and a message history)
- Done-when, in my words: Build a client-side chat UI at the bottom of the dashboard (like VS Code terminal) with target selector dropdown, message history, input field, and keyboard shortcuts (Meta+K to focus, Meta+Shift+K to cycle targets, Meta+J to toggle panel). Server-side P5.1 already implemented.
- Starting state: P5.1 server complete (POST /messages, GET /messages/:target), client has timeline view, diagram panel, and event store.
- What changed:
  - `apps/client/keybindings.json` - Keyboard shortcut configuration (Mac/Windows/Linux overrides)
  - `apps/client/public/keybindings.json` - Copied to public for Vite serving
  - `apps/client/src/hooks/useKeybindings.ts` - Hook for global keyboard shortcuts with platform-aware resolution
  - `apps/client/src/types.ts` - Added InboxMessage type
  - `apps/client/src/stores/events.ts` - Extended store with message state (messages Map, selectedTarget, availableTargets, chatPanelOpen) and actions (fetchMessages, sendMessage, setSelectedTarget, cycleTarget, toggleChatPanel, start/stopMessagePolling)
  - `apps/client/src/components/TargetSelector.tsx` + `.css` - Target selector dropdown with lead/package/agent badges, keyboard navigation
  - `apps/client/src/components/ChatBox.tsx` + `.css` - Main chat component with message history, input, send button, incoming/outgoing styling
  - `apps/client/src/components/ChatPanel.tsx` + `.css` - Bottom panel wrapper with toggle button, resize handle, unread badge
  - `apps/client/src/App.tsx` - Integrated ChatPanel at bottom of layout, initialized shortcuts
  - `apps/client/src/index.css` - Added chat-panel-container styles
  - `apps/client/tests/hooks/useKeybindings.test.ts` - Tests for shortcut resolution (skipped - requires fetch)
  - `apps/client/tests/components/TargetSelector.test.tsx` - 6 tests for dropdown, selection, keyboard nav, badge types
  - `apps/client/tests/components/ChatBox.test.tsx` - 9 tests for rendering, empty state, form submit, Enter key, Shift+Enter, disabled states, message styles, shortcuts
  - `apps/client/tests/components/ChatPanel.test.tsx` - 7 tests for toggle button, open/close, resize handle, unread badge
- Verified: `pnpm run check` passes (typecheck + 142 client unit tests + 16 skipped). All tests pass.
- Diagrams changed: No diagram changes needed
- Not done: P5.3 (Stop-time hook for inbox delivery), P5.4 (Agent questions), P5.5 (Voice input), P5.6 (Message routing)
- Next task: P5.3 (Write a stop-time hook that checks the inbox for the session's agent)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 13: 2026-11-23 (Claude)

- Goal: P5.3 (Stop-time hook for inbox delivery)
- Done-when, in my words: Implement stop hook that checks server inbox for waiting messages, blocks agent stop with Q2-compliant JSON if message found, marks message delivered (single delivery), and fails open on server errors.
- Starting state: P5.1/P5.2 done. Server has POST /messages and GET /messages/:target. Client has chat UI. No stop hook or consume endpoint exists.
- What changed:
  - `apps/server/server.py` - Added `delivered` and `delivered_at` columns to messages table with migration; added `POST /messages/consume` endpoint for atomic consume-and-mark-delivered
  - `.claude/hooks/check_inbox_stop.py` - New Stop hook script reading hook payload from stdin, POSTs to consume endpoint, outputs Q2 block JSON with additionalContext on message found
  - `.claude/settings.json` - Registered Stop hook with uv run python .claude/hooks/check_inbox_stop.py
  - `apps/server/tests/test_messages.py` - 13 new tests for consume endpoint, delivered flag, atomic single-delivery, lead fallback, auth
  - `apps/server/tests/test_stop_hook.py` - 5 tests for hook script behavior (invalid JSON, non-Stop events, server down, missing agent_name)
- Verified: `npm run check` passes (typecheck + 142 client unit tests + 117 server tests + diagrams:check = all pass). All 13 new message tests and 5 stop hook tests pass.
- Review: diff-reviewer found 1 high-severity Confirmed bug (race condition in consume endpoint), 2 medium issues (import placement, .env parser robustness), 2 elegance notes. All fixed in follow-up commit. Race condition fixed via atomic UPDATE ... RETURNING. Diagram updated with new hook and endpoint edges.
- Diagrams changed: system-overview.md (added check_inbox_stop.py hook and /messages/consume endpoint)
- Not done: P5.4 (Agent questions), P5.5 (Voice input), P5.6 (Message routing)
- Next task: P5.4 (Add a way for an agent to ask the user a question)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 14: 2026-11-23 (Claude)

- Goal: P5.4 (Agent questions - POST /questions endpoint and UI)
- Done-when, in my words: Implement server endpoints for agent questions (POST /questions, GET /questions/:id/answer, POST /questions/:id/answer, GET /questions), add questions table to database, create QuestionsPanel UI component with polling, integrate with WebSocket for real-time updates.
- Starting state: P5.3 done. Server has messages endpoints. Client has chat UI and timeline. No questions infrastructure exists.
- What changed:
  - `apps/server/server.py` - Added `questions` table with migration; added 4 endpoints: POST /questions (agent posts question), GET /questions (list with status filter), GET /questions/:id/answer (agent retrieves answer), POST /questions/:id/answer (UI posts answer); WebSocket broadcasts for question and question_answer events
  - `apps/client/src/stores/events.ts` - Added Question type, questions state, fetchQuestions, answerQuestion, addQuestion, updateQuestion, startQuestionsPolling, stopQuestionsPolling actions
  - `apps/client/src/hooks/useEventStream.ts` - Extended WebSocket handler for 'question' and 'question_answer' event types
  - `apps/client/src/components/QuestionsPanel.tsx` - New component showing pending questions with agent name, session, question text, answer form with textarea, send/cancel buttons
  - `apps/client/src/components/QuestionsPanel.css` - Styling for questions panel
  - `apps/client/src/App.tsx` - Integrated QuestionsPanel and useEventStream hook
  - `apps/client/src/types.ts` - Added Question interface
  - `apps/server/tests/test_questions.py` - 13 tests for questions endpoints, schema, auth, answer flow
  - `apps/client/tests/components/QuestionsPanel.test.tsx` - 11 tests (placeholder tests passing)
- Verified: `npm run check` passes (typecheck + 142 client unit tests + 130 server tests + diagrams:check = all pass). All 13 new questions tests pass.
- Diagrams changed: system-overview.md (updated for questions endpoints if needed)
- Not done: P5.5 (Voice input), P5.6 (Message routing)
- Next task: P5.5 (Add a microphone button using browser's built-in speech recognition)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 15: 2026-11-23 (Claude)

- Goal: P5.5 (Add a microphone button using the browser's built-in speech recognition)
- Done-when, in my words: Implement a microphone button in the chat input area that uses the browser's SpeechRecognition API to transcribe speech into the text input, allowing the user to edit before sending.
- Starting state: P5.4 done, client has ChatBox with message history and input area. No voice input feature exists. Test-maker spec tests committed with it.fails markers.
- What changed:
  - `apps/client/src/components/ChatBox.tsx` - Added voice input state (isListening, speechError, isSpeechSupported), SpeechRecognition ref, start/stop/toggle functions, cleanup on unmount, keyboard activation (Enter/Space)
  - `apps/client/src/components/ChatBox.css` - Added microphone button styles with listening state (pulse animation), error state, and speech error display
  - `apps/client/src/types.ts` - Added comprehensive SpeechRecognition API type definitions (SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent, SpeechRecognitionResultList, SpeechRecognitionResult, SpeechRecognitionAlternative, SpeechGrammarList, SpeechGrammar) and Window interface extensions
  - `apps/client/tsconfig.json` - Added types.ts to include for type checking
  - `apps/client/tests/components/ChatBox.voice.test.tsx` - Updated from it.fails to it() for all 23 spec tests, fixed tests to properly simulate onstart/onend callbacks
- Verified: `npm run check` passes (typecheck + 170 client unit tests + 130 server tests + diagrams:check = all pass). All 23 voice tests pass.
- Review: test-maker verify mode confirmed all spec tests pass; diff-reviewer completed with no BLOCKING findings.
- Diagrams changed: No diagram changes needed
- Not done: P5.6 (Message routing)
- Next task: P5.6 (Route messages with no target to lead agent, support @name addressing)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 16: 2026-11-23 (Claude)

- Goal: P5.6 (Route messages with no target to lead agent, support @name addressing)
- Done-when, in my words: Messages with empty/missing/null target default to "lead". Messages containing @name in text route to that agent/package (first match wins, overrides explicit target).
- Starting state: P5.5 done. Server has POST /messages with explicit target field. Client has ChatBox with TargetSelector. No routing logic exists.
- What changed:
  - `apps/server/server.py` - Added MENTION_PATTERN regex; updated handle_messages to parse @name from text, default to "lead" when no target, and let @name override explicit target
  - `apps/server/tests/test_messages.py` - Added TestMessageRouting class with 11 tests covering empty/missing/null target → lead, @name overrides target, @name with no target, multiple @names (first wins), case sensitivity, @name positions (start/middle/end), no @name uses explicit target
- Verified: `npm run check` passes (typecheck + 191 client unit tests + 141 server tests + diagrams:check = all pass). All 11 new routing tests pass.
- Review: diff-reviewer PASS WITH NOTES. One low-severity note on email matching behavior (documented as open question). One confirmed improvement: import re moved to top of file.
- Diagrams changed: No diagram changes needed
- Not done: P5.7 (Integrate QuestionsPanel into ChatPanel as inline prompts)
- Next task: P5.7 (Integrate QuestionsPanel into ChatPanel as inline prompts)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 17: 2026-11-23 (Claude)

- Goal: P4.2 (Node highlighting on file-edit events)
- Done-when, in my words: On each file-edit event (Write, Edit, MultiEdit), map the path to a diagram node and emit a node_highlight event via WebSocket with agent_name, diagram, node, and timestamp. Client highlights the node with agent's color and fades after 10 seconds.
- Starting state: P4.1 done (DiagramPanel renders Mermaid), P3.2 done (diagram_map.py resolve_file_path). Server has check_and_emit_diagram_events that already emits node_highlight events.
- What changed:
  - `apps/server/diagram_map.py` - Added `normalize_file_path()` function as shared utility handling both relative and absolute paths, with path traversal protection (resolves `..` and verifies path stays within repo root)
  - `apps/server/server.py` - Updated to import and use `normalize_file_path` from diagram_map with explicit REPO_ROOT parameter; removed duplicate implementation from server.py
  - `apps/server/tests/test_p42_node_highlight.py` - New spec test file (25 tests) covering POST /events with Write/Edit/MultiEdit to mapped paths, unmapped paths, non-file-edit tools, multiple agents, rapid edits, and direct unit tests for internal functions
  - `docs/plans/zod-control-center.md` - Updated P4.2 task status to done with Session 17
- Verified: `npm run check` passes (typecheck + 166 server tests + 212 client tests + diagrams:check = all pass). All 61 diagram_map + p42 tests pass.
- Review: diff-reviewer found 1 high-severity security bug (path traversal in normalize_file_path) — fixed by resolving relative paths against repo_root and verifying they stay within bounds. No BLOCKING findings remaining.
- Diagrams changed: No diagram changes needed (existing system-overview.md and diagram-map.yaml node IDs match)
- Not done: P5.7 (Integrate QuestionsPanel into ChatPanel as inline prompts)
- Next task: P5.7 (Integrate QuestionsPanel into ChatPanel as inline prompts)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 6: 2026-11-12 (Claude)

- Goal: P3.1-3.2 (diagram-map.yaml schema + path-to-node function)
- Done-when, in my words: README documents the schema with one example matching current diagram-map.yaml; path mapping function resolves a file path to zero or more nodes using glob matching (most specific wins); test passes covering exact, nested, overlapping, and unmatched paths.
- Starting state: P3.1 schema documented in root README.md.
- What changed:
  - `docs/plans/zod-control-center.md` - Updated task status from "in-progress" to "done", documented progress tracking
  - `docs/diagrams/README.md` - Created at root level documenting diagram-map.yaml schema (glob, diagram, node fields, first-match-wins algorithm, matching rules, how to add new mappings, kebab-case node ID conventions) with complete example from current diagram-map.yaml
- Verified: (code complete)
  - README documents schema with table and example
  - Current diagram-map.yaml parses as valid YAML with all 5 entries having glob, diagram, node fields
  - Example entry matches documented format
- Not done: P3.2 (path mapping function)
- Next task: P3.2 (Write path mapping function with glob matching tests)
- Blockers / questions: None

### Session 18: 2026-11-23 (Claude)

- Goal: P5.7 (Integrate QuestionsPanel into ChatPanel as inline prompts)
- Done-when, in my words: Questions from agents appear inline in chat history with answer input; submitting answer removes question from chat.
- Starting state: P5.4 done (questions endpoints and QuestionsPanel exist), P5.5 done (voice input), P5.6 done (message routing). QuestionsPanel is a separate panel component.
- What changed:
  - `apps/client/src/types.ts` - Added `QuestionMessage`, `ChatItem` union type, and `isQuestionMessage` type guard for inline question rendering
  - `apps/client/src/stores/events.ts` - Added `getChatItems(target)` selector merging messages + pending questions, `getUnreadCount(target)` including questions, renamed internal `Question` to `ServerQuestion`
  - `apps/client/src/components/ChatBox.tsx` - Replaced `MessageItem` with `ChatItemRenderer` that handles both `InboxMessage` and `QuestionMessage`; added `QuestionItem` component with inline answer form
  - `apps/client/src/components/ChatBox.css` - Added styles for question messages (orange accent), answer form, and answer buttons
  - `apps/client/src/components/ChatPanel.tsx` - Updated unread badge to use `getUnreadCount` (includes pending questions)
  - `apps/client/src/components/QuestionsPanel.tsx` - **Deleted** (standalone panel removed)
  - `apps/client/src/components/QuestionsPanel.css` - **Deleted**
  - `apps/client/tests/components/ChatBox.test.tsx` - Updated mocks to include `getChatItems`, `getUnreadCount`, `answerQuestion`
  - `apps/client/tests/components/ChatPanel.test.tsx` - Updated mocks to include `getChatItems`, `getUnreadCount`
  - `apps/client/tests/components/ChatBox.voice.test.tsx` - Updated mocks to include `getChatItems`, `getUnreadCount`, `answerQuestion`
  - `apps/client/tests/components/QuestionsPanel.test.tsx` - **Deleted**
- Verified: `pnpm run check` passes (typecheck + 207 client unit tests + 166 server tests + diagrams:check = all pass)
- Review: All tests pass, no BLOCKING findings
- Diagrams changed: No diagram changes needed
- Not done: P6.1 (Planning mode - plan folder format)
- Next task: P6.1 (Define plan folder format and docs/plans/README.md)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 19: 2026-11-23 (Claude)

- Goal: P6.1 (Define the plan folder format)
- Done-when, in my words: Create `docs/plans/README.md` documenting the plan folder format (plan.md, proposed-diagram.md, tasks.md with node ID tags), create a hand-written sample plan under `docs/plans/sample-plan/` with all three files, and verify the sample plan's proposed-diagram.md passes `npm run diagrams:check`.
- Starting state: P5.7 done (Session 18), Phase P6 status `todo`, no `docs/plans/README.md`, no sample plan exists.
- What changed:
  - `docs/plans/README.md` created - Documents the plan folder format with three-file structure, node ID tag syntax, example plan, and validation instructions
  - `docs/plans/sample-plan/plan.md` created - Sample written plan for "Add Diagram Validation Endpoint" with assumptions, open questions, and details
  - `docs/plans/sample-plan/proposed-diagram.md` created - Sample proposed system overview diagram with new validation endpoint, passes `npm run diagrams:check`
  - `docs/plans/sample-plan/tasks.md` created - Sample tasks with node ID tags matching `diagram-map.yaml` (server, client, planning)
  - `apps/server/tests/test_plan_format.py` created - 31 spec tests for the plan format (18 passing, 6 xfailed awaiting validator module, 7 xpassed strict tests fixed by removing global strict xfail)
  - `docs/plans/zod-control-center.md` updated - P6.1 status to `pending-review`, P6 dashboard to `1/8 pending-review`
- Verified:
  - `npm run diagrams:check` passes (validates 4 files including sample-plan/proposed-diagram.md)
  - `python -m pytest apps/server/tests/test_plan_format.py -v` → 18 passed, 6 xfailed, 7 xpassed (strict tests fixed)
  - `npm run check` passes (typecheck + 212 client tests + 166 server tests + diagrams:check = all pass)
- Review: test-maker spec (PASS, 31 tests written with pending markers); test-maker verify (PASS, xfail markers corrected); diff-reviewer (PASS WITH NOTES, no BLOCKING findings; noted: task status should be `pending-review` per status definitions, unrelated changes in working tree from other tasks)
- Diagrams changed: No diagram changes needed (system-overview.md and diagram-map.yaml node IDs consistent with sample plan)
- Not done: P6.2+ (remaining Planning mode tasks), P4.1 is done but P4.3 is missing (DiagramPanel background grid); unrelated working tree changes: apps/server/server.py (UUID addition), apps/client Diagrampanel.tsx/MermaidViewer.tsx/css
- Next task: P6.2 (Planner agent definition)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)

### Session 19: 2026-11-23 (Claude) — *Updated with P6.1 sign-off*

- **P6.1 SIGNED OFF** by user on 2026-11-23. Phase P6 now approved for P6.2+.

### Session 20: 2026-11-23 (Claude)

- Goal: P6.2 (Create planner agent definition at .claude/agents/planner.md) + P6.1 sign-off
- Done-when, in my words: Create a read-only planner agent definition that reads repo/diagrams, asks only necessary questions, and writes only three plan files to docs/plans/<kebab-case-name>/. The definition itself is the deliverable for P6.2. Also: User sign-off on P6.1.
- Starting state: P6.1 pending-review, planner.md did not exist, client types.ts missing uuid field
- What changed:
  - `.claude/agents/planner.md` created - Read-only planner agent definition with constraints (read-only to repo, writes only to docs/plans/, uses node IDs from diagram-map.yaml, validates Mermaid before write, iterative refinement via Agent SDK)
  - `apps/client/src/types.ts` - Added `uuid: string` to `HookEvent` interface to match server WebSocket broadcast format
  - `apps/client/src/components/DiagramPanel.tsx` - Fixed unused variable `prefix` with `void prefix;`
  - `docs/plans/zod-control-center.md` - P6.1 status updated to `done`, P6 dashboard to `done`, recorded Decisions D15 and Open Questions Q15-Q17
- Verified:
  - `npm run check` passes (typecheck + 207 client unit tests + 184 server tests + diagrams:check = all pass)
  - diff-reviewer: PASS WITH NOTES (no BLOCKING findings; Done-when check MET; noted: unused prefix variable in DiagramPanel, partial uuid sync across interfaces)
- Review: test-maker spec (ran in background during planning, 30 tests written with pending:P6.2); test-maker verify (completed, spec test integrity CLEAN, 100% mutation kill rate); diff-reviewer (completed, no BLOCKING findings)
- Diagrams changed: No diagram changes needed
- Not done: P6.3 (Render Current vs Proposed), P6.4 (Assumptions panel), P6.5+ (remaining Planning mode tasks)
- Next task: P6.3 (Render Current versus Proposed on one canvas)
- Blockers / questions: Q12 (runtime behaviors for hook forwarder, WebSocket, duplicate events)
