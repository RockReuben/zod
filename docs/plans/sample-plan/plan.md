# Sample Plan: Add Diagram Validation Endpoint

## Overview
Add a new `/diagrams/validate` endpoint to the event server that validates Mermaid diagram syntax without rendering. This is a lightweight check for CI pipelines.

## Assumptions
- The existing `diagrams-check.py` script can be reused as a library
- Validation should be fast (< 1 second)
- Only syntax validation, not semantic correctness

## Open Questions
- Should validation support multiple diagram formats (PlantUML, etc.)?
- Rate limiting for validation endpoint?

## Details
### Server Changes
1. Extract validation logic from `scripts/diagrams-check.py` into a reusable function in `apps/server/diagram_validator.py`
2. Add `POST /diagrams/validate` endpoint accepting `{ "diagram": "mermaid content" }`
3. Return `{ "valid": true }` or `{ "valid": false, "errors": [...] }`
4. Add unit tests for the validator and endpoint

### Client Changes
1. Add "Validate Diagram" button to DiagramPanel
2. Show validation result as toast notification

### Documentation
1. Update `docs/diagrams/README.md` with new endpoint usage