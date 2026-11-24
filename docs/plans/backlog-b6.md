# Live Activity Animations: Implementation Spec (Backlog B6)

*For implementing agents, with human checkpoints. Zod Control Center, written 2026-11-23.*

## 1. Purpose and scope

Make agent activity visible on the architecture diagram canvas (`DiagramPanel`) in real time. When a timeline event arrives, the canvas does four things:

1. **Camera**: glides to the affected node, with the easing feel of maps.apple.com (fast start, long soft landing, and a brief zoom-out on long hops).
2. **Cue-in / cue-out**: an event-specific effect plays on the node and fades away.
3. **Visual language by event type**: writes = blue particles, reads = cyan ripples, searches = purple spiral, errors = red flash.
4. **Trail**: recent activity per agent leaves a faint, fading curve between the nodes it touched, so you can read the flow of work.

This is client-only work in `apps/client`. It must not add server endpoints, change the database, or touch hook scripts. If it seems to need any of those, stop and add an Open Question.

## 2. Read first: rules and preconditions

This spec extends `docs/plans/zod-control-center.md`. All of its Section 1 ground rules and Section 2 session protocol apply unchanged: one task at a time, `test-maker` in `spec` mode before implementing Medium tasks, `diff-reviewer` before committing, small commits formatted `<ID>: short description`, no editing of task definitions or Done-when checks, and a user summary before every commit.

**Task IDs.** Tasks below are named `A0` to `A8`. When the user promotes Backlog item B6, they record a Decision and assign a phase prefix (for example `P9.5`). Rename the IDs then. Do not start `A1` until that Decision exists.

**Preconditions (verify, do not assume):**

- Backlog B5 is fixed: a mapped event resolves to a rendered Mermaid SVG node or subgraph element (IDs look like `flowchart-<id>-<n>`) and highlights it. Effects reuse that lookup, so if B5 is open, `A0` must finish it first.
- P4.3 is `done`. The Session 19 log suggests it may be missing even though P4 shows 4/4.
- You have read `DiagramPanel.tsx`, `MermaidViewer.tsx`, and the P4.2 highlight code. If a pan/zoom mechanism already exists, **reuse its transform** rather than adding a second one.

## 3. Design language

The goal is *quiet and fluid*, not flashy. One idea per effect, small amounts of motion, nothing that competes with reading the diagram. Every constant lives in one file, `apps/client/src/fx/motionConfig.ts`, so a human can tune the feel without touching logic.

### 3.1 Camera (the Apple Maps feel)

The camera is `{ x, y, k }` (translate and scale) applied to one wrapper around the diagram layer and the effects canvas, so they always move together.

- **Easing**: `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out quint): a quick departure and a long, gentle settle. Never use linear or default `ease`.
- **Duration**: scales with distance, clamped to 600 to 1100 ms.
- **Smooth zoom on long hops**: the scale dips as the camera travels and returns by arrival: `k(t) = lerp(k0, k1, e(t)) - dip * sin(pi * t)`, where `dip` grows with travel distance relative to the viewport, capped at 0.25. This reproduces the "pull back, then settle in" look without a library.
- **Dead zone**: do not move if the node centre is already inside the central 60% of the viewport. This prevents constant motion and is the biggest single contributor to feeling calm.
- **Retargeting**: a new target mid-flight starts from the current position and velocity. The position must never jump.
- **User wins**: any user pan, zoom, or drag suspends auto-follow for 4 s (`followResumeMs`). Show a small "Follow" pill that resumes following on click.
- **Scale limits**: clamp `k` to 0.8 to 1.6 for follow moves.

### 3.2 Effects by event type

All effects are drawn on a single 2D `<canvas>` overlay above the SVG. Colours come from `effectTokens.ts` (CSS-variable-backed with hex fallbacks) so P9.1 can later fold them into the global tokens. Alpha always fades with ease-in over the last 30% of an effect's life (the cue-out).

| Kind | Trigger (verify against real events) | Visual | Duration |
| --- | --- | --- | --- |
| write | Edit, Write, MultiEdit tool events | Blue: 10 to 14 particles drift **inward** from a ring (about 48 px out) to the node centre, plus one soft glow pulse | 800 ms |
| read | Read tool events | Cyan: two concentric ripple rings expanding from the node, 180 ms apart, radius 0 to 1.6x the node half-diagonal, alpha 0.5 to 0 | 1000 ms |
| search | Grep, Glob, WebSearch events | Purple: about 1.5-turn spiral of fading dots winding around the node | 1100 ms |
| error | Failed tool use, rate-limit or model-error events (P8.4) | Red: two quick flashes of the node outline and a 0.35-alpha red fill, then a dim red ring for 3 s. **No shaking** | 700 ms + 3 s ring |
| other | Anything mapped but unclassified | Small neutral glow dot | 400 ms |

The existing agent badge and 10-second highlight from P4.2 stays as is. Effects are additive.

### 3.3 Trail

Per agent, keep a ring buffer of the last 12 node visits. Draw each consecutive pair as a gentle quadratic curve (control point offset perpendicular to the line by about 12% of its length), stroked in the agent's P4.2 colour at low alpha. A segment fades to zero over 8 s (`trailFadeMs`). During the first 600 ms of a new segment, a small dot travels along it from the previous node to the new one. The trail should read as flow, so it must stay subtle (peak alpha 0.35, 2 px stroke).

### 3.4 Choreography and rate limiting

Per incoming event, `ActivityDirector` does this:

1. Classify the event, map its path to a node (reuse P3.2 and P4.2), and look up the node's geometry. Unmapped edits produce no camera move and no effect.
2. If the node is outside the dead zone, start `flyTo`. Cue in the effect at 55% of the pan (or immediately if no pan is needed).
3. Add the trail segment.

Burst control (needed because agents can emit many events per second):

- **Coalesce**: events for the same node and same kind within 250 ms become one effect.
- **Pan throttle**: at most one camera move per 1200 ms. While throttled, the camera follows the most recent error event if there is one, otherwise the most recent event.
- **Queue cap**: at most 20 pending effects. When full, drop the oldest non-error first.
- **Errors always play**, and are never coalesced into other kinds.

### 3.5 Motion preferences and performance budget

- `prefers-reduced-motion: reduce`, or the in-app Motion setting set to Reduced: no pans (jump cut with a 150 ms crossfade), no particles, spirals, or ripples; use a static 1.5 s glow ring in the event colour instead.
- Motion setting: Full, Reduced, Off. Persist it in `localStorage` (this is the app itself, not a Claude artifact, so that is fine).
- 60 fps target. Hard caps: 300 live particles total, canvas DPR capped at 2.
- The animation loop runs **only while something is active**, and stops when the tab is hidden. An idle diagram uses no animation frames.
- Memory must stay flat under sustained load (see `A7`).

## 4. Architecture

All new code lives under `apps/client/src/fx/`, with tests under `apps/client/tests/fx/`.

| File | Responsibility | Pure? |
| --- | --- | --- |
| `motionConfig.ts` | All timings, caps, easing curves, thresholds | data |
| `effectTokens.ts` | Colour per kind, with fallbacks | data |
| `classifyEvent.ts` | Event to `write\|read\|search\|error\|other\|null` | pure |
| `nodeGeometry.ts` | SVG node ID to `{cx, cy, w, h}` in diagram space | DOM |
| `CameraController.ts` | Easing, smooth zoom, retarget, follow/pause | pure, injected clock |
| `EffectsEngine.ts` | Spawn, tick, and draw effects and trails | pure, injected clock and RNG |
| `ActivityDirector.ts` | Orchestration: queue, coalescing, throttling | pure, injected deps |
| `FxLayer.tsx` | Canvas overlay, rAF loop, wiring to the store | React |
| `scripts/simulate-activity.ts` | Posts scripted events for demos and tests | script |

Contracts (TypeScript):

```ts
type FxKind = 'write' | 'read' | 'search' | 'error' | 'other';
interface Clock { now(): number }              // inject performance.now in prod
interface Camera { x: number; y: number; k: number }
interface NodeGeo { cx: number; cy: number; w: number; h: number }

classifyEvent(e: HookEvent): FxKind | null;    // null = no visual
resolveNodeGeometry(svg: SVGSVGElement, nodeId: string): NodeGeo | null;

class CameraController {
  constructor(o: { clock: Clock; config: MotionConfig; onChange(c: Camera): void });
  flyTo(t: { cx: number; cy: number }, viewport: { w: number; h: number }): void;
  userInteracted(): void;     // suspends auto-follow for followResumeMs
  resumeFollow(): void;
  tick(): boolean;            // true while still animating
}

class EffectsEngine {
  constructor(o: { clock: Clock; rng: () => number; config: MotionConfig });
  spawn(fx: { id: string; kind: FxKind; agentId: string; agentColor: string }, geo: NodeGeo): void;
  addTrail(agentId: string, from: NodeGeo, to: NodeGeo, color: string): void;
  tick(): boolean;            // true while anything is active
  draw(ctx: CanvasRenderingContext2D, camera: Camera): void;
  stats(): { particles: number; effects: number; trailSegments: number };
}
```

Store node **IDs**, never coordinates. Re-resolve geometry on every diagram re-render and on resize (`ResizeObserver`), because the Mermaid SVG is replaced when the diagram changes.

In non-production builds, expose `window.__fxTest = { stats(), camera() }` for Playwright. Strip it from production builds.

## 5. Tasks

Order is strict. Risk tiers follow Section 4.1 of the plan: all tasks here are Low or Medium-Internal (client only, no external interfaces). If any task starts reading file paths from requests or adds an endpoint, it becomes High; stop and ask.

### A0. Preconditions gate (Low)

- **Do**: confirm B5 and P4.3 status; read the existing diagram code; answer the Section 8 questions from the code. Record a Decision for any choice (for example, reuse an existing pan/zoom transform).
- **Done when**: Section 2 preconditions are verified in the Session Log, Section 8 answers are recorded, and a human has confirmed the B6 promotion Decision exists.

### A1. Event classification and style tables (Medium-Internal)

- **Contract**: `classifyEvent` maps real event shapes to `FxKind` or `null`, using the field names actually emitted by the hook forwarder (read them from `apps/server` and existing fixtures, never guess). Errors take priority over tool type.
- **Done when**: a table-driven unit test covers each kind, an error on a write tool (returns `error`), an unknown tool (returns `other`), and a non-activity event (returns `null`). The fixtures are real captured events.

### A2. Node geometry resolver (Medium-Internal)

- **Contract**: `resolveNodeGeometry` returns centre and size in diagram space for a node or subgraph ID, correct under any existing transform, or `null` when the node is missing.
- **Done when**: a Playwright test renders `system-overview.md` with real Mermaid and asserts that every node ID in `diagram-map.yaml` resolves to a box inside the SVG bounds, and that a missing ID returns `null`. A subgraph resolves to its container box.

### A3. Camera controller (Medium-Internal)

- **Contract**: behaviour in Section 3.1. Pure and driven by an injected clock.
- **Done when** (Vitest, fake clock):
  1. Position progress is monotonic non-decreasing toward the target and ends exactly on it.
  2. A node inside the dead zone causes no move.
  3. Long hops dip scale mid-flight and return to the target scale; short hops do not dip.
  4. Retargeting mid-flight produces no position discontinuity larger than one frame of motion.
  5. `userInteracted()` halts auto-follow until `followResumeMs` passes or `resumeFollow()` is called.
  6. Reduced motion jumps directly to the target.
- **Human checkpoint H1** follows (Section 7).

### A4. Effects engine (Medium-Internal)

- **Contract**: Sections 3.2 and 3.5. Deterministic with a seeded RNG and a fake clock.
- **Done when**:
  1. Vitest, using a recording mock context: each kind issues the expected draw primitives, effects expire at their duration, `tick()` returns `false` when idle, and live particles never exceed the cap even when flooded.
  2. Playwright pixel tests render each of the five kinds on a neutral background at 0%, 25%, 50%, and 75% of life with a seeded RNG, compared with a tolerance of `maxDiffPixelRatio: 0.01` in both light and dark themes.
- **Human checkpoint H2** approves the baseline images before they are committed.

### A5. Trails (Medium-Internal)

- **Contract**: Section 3.3.
- **Done when**: tests show the ring buffer keeps only the last 12 visits per agent, segments reach zero alpha at `trailFadeMs`, two agents keep separate trails, and a single-node visit draws nothing.

### A6. Director and integration (Medium-Internal)

- **Contract**: Section 3.4. `FxLayer` subscribes to the existing event store selectors and also handles replay (P2.3): in replay, the same pipeline runs, driven by the replayed event times and selected speed.
- **Done when**:
  1. Unit tests cover coalescing (same node and kind within 250 ms gives one effect), pan throttling (at most one move per 1200 ms), queue cap with errors preserved, and unmapped events producing nothing.
  2. Playwright: running `simulate-activity` with the `all-kinds` scenario shows all four kinds firing on the right nodes, the camera moving, and a trail visible (check via `window.__fxTest.stats()`).
  3. Replaying a stored session produces the same effect sequence as live playback.
- **Human checkpoint H3** follows.

### A7. Performance and accessibility (Medium-Internal)

- **Done when**:
  1. A synthetic load of 20 events per second for 5 minutes shows no growth in `stats()` counts beyond the caps and no growth in JS heap beyond a noise threshold (record the measured numbers in the log).
  2. With the tab hidden or the diagram idle, zero `requestAnimationFrame` callbacks are scheduled (verify with a counting stub).
  3. With `prefers-reduced-motion: reduce` emulated, no pan occurs and no particles spawn.
  4. The Motion setting (Full, Reduced, Off) works and persists across reloads.
  5. The "Follow" pill has an accessible name and is keyboard reachable.
- **Human checkpoint H4** follows.

### A8. Phase sign-off (Low)

- **Do**: per D14, set the phase to `pending-review` and present the summary and checklist from Section 7.
- **Done when**: the user approves in writing.

## 6. Test strategy

- **Determinism first**: every time-dependent class takes an injected `Clock` and, where relevant, an `rng`. No test depends on wall-clock time or `Math.random`.
- **Playwright clock**: for E2E tests, use `page.clock` to control time if the installed Playwright version supports it (it also fakes `requestAnimationFrame`). Otherwise inject a clock provider via a dev-only query parameter. Record which you used as a Decision.
- **Pixel tests are for the effects canvas only**, not the whole page, to avoid Mermaid layout flakiness. Never update a baseline without human approval (H2).
- **Test hooks**: `window.__fxTest` exists only in non-production builds.
- **Spec tests** follow the plan's pending-marker protocol (`pending:A#`), and `test-maker` runs in spec mode before implementing each Medium task.

### Event simulator

`apps/client/scripts/simulate-activity.ts`, run with `pnpm sim:activity -- --scenario all-kinds`.

- It POSTs to the existing events endpoint on `127.0.0.1`. The token comes from the same mechanism as P1.5 and Q10 (environment or an untracked file). **Never hardcode or print it.**
- Scenarios live in `apps/client/scripts/scenarios/*.json`: `all-kinds` (one of each kind on distinct nodes), `burst` (40 events in 2 s across 3 nodes), `long-hop` (alternating far-apart nodes), `two-agents` (interleaved trails), and `error-in-burst`.
- It adds no server endpoint. If it cannot work without one, stop and add an Open Question.

## 7. Human-in-the-loop checkpoints

At each checkpoint the agent stops, produces the evidence listed, and waits for an explicit pass or a list of changes. Agents may adjust only `motionConfig.ts` and `effectTokens.ts` values in response to feedback, and must log each change.

| ID | After | Agent provides | Human judges (pass criteria) |
| --- | --- | --- | --- |
| H1 | A3 | A screen recording (or GIF) of `long-hop` and `burst` scenarios | Motion feels smooth and calm. No jerks on retarget. Long hops "pull back" visibly but briefly. |
| H2 | A4 | Contact sheet: five kinds by four timestamps, light and dark | Each kind is distinguishable without a legend. Colours are readable on both themes. Nothing is garish. Approve baselines. |
| H3 | A6 | Recording of `all-kinds` and `two-agents` live, plus a replayed session | Effects land on the correct nodes. The trail reads as flow. The dead zone prevents constant camera movement. |
| H4 | A7 | Perf numbers, plus a reduced-motion recording | Acceptable CPU usage on the user's machine. Reduced mode is usable. |

**Phase sign-off checklist (A8)**: all four checkpoints passed; `npm run check` green; no `pending:A#` markers; no open BLOCKING findings; `docs/diagrams/` updated if the module structure changed (a new `fx` module under the client node).

## 8. Open questions the implementer must answer from the code (do not guess)

1. What are the exact event type and tool-name fields in hook payloads, and which events represent failures and rate limits (P8.4)?
2. Which Mermaid version is installed, and what exactly do node and subgraph element IDs look like in its output?
3. Does `DiagramPanel` or `MermaidViewer` already implement pan or zoom, and how is its transform applied?
4. Does the Playwright version in use support `page.clock`?
5. Where does the P4.2 agent colour come from, and can the effects layer read it?

Answers go into the Session Log. Anything unresolved becomes an Open Question in Section 6, and the task stops.

## 9. Out of scope

- Server, database, or hook changes.
- Sound, 3D, WebGL, or third-party animation libraries. Plain canvas, the Web Animations API, and the existing React stack are enough. A new dependency requires a Decision first.
- Showing code-level detail inside nodes.
- Read and search highlighting beyond what B4 defines. This spec adds the visuals for those events only.
- Anything suggested mid-task: add one line to Section 8 (Backlog) of the plan and carry on.
