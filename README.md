# Zod Control Center

A local web app that lets one person watch and steer a team of Claude Code agents working in a monorepo. It shows what each agent is doing in real time, renders the repository's architecture diagrams with live highlights on whatever is being changed, lets the person talk to agents by text or voice, and has a planning mode where proposed changes are drafted as a visual diff against the current architecture before any code is written.

## Diagram Mapping System

The `diagram-map.yaml` file at the repository root defines mappings from file globs to diagram nodes, enabling live highlighting, drift detection, and navigation from diagram to source code.

### diagram-map.yaml Schema

Each entry in the YAML list is an object with three required fields:

| Field     | Type   | Required | Description                                                                                                           |
| --------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `glob`    | string | Yes      | Glob pattern (relative to repo root) matching source files. Uses standard glob syntax (`*`, `**`, `?`).               |
| `diagram` | string | Yes      | Path to the Mermaid diagram file (relative to repo root), e.g., `docs/diagrams/system-overview.md`                    |
| `node`    | string | Yes      | Node ID within the target diagram that represents this code area. Must match a node ID in the diagram's Mermaid code. |

**Matching Algorithm:**

1. Match file path against all glob patterns in `diagram-map.yaml`.
2. **Most specific glob wins** (e.g. `apps/server/special/*` > `apps/server/**`).
3. If specificities are equal, top-to-bottom file order in `diagram-map.yaml` resolves tiebreakers (first match wins).
4. Glob patterns: `**` = any directories, `*` = any chars except `/`, `?` = single char except `/`

### Current Mapping (diagram-map.yaml)

```yaml
# Diagram Map
# Maps file globs to diagram files and node IDs within those diagrams.
# Most specific glob wins; top-to-bottom order resolves tiebreakers.

- glob: 'apps/server/**'
  diagram: 'docs/diagrams/system-overview.md'
  node: 'server'

- glob: 'apps/client/**'
  diagram: 'docs/diagrams/system-overview.md'
  node: 'client'

- glob: '.claude/hooks/**'
  diagram: 'docs/diagrams/system-overview.md'
  node: 'hooks'

- glob: 'docs/diagrams/**'
  diagram: 'docs/diagrams/system-overview.md'
  node: 'database'

- glob: 'docs/plans/**'
  diagram: 'docs/diagrams/system-overview.md'
  node: 'planning'
```

**Examples:**

- `apps/server/server.py` → matches 1st entry → node `server` in `system-overview.md`
- `apps/client/src/components/TimelineLane.tsx` → matches 2nd entry → node `client`
- `.claude/hooks/send_event.py` → matches 3rd entry → node `hooks`
- `docs/diagrams/system-overview.md` → matches 4th entry → node `database`
- `docs/plans/my-plan/plan.md` → matches 5th entry → node `planning`

### Adding New Mappings

1. Identify or create a diagram in `docs/diagrams/`
2. Add a node ID to the diagram's Mermaid code (kebab-case, e.g., `api-gateway`)
3. Add entry to `diagram-map.yaml` **before** less specific entries:
   ```yaml
   - glob: 'apps/api/**'
     diagram: 'docs/diagrams/system-overview.md'
     node: 'api-gateway'
   ```

### Node ID Conventions

- Use **kebab-case**: `my-component`, `api-gateway`, `event-processor`
- Must exactly match node ID in Mermaid diagram (the bare word before `[label]`):
  ```mermaid
  flowchart TD
      api-gateway[API Gateway] --> database[Database]
  ```
  Node IDs here: `api-gateway`, `database`

## Diagram Files

| Diagram                            | Purpose                                    |
| ---------------------------------- | ------------------------------------------ |
| `docs/diagrams/system-overview.md` | High-level system components and data flow |

## Quick Start

```bash
# Install client dependencies
cd apps/client && npm install

# Start event server (Terminal 1)
python3 apps/server/server.py

# Start client dev server (Terminal 2)
cd apps/client && npm run dev

# Post test events (Terminal 3)
python3 test.py
```

## Project Structure

```
apps/
├── server/          # Python aiohttp event server
│   └── server.py
└── client/          # React + Vite + TypeScript dashboard
    └── src/
.claude/
├── hooks/
│   └── send_event.py   # Hook forwarder (port 8081)
docs/
├── diagrams/
│   ├── system-overview.md
│   └── ...
├── plans/
diagram-map.yaml     # Source-to-diagram mappings
test.py              # Test event generator
```

## Testing

## Style

#### Formatter

Uses prettier on-save. Uses the below settings in .editorconfig.

```
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

#### Linter

Uses `ruff`.
