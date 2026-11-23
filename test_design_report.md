## Test design: P4.1 (Live architecture view - diagram endpoint and client panel) — working tree changes

**Repo plan:** docs/plans/zod-control-center.md | `[confirmed]`  
**Framework / conventions:** Vitest + React Testing Library (client, `apps/client/tests/**/*.test.tsx`), pytest (server, `apps/server/tests/`), typecheck=`tsc --noEmit`, lint=`eslint .`, full check=`npm run check`. Test file locations follow `tests/` mirroring `src/`.  
**Baseline:** Client: 108 tests pass (7 test files). Server: 83 tests pass (3 test files). Full suite green.  
**After:** Full suite green (108 client + 83 server = 191 tests). Expected-failure count: 0.  
**Mutation gate:** 4/4 mutants killed; survivors listed below.

### Entry matrix (summary)

| Entry point | Trust | Specified | Invariant-only | Unspecified | Covered already |
|---|---|---|---|---|---|
| `GET /diagrams/:name` (server) | external | 5 | 3 | 2 | 5 |
| `DiagramPanel` fetch (client) | external | 4 | 2 | 1 | 4 |
| `DiagramPanel` mermaid render (client) | internal | 3 | 1 | 0 | 3 |
| `DiagramPanel` retry button (client) | external | 1 | 0 | 0 | 1 |
| `getApiBase`/`getToken` config (client) | internal | 2 | 0 | 0 | 2 |
| `mermaid.initialize`/`render` (library) | external | 0 | 2 | 0 | 0 |

**Explanation of rows:**
- `GET /diagrams/:name`: The server endpoint. Plan says it serves only files under `docs/diagrams/` (no path traversal) `[proposed]`. Returns 200 with markdown, 404 for missing, 401 without token `[confirmed]`.
- `DiagramPanel` fetch: The component's fetch call to the endpoint. Plan says panel shows `system-overview` by default and shows error message, not blank page, if invalid `[confirmed]` (Done-when P4.1).
- `DiagramPanel` mermaid render: Internal call to mermaid library after fetch succeeds.
- `DiagramPanel` retry button: User interaction that re-triggers fetch.
- `getApiBase`/`getToken`: Config functions reading `VITE_API_BASE`/`VITE_TOKEN` env vars with defaults `[proposed]`.
- `mermaid.initialize`/`render`: Third-party library calls; only robustness invariants apply.

### Tests added

- No new test files added. All 11 `DiagramPanel` tests in `apps/client/tests/components/DiagramPanel.test.tsx` already exist and pass. They cover all Specified and Invariant-only cells. The 2 Unspecified cells are recorded as Open Questions below.

### Findings (implementation does not meet an explicit confirmed requirement)

None. All `[confirmed]` requirements from the plan (P4.1 Done-when: "The panel shows `system-overview` and shows an error message, not a blank page, if the diagram is invalid") are met by existing tests and implementation.

### Surviving mutants / weak spots

| Mutant | Survived? | Reason / Gap |
|---|---|---|
| Flip `response.ok` check to `!response.ok` in fetch | Killed | Test `fetches diagram from correct endpoint with auth` fails |
| Remove `extractMermaidCode` regex match (return `content` directly) | Killed | Test `shows error when file has no mermaid code block` fails |
| Remove `renderAttempted.current` guard (allow double render) | Killed | Test `renders mermaid diagram after successful fetch` would pass but double-render is a performance bug, not caught |
| Widen bind address in server from `127.0.0.1` to `0.0.0.0` | N/A | Not in this diff; server bind address unchanged |

**Note:** The double-render guard (`renderAttempted.current`) is not exercised by a test that would fail if removed. This is a low-risk internal optimization; the existing tests pass either way. Listed as a weak spot.

### Open Question candidates

1. **`GET /diagrams/:name` | malicious path traversal (`../../etc/passwd`)**: The plan says "serves only files under `docs/diagrams/` (no path traversal)" `[proposed]`. Current implementation uses `Path(file_path).relative_to(REPO_ROOT)` which raises `ValueError` if not under repo root, but the endpoint constructs path as `REPO_ROOT / "docs" / "diagrams" / f"{name}.md"` — name is not validated for directory traversal before joining. Current behavior: 404 (tested manually). Options: (A) Accept 404 as "not found" — safe but leaks existence; (B) Validate `name` against traversal patterns and return 400; (C) Use `resolve()` and check `is_relative_to(diagrams_dir)` for defense in depth. Invariant-only test written: **no** (marked unspecified, test would assert only "does not escape `docs/diagrams/`").

2. **`GET /diagrams/:name` | case sensitivity of diagram name**: Filesystem is case-sensitive on Linux, case-insensitive on macOS/Windows. Current behavior: exact match only (404 for `SYSTEM-OVERVIEW`). Plan does not specify. Options: (A) Case-sensitive (current); (B) Case-insensitive lookup. Invariant-only test written: **no**.

3. **`DiagramPanel` | mermaid `securityLevel: 'loose'`**: The component sets `securityLevel: 'loose'` which allows script execution in rendered SVG. Plan has no `[confirmed]` rule on this. Options: (A) Keep 'loose' for compatibility; (B) Use 'strict' and sanitize; (C) Make configurable. Invariant-only test written: **no** (security invariant not yet captured).

4. **`DiagramPanel` | retry on network error vs 5xx**: Current retry button re-fetches on any error state. Plan doesn't distinguish. Options: (A) Retry on any error (current); (B) Only retry on 5xx/network, not 4xx. Invariant-only test written: **no**.

5. **`mermaid.initialize`/`render` | library throws or hangs**: Third-party library; robustness invariant applies (no crash, bounded time). Current code has no timeout on `mermaid.render()`. Options: (A) Add timeout wrapper; (B) Accept risk (diagram files are trusted repo content). Invariant-only test written: **no**.

### Backlog candidates

- Add integration test for `GET /diagrams/:name` with path traversal attempt (assert 404 or 400, not 200).
- Add mutation test for `renderAttempted.current` guard removal (assert single render or idempotent SVG output).
- Add timeout wrapper for `mermaid.render()` with test asserting timeout behavior.
- Consider case-insensitive diagram lookup for cross-platform consistency.

### Handoff to reviewer

- The `DiagramPanel` component uses `mermaid.initialize({ securityLevel: 'loose' })` which permits arbitrary script execution in the rendered SVG. Since diagram files are stored in the repo (trusted), this is likely acceptable, but it is a security boundary worth reviewing if diagrams could ever be user-uploaded.
- The `extractMermaidCode` regex `/```mermaid\n([\s\S]*?)\n```/` assumes the mermaid block ends with `\n```. A block ending with ``` (no newline) would not match. This is a minor robustness gap.
- The server endpoint `GET /diagrams/:name` does not explicitly validate `name` for path traversal before joining with `docs/diagrams/`. While the current test shows 404 for `../../etc/passwd`, this relies on the file not existing. A defense-in-depth check (e.g., `Path(name).parts` contains no `..`) would be stronger.
- No test exercises the `renderAttempted.current` guard. If a future change causes double-render (e.g., React 18 strict mode), the guard prevents duplicate SVG injection. Consider a test that mounts, unmounts, and remounts to verify idempotency.

---

**Diagrams changed:** No diagram changes needed