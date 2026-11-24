# System Overview Diagram

```mermaid
flowchart TD
    subgraph Agents["Claude Code Agents"]
        node-agent1["Agent 1
(worktree/pkg-a)"]
        node-agent2["Agent 2
(worktree/pkg-b)"]
        node-agentN["Agent N
(worktree/pkg-n)"]
    end

    subgraph Hooks["Hook Forwarders"]
        node-hooks[".claude/hooks/send_event.py"]
        node-check_inbox[".claude/hooks/check_inbox_stop.py"]
    end

    subgraph Server["Event Server (apps/server)"]
        node-server["HTTP POST /events
SQLite Database
(var/events.db)
WebSocket Broadcast
/ws
POST /messages
GET /messages/:target
POST /messages/consume
(atomic consume)
GET /diagrams/:name
GET /events
(historical)
GET /sessions
(list)
GET /code-graph
GET /code-graph/fingerprint
WS /ws/code-graph
Code Graph Engine
(code_graph.py)"]
    end

    subgraph Client["Web UI (apps/client)"]
        node-client["Timeline View
+ Filter Bar
Replay Controls
(Session Selector, Speed, Progress)"]
        node-codebase["Codebase View
Gource Tree Canvas
Agent Avatars
Activity Effects"]
    end

    subgraph Database["Database"]
        node-database["SQLite Database
(var/events.db)"]
    end

    subgraph Repo["Repository"]
        node-planning["diagram-map.yaml
docs/plans/
docs/diagrams/
system-overview.md"]
    end

    node-agent1 -.->|Hook Events
HTTP POST| node-hooks
    node-agent2 -.->|Hook Events
HTTP POST| node-hooks
    node-agentN -.->|Hook Events
HTTP POST| node-hooks

    node-hooks -->|POST /events| node-server
    node-server --> node-database
    node-database --> node-server
    node-server -.->|WebSocket
Event Stream| node-client
    node-server -.->|WS /ws/code-graph
Graph Delta| node-codebase
    node-client -->|GET /code-graph| node-server

    node-client -->|POST /messages| node-server
    node-server --> node-database

    node-check_inbox -->|POST /messages/consume| node-server
    node-server --> node-database
    node-database -.->|Stop Hook
Reads Inbox| node-check_inbox

    node-client -->|GET /diagrams/:name| node-server
    node-server --> node-planning

    classDef agent fill:#e8f4fd,stroke:#1a73e8,color:#1a73e8;
    classDef hook fill:#fff3e0,stroke:#f57c00,color:#f57c00;
    classDef server fill:#e8f5e9,stroke:#2e7d32,color:#2e7d32;
    classDef client fill:#f3e5f5,stroke:#7b1fa2,color:#7b1fa2;
    classDef codebase fill:#fef3c7,stroke:#f59e0b,color:#92400e;
    classDef database fill:#fce4ec,stroke:#c2185b,color:#c2185b;
    classDef repo fill:#fafafa,stroke:#757575,color:#757575;

    class node-agent1,node-agent2,node-agentN agent;
    class node-hooks,node-check_inbox hook;
    class node-server server;
    class node-client client;
    class node-codebase codebase;
    class node-database database;
    class node-planning repo;
```

**Node IDs for diagram-map.yaml:**
- `hooks` - Hook forwarder script (node-hooks)
- `server` - Event server (node-server)
- `database` - SQLite database (node-database)
- `client` - Web UI client (node-client)
- `codebase` - Codebase view components (node-codebase)
- `planning` - Repository planning files (node-planning)