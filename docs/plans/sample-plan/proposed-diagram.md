# Proposed System Overview (with Diagram Validation)

```mermaid
flowchart TD
    subgraph Agents["Claude Code Agents"]
        Agent1["Agent 1
(worktree/pkg-a)"]
        Agent2["Agent 2
(worktree/pkg-b)"]
        AgentN["Agent N
(worktree/pkg-n)"]
    end

    subgraph Hooks["Hook Forwarders"]
        SendEvent[".claude/hooks/send_event.py"]
        CheckInbox[".claude/hooks/check_inbox_stop.py"]
    end

    subgraph Server["Event Server (apps/server)"]
        Auth["POST /auth/login
POST /auth/refresh"]
        Events["POST /events
WebSocket /ws
GET /events
GET /sessions"]
        Messages["POST /messages
GET /messages/:target
POST /messages/consume
(atomic consume)"]
        Diagrams["GET /diagrams/:name
POST /diagrams/validate"]
        Validator["DiagramValidator
(apps/server/diagram_validator.py)"]
    end

    subgraph Client["Web UI (apps/client)"]
        Login["Login Page"]
        Dashboard["Timeline View
+ Filter Bar
Replay Controls
Diagram Panel
+ Validate Button"]
    end

    subgraph Database["Database"]
        DB["SQLite Database
(var/events.db)"]
    end

    subgraph Repo["Repository"]
        Planning["diagram-map.yaml
docs/plans/
docs/diagrams/
system-overview.md"]
    end

    Agent1 -.->|Hook Events
HTTP POST| SendEvent
    Agent2 -.->|Hook Events
HTTP POST| SendEvent
    AgentN -.->|Hook Events
HTTP POST| SendEvent

    SendEvent -->|POST /events| Events
    Events --> DB
    DB --> Events

    Events -.->|WebSocket
Event Stream| Dashboard

    Dashboard -->|POST /messages| Messages
    Messages --> DB

    CheckInbox -->|POST /messages/consume| Messages
    Messages --> DB
    DB -.->|Stop Hook
Reads Inbox| CheckInbox

    Dashboard -->|GET /diagrams/:name| Diagrams
    Dashboard -->|POST /diagrams/validate| Diagrams
    Diagrams --> Validator
    Validator -.->|Reads| Planning
    Diagrams -.->|Serves| Planning

    classDef agent fill:#e8f4fd,stroke:#1a73e8,color:#1a73e8;
    classDef hook fill:#fff3e0,stroke:#f57c00,color:#f57c00;
    classDef server fill:#e8f5e9,stroke:#2e7d32,color:#2e7d32;
    classDef client fill:#f3e5f5,stroke:#7b1fa2,color:#7b1fa2;
    classDef database fill:#fce4ec,stroke:#c2185b,color:#c2185b;
    classDef repo fill:#fafafa,stroke:#757575,color:#757575;

    class Agent1,Agent2,AgentN agent;
    class SendEvent,CheckInbox hook;
    class Auth,Events,Messages,Diagrams,Validator server;
    class Login,Dashboard client;
    class DB database;
    class Planning repo;
```

**Node IDs for diagram-map.yaml (unchanged):**
- `hooks` - Hook forwarder scripts (SendEvent, CheckInbox)
- `server` - Event server (Auth, Events, Messages, Diagrams, Validator)
- `database` - SQLite database (DB)
- `client` - Web UI client (Login, Dashboard)
- `planning` - Repository planning files (Planning)