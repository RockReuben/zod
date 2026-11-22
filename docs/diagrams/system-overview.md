# System Overview Diagram

```mermaid
flowchart TD
    subgraph Agents["Claude Code Agents"]
        A1["Agent 1\n(worktree/pkg-a)"]
        A2["Agent 2\n(worktree/pkg-b)"]
        A3["Agent N\n(worktree/pkg-n)"]
    end

    subgraph Hooks["Hook Forwarders"]
        H1[".claude/hooks/send_event.py"]
    end

    subgraph Server["Event Server (apps/server)"]
        S1["HTTP POST /events"]
        S2["SQLite Database\n(var/events.db)"]
        S3["WebSocket Broadcast\n/ws"]
        S4["POST /messages\nGET /messages/:target"]
        S5["GET /diagrams/:name"]
        S6["GET /events\n(historical)"]
        S7["GET /sessions\n(list)"]
    end

    subgraph Client["Web UI (apps/client)"]
        C1["Timeline View\n+ Filter Bar"]
        C2["Replay Controls\n(Session Selector, Speed, Progress)"]
    end

    subgraph Repo["Repository"]
        R1["docs/diagrams/\nsystem-overview.md"]
        R2["diagram-map.yaml"]
        R3["docs/plans/"]
    end

    A1 -.->|Hook Events\nHTTP POST| H1
    A2 -.->|Hook Events\nHTTP POST| H1
    A3 -.->|Hook Events\nHTTP POST| H1

    H1 -->|POST /events| S1
    S1 --> S2
    S2 --> S3
    S3 -.->|WebSocket\nEvent Stream| C1

    C1 -->|POST /messages| S4
    S4 --> S2

    S2 -.->|Stop Hook\nReads Inbox| H1

    C1 -->|GET /diagrams/:name| S5
    S5 --> R1

    C2 -->|GET /sessions| S7
    C2 -->|GET /events?session_id=...| S6
    S6 --> S2
    S7 --> S2

    classDef agent fill:#e8f4fd,stroke:#1a73e8,color:#1a73e8;
    classDef hook fill:#fff3e0,stroke:#f57c00,color:#f57c00;
    classDef server fill:#e8f5e9,stroke:#2e7d32,color:#2e7d32;
    classDef client fill:#f3e5f5,stroke:#7b1fa2,color:#7b1fa2;
    classDef repo fill:#fafafa,stroke:#757575,color:#757575;

    class A1,A2,A3 agent;
    class H1 hook;
    class S1,S2,S3,S4,S5,S6,S7 server;
    class C1,C2 client;
    class R1,R2,R3 repo;
```

**Node IDs for diagram-map.yaml:**
- `hooks` - Hook forwarder script
- `server` - Event server (HTTP, WebSocket, Database)
- `database` - SQLite database
- `client` - Web UI client
- `timeline` - Timeline view panel