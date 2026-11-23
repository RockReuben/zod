# Tasks: Add Diagram Validation Endpoint

## Phase 1: Server - Diagram Validator Module

- [ ] Task 1.1: Create `apps/server/diagram_validator.py` with `validate_mermaid(diagram: str) -> tuple[bool, list[str]]` function (node: server)
- [ ] Task 1.2: Extract validation logic from `scripts/diagrams-check.py` into the new module (node: server)
- [ ] Task 1.3: Add unit tests for `diagram_validator.py` in `apps/server/tests/test_diagram_validator.py` (node: server)

## Phase 2: Server - Validation Endpoint

- [ ] Task 2.1: Add `POST /diagrams/validate` endpoint in `apps/server/server.py` (node: server)
- [ ] Task 2.2: Endpoint accepts JSON `{ "diagram": "mermaid content" }` and returns `{ "valid": true }` or `{ "valid": false, "errors": [...] }` (node: server)
- [ ] Task 2.3: Add auth check (shared token) to validation endpoint (node: server)
- [ ] Task 2.4: Add endpoint tests in `apps/server/tests/test_server.py` (node: server)

## Phase 3: Client - Diagram Panel Integration

- [ ] Task 3.1: Add "Validate Diagram" button to `DiagramPanel` component (node: client)
- [ ] Task 3.2: Implement validation API call in client store/actions (node: client)
- [ ] Task 3.3: Show validation result as toast notification (success/error) (node: client)
- [ ] Task 3.4: Add client tests for validation feature (node: client)

## Phase 4: Documentation

- [ ] Task 4.1: Update `docs/diagrams/README.md` with new endpoint documentation (node: planning)
- [ ] Task 4.2: Update `docs/plans/README.md` if needed (node: planning)