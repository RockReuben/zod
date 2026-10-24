# CLAUDE.md

See zod-control-center.md in docs/plans to see what we're building here.

## Ground Rules

- This document is the single source of truth for what is done, what is next, and why. If the code and this document disagree, stop and record an Open Question.
- Work on **one task at a time**, in order. Do not skip ahead and do not start a task whose dependencies are not `done`.
- A task is `done` only when its **Done when** check passes and you actually ran it. Never mark a task done on a guess.
- If you are unsure about anything, do not guess. Add an entry to Section 6 (Open Questions) and stop work on that task.
- If the same failure happens three times, stop. Write the blocker in the Session Log and end the session.
- Make small commits. Commit message format: `P1.3: short description`.
- Do not change task definitions, Done-when checks, or these ground rules. If a task seems wrong, add an Open Question.
- New ideas go in Section 8 (Backlog), never into the current phase.
- Never put secrets in the repo. Bind servers to localhost only.

## Session Protocol

Follow the session protocol in `docs/plans/zod-control-center.md` Section 2.

## Living Diagrams

The repository maintains living architecture diagrams in `docs/diagrams/` as Mermaid files. These diagrams are the source of truth for the system architecture and must be kept in sync with the code.

### Diagram Index

| Diagram File | Description | Node IDs |
|--------------|-------------|----------|
| system-overview.md | High-level system components and data flow | hooks, server, database, client |

### When to Update Diagrams

Update diagrams when:
- Adding, removing, or renaming a top-level directory under `apps/`, `.claude/`, or `docs/`
- Changing the data flow between major components
- Adding a new service, queue, database, or external dependency
- Modifying the hook event pipeline

### Smallest Edit Rule

When updating a diagram, make the smallest possible change that accurately reflects the code change. Do not reformat unrelated parts of the diagram.

### Mermaid Conventions

- Use `flowchart TD` for top-down flow diagrams
- Node IDs use kebab-case (e.g., `event-server`, `hook-forwarder`)
- Group related nodes with `subgraph` labels
- Use `-->` for data flow, `-.->` for async/notification flow
- Style: `classDef primary fill:#e8f4fd,stroke:#1a73e8;` for primary components

### Diagram Change Summary

At the end of every session, include a line in the session log:
```
Diagrams changed: <file names, or "No diagram changes needed">
```