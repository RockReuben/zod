# Testing Strategy

> **Agent Loading Rule:** Read **Core rules**, **Robustness invariants**, and **Universal input classes** only. Then `Grep` for `^## ` and read **strictly** the interface sections matching the active work unit. Never load the full file.

Repository-agnostic playbook for `test-maker`. Repo-specific constants live in `zod-control-center.md`. Use existing repo tools only; never add dependencies.

Tool names are examples. Always use what the repo already has, in its idiom, and never add dependencies as part of writing tests. Equivalents by ecosystem: property testing (fast-check, Hypothesis, proptest, gopter/rapid), mutation testing (Stryker, mutmut, cargo-mutants), expected-failure markers (see Core rule 10).

## Core rules

1. **The oracle comes from the contract.** Order of authority: (1) the repo plan's requirements and the work unit's Done-when, with `[confirmed]` items as requirements and `[proposed]` items as defaults, (2) type and schema definitions, (3) existing tests, (4) documented conventions. Code is evidence of behavior, never of correctness.
2. **Unspecified is not "whatever the code does".** If nothing defines the right outcome, assert only a robustness invariant and raise an Open Question. Never freeze accidental behavior into a test.
3. **Test at the interface.** Call what a real caller calls. Do not test private helpers directly unless they are the contract.
4. **Mock only true external boundaries** (third-party network, clock, randomness). Never mock the unit under test. Prefer real in-memory or temp implementations (in-memory databases, temp directories, ephemeral ports) over mocks.
5. **Hermetic and deterministic.** No sleeps as synchronization (await an event, or poll with a deadline), no fixed ports, no shared state between tests, no wall-clock dependence (inject or fake the clock), no order dependence.
6. **Sharp assertions.** Assert specific values, status codes, and error types. Avoid "does not throw" as the only check, whole-output snapshots of volatile data, and assertion-free tests.
7. **A test must be able to fail.** Prove it with a mutant (flip a bound, delete a check, change ordering). Delete tests that cannot be made to fail.
8. **Fewer, better tests.** Budget by risk: external-reachable and high blast radius first. Roughly 8 tests per external entry point and 3 per internal one is plenty.
9. **Name tests after the requirement**, and cite the plan item in a comment so a failure points to a decision. Tag each test with a comment `matrix: <interface> | <input class> | <plan reference or "invariant">`. The tags are how the entry matrix persists between runs: the matrix is derived from the interface registry and the input classes, minus what tests are tagged for and what Open Questions hold, so it is never stored as a separate file.
10. **Known bug against a confirmed requirement:** keep the test, mark it as an expected failure with the reason `bug:<finding id>` (`pending:<unit id>` is reserved for work not yet implemented), keep the suite green, and make the marker easy to remove. Native mechanisms: pytest `xfail(strict=True)`, vitest `it.fails`, jest `test.failing`, node:test `{ todo }`, Rust `#[ignore = "..."]`, Go `t.Skip("known bug F1: ...")`. Prefer strict mechanisms that flip to a failure once the bug is fixed.
11. **Spec-first tests are independent of the implementation.** Written before the code, from the contract alone, they load the unit under test lazily (import, require, or spawn inside the test body) so a missing module fails one test and never breaks collection. They carry the reason `pending:<unit id>` using the strict-flip mechanism where one exists, so the suite stays green now and the marker must be removed once the test passes. Never edit their assertions to fit the implementation; if one looks wrong, raise an Open Question. Where the contract does not name an interface a test would need (a function name, module path, route, or response shape), do not guess it: raise an Open Question and write only tests that do not depend on it. Prove they are satisfiable with a throwaway reference implementation in scratch space.

## Robustness invariants (for unspecified cases)

When the plan is silent, these are still reasonable to assert without choosing a specific outcome. Where the plan states a stricter posture, assert that instead.

- Does not crash the process or leave it corrupted: a follow-up valid call still works.
- Terminates within a deadline (no hang, no infinite loop, no unbounded retry).
- Fails closed: invalid input is rejected or ignored, not partially applied.
- Resource use stays bounded (memory, listeners, handles, queue depth) under repeated or oversized input.
- Errors do not leak internals (stack traces, file paths, secrets) across a trust boundary.
- Exposure stays within the plan's posture (for example, services not reachable beyond what the plan allows).
- Never reads or writes outside intended locations (path traversal).

## Universal input classes

Apply the relevant ones to every entry point. Mark each cell: specified, invariant-only, unspecified, N/A, or already covered.

| Class              | Examples                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Valid / typical    | Smallest valid input, a representative one                                                                                                 |
| Boundary           | 0, 1, max, max+1, exactly at a cap, negative, non-integer, `NaN`, `Infinity`                                                               |
| Empty / missing    | `undefined`/`null`/`None`, `""`, `[]`, `{}`, missing required field, missing optional field                                                |
| Wrong type         | String where number expected, array vs object, number-like strings                                                                         |
| Malformed          | Invalid JSON, truncated input, bad encoding, unexpected extra fields, special keys (`__proto__`)                                           |
| Oversized          | Very large body, very long string, deeply nested structure, huge collection                                                                |
| Hostile content    | Control characters, unicode edge cases, path traversal strings, injection-shaped strings if the value reaches a shell/SQL/path/markup sink |
| Duplicate / replay | Same event twice, same id twice, idempotency                                                                                               |
| Out of order       | Event B before A, update before create, stop before start                                                                                  |
| Concurrent         | Parallel calls, interleaved writes, re-entrancy                                                                                            |
| Dependency down    | Database unavailable or locked, peer service down, file missing or unreadable, slow dependency                                             |
| Lifecycle          | Use before init, after close/shutdown, double close, restart                                                                               |

## Prioritizing by risk

Score each entry point: **reachability** (external untrusted input > another process on the machine > internal typed caller) times **blast radius** (data loss or security > pipeline stall > cosmetic). Test the high-high quadrant deepest. For internal-only, typed, low-radius paths, one or two tests, or a note that the type system covers it, is enough.

## Pure functions and schemas

**Suite:** table-driven example tests, plus property-based tests when the function has algebraic properties. If no property library is installed, write a seeded, deterministic randomized loop only if that is idiomatic here; otherwise list it under Backlog.

**Probe:**

- Every boundary of every numeric or size parameter, matching the exact wording of the requirement (for example "must be a positive integer" means test 0, -1, 1.5, `NaN`, and a valid value).
- Properties: round-trip (parse then serialize), idempotence, monotonic ordering, "output is a subset or permutation of input", cap never exceeded.
- Schema/validator boundaries (Zod, Pydantic, JSON Schema, serde, and similar): valid parses; each required field missing; wrong types; extra fields (strip or reject, per plan); throwing versus result-returning APIs; schema and static types staying in sync where both exist.
- Error type or class, not full message text.

**Avoid:** testing implementation steps, asserting on internal call counts.

## Network services (HTTP and similar)

**Suite:** black-box integration. Start the real server on an ephemeral port against real in-memory dependencies, drive it with a real client, and close it in teardown.

**Probe:**

- Each route times each method: allowed, disallowed, unknown path.
- Request validation: missing, wrong-type, malformed body, wrong or missing content type, oversized body, empty body.
- Response contract: status, content type, shape (validated against the schema if one exists), stable ordering.
- **Exposure:** assert the actual listening address matches the plan's posture (inspect the bound socket, not config strings).
- Error handling: a handler that throws yields a controlled error and the server keeps serving the next request. No stack traces in bodies.
- Concurrency: parallel requests do not corrupt shared state; slow or aborted clients do not wedge the server.
- Shutdown: closes cleanly and releases the port.

**Avoid:** mocking request/response objects, hardcoded ports, asserting on headers you do not own.

## Event handlers (stdin hooks, webhooks, message consumers)

Applies to anything that receives a structured payload from outside its process and reacts: hook scripts, forwarders, webhook endpoints, queue consumers.

**Suite:** contract tests through the real entry. For process-style handlers, spawn the program, pipe a fixture payload to stdin, and assert on exit code, output, and side effect (request received by a local fake server, file written). Keep one fixture per event type, based on real or documented payload shapes. Check the integration's documentation when unsure of a field, and do not invent fields.

**Probe:**

- One fixture per supported event type, plus an unknown or future event type (behavior per plan; at minimum no crash).
- Malformed input: empty, invalid JSON, truncated, huge, non-UTF8, extra unknown fields, missing expected fields.
- **Failure semantics:** what exit code or acknowledgement is returned on failure, and whether that can interfere with the host process or sender. Check the plan's failure policy (fail open or closed). If it is silent, raise an Open Question and assert the invariant that the handler finishes within a deadline.
- **Latency and timeouts:** destination down, slow, or erroring. The handler must not hang its caller; assert completion inside a deadline against a black-hole peer.
- Ordering: duplicated, delayed, or out-of-order events, per plan.
- Sensitive data: payloads may carry secrets or private content; assert nothing is logged or forwarded beyond what the plan allows.
- Idempotent re-invocation, and concurrent invocations.

**Avoid:** testing only the happy-path payload, or calling an inner function directly while the real entry is stdin or a network message.

## Databases and storage layers

**Suite:** integration against a real engine in a temp or in-memory instance, with schema and migrations applied by the real code path. No mocks of the driver.

**Probe:**

- CRUD against spec, including empty-store reads and ordering guarantees.
- Constraints: unique, not-null, foreign keys; duplicate insert behavior per spec.
- Caps and retention (for example "keep at most N, drop oldest"): exactly N, N+1, and bulk insert past N; verify which item is dropped.
- Migrations: fresh database, already-migrated database (idempotent), partial failure.
- Transactions: failure midway leaves no partial writes.
- Concurrency: two writers; locked database; busy timeout behavior.
- Persistence: close and reopen preserves data where the spec says it should.
- Injection-shaped strings stored and retrieved verbatim (parameterized access).

## Streaming and realtime (WebSocket, SSE, pub/sub)

**Suite:** integration with a real server on an ephemeral port and a real client.

**Probe:** connect and disconnect; reconnect and resume or replay per spec; message ordering; broadcast reaches all current clients and none after disconnect; slow consumer and backpressure (server memory stays bounded); malformed or oversized client messages; abrupt socket close; many clients; server shutdown closes clients cleanly; exposure per the plan's posture.

**Avoid:** sleeping to wait for messages. Await a message event with a deadline.

## Client UI (components and pages)

**Suite:** component tests with the repo's DOM or view test setup for logic and states, plus at most one end-to-end test on the critical path. Do not build end-to-end tests for every component.

**Probe:** empty, loading, error, and populated states; large lists; rapid updates; reconnect or stale-data display; keyboard use and basic accessibility roles on interactive elements; unknown or extra fields in incoming data do not crash rendering; drive behavior through real user events rather than calling handlers.

**Avoid:** large snapshot tests, asserting on class names or markup structure.

## CLI tools and scripts

**Suite:** subprocess tests: run the real entry with args and stdin in a temp working directory.

**Probe:** no args, help flag, unknown flag, missing required flag, invalid values, stdin versus file input, exit codes (0 for success, non-zero for failure) with errors on stderr, stability of machine-readable output, idempotent re-run, missing or unwritable paths, path traversal in file arguments.

## Filesystem, config, and environment inputs

**Probe:** file missing, empty, unreadable, malformed (bad JSON/YAML/TOML), partially written, symlink, very large; config with unknown keys; env var unset, empty, invalid; defaults applied when absent; writes confined to the intended directory; atomic writes (no half-written file visible); concurrent writers.

Use temp directories and set the environment per test; restore it afterwards.

## Timers, queues, retries, and concurrency

**Suite:** deterministic tests with an injected or fake clock; for races, run the scenario repeatedly (for example 50 iterations) and assert the invariant each time.

**Probe:** retry and backoff bounds and give-up behavior; no unbounded queue growth; cancellation and cleanup (no leaked timers or listeners keeping the process alive); at-least-once duplicates are harmless; ordering within a key; shutdown drains or drops per spec.

## Anti-patterns (reject these)

- Tests generated by paraphrasing the implementation line by line.
- Asserting only that a function "was called" or "does not throw".
- Tests that pass with the implementation deleted or mutated.
- Over-mocking, so the test verifies only the mocks.
- Shared mutable fixtures and ordering dependence.
- Encoding an unspecified behavior as if it were required.
- Giant snapshot assertions of volatile output.
- Padding for coverage numbers.

## When to raise an Open Question instead of writing a test

- The plan does not say what happens for a reachable input class (for example "what does the store do with an event missing a type?").
- Two requirements conflict, or a requirement conflicts with an existing test.
- Fail-open versus fail-closed is not stated for a component that sits in a pipeline someone depends on.
- The correct behavior depends on a product decision, not an engineering one.
- The only governing expectation is tagged `[proposed]`.

State the entry point, the input class, and two or three candidate behaviors so the human can decide quickly.
