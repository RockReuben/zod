import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface CodeNode {
  id: string;
  path: string;
  name: string;
  type: 'file' | 'dir';
  language: string;
  loc: number;
  imports: string[];
  exports: string[];
  mtime: number;
  depth: number;
  parent: string | null;
  children: string[];
  agent_activity: Array<{
    agent_name: string;
    event_type: 'read' | 'write' | 'search' | 'error';
    timestamp: number;
  }>;
}

export interface CodeEdge {
  id: string;
  source: string;
  target: string;
  type: 'import' | 'reference' | 'hierarchy';
  label: string;
}

export interface GraphDelta {
  added_nodes: CodeNode[];
  removed_node_ids: string[];
  updated_nodes: CodeNode[];
  added_edges: CodeEdge[];
  removed_edge_ids: string[];
  updated_edges: CodeEdge[];
  timestamp: number;
}

export type ViewMode = 'gource' | 'voronoi' | 'treemap' | 'depgraph' | 'city3d';

export interface CodeGraphState {
  // Data
  nodes: Map<string, CodeNode>;
  edges: Map<string, CodeEdge>;
  fingerprint: string;

  // Sync status
  syncStatus: 'synced' | 'stale' | 'resyncing' | 'disconnected';

  // View mode
  selectedMode: ViewMode;

  // Connection
  isConnected: boolean;
  lastFingerprintCheck: number;

  // Actions
  applySnapshot: (data: { nodes: Record<string, CodeNode>; edges: Record<string, CodeEdge>; fingerprint: string }) => void;
  applyDelta: (delta: GraphDelta) => void;
  setMode: (mode: ViewMode) => void;
  requestResync: () => void;
  setSyncStatus: (status: CodeGraphState['syncStatus']) => void;
  setConnected: (connected: boolean) => void;
  setFingerprintCheck: (timestamp: number) => void;
  clear: () => void;
}

const initialState = {
  nodes: new Map<string, CodeNode>(),
  edges: new Map<string, CodeEdge>(),
  fingerprint: '',
  syncStatus: 'disconnected' as const,
  selectedMode: 'gource' as ViewMode,
  isConnected: false,
  lastFingerprintCheck: 0,
};

export const useCodeGraphStore = create<CodeGraphState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    applySnapshot: (data) => {
      const nodes = new Map<string, CodeNode>(Object.entries(data.nodes));
      const edges = new Map<string, CodeEdge>(Object.entries(data.edges));
      set({
        nodes,
        edges,
        fingerprint: data.fingerprint,
        syncStatus: 'synced',
        lastFingerprintCheck: Date.now(),
      });
    },

    applyDelta: (delta) => {
      const { nodes, edges } = get();

      // Added nodes
      for (const node of delta.added_nodes) {
        nodes.set(node.id, node);
      }

      // Removed nodes
      for (const nodeId of delta.removed_node_ids) {
        nodes.delete(nodeId);
      }

      // Updated nodes
      for (const node of delta.updated_nodes) {
        if (nodes.has(node.id)) {
          nodes.set(node.id, node);
        }
      }

      // Added edges
      for (const edge of delta.added_edges) {
        edges.set(edge.id, edge);
      }

      // Removed edges
      for (const edgeId of delta.removed_edge_ids) {
        edges.delete(edgeId);
      }

      // Updated edges
      for (const edge of delta.updated_edges) {
        if (edges.has(edge.id)) {
          edges.set(edge.id, edge);
        }
      }

      set({
        nodes: new Map(nodes),
        edges: new Map(edges),
        syncStatus: 'synced',
      });
    },

    setMode: (mode) => set({ selectedMode: mode }),

    requestResync: () => set({ syncStatus: 'resyncing' }),

    setSyncStatus: (status) => set({ syncStatus: status }),

    setConnected: (connected) => set({ isConnected: connected }),

    setFingerprintCheck: (timestamp) => set({ lastFingerprintCheck: timestamp }),

    clear: () => set(initialState),
  }))
);

// Selectors for common use cases
export const selectNodes = (state: CodeGraphState) => state.nodes;
export const selectEdges = (state: CodeGraphState) => state.edges;
export const selectFingerprint = (state: CodeGraphState) => state.fingerprint;
export const selectSyncStatus = (state: CodeGraphState) => state.syncStatus;
export const selectMode = (state: CodeGraphState) => state.selectedMode;
export const selectIsConnected = (state: CodeGraphState) => state.isConnected;

// Get nodes as array for rendering (stable reference via cache)
let nodesArrayCache: CodeNode[] | null = null;
let nodesMapCache: Map<string, CodeNode> | null = null;

export const selectNodesArray = (state: CodeGraphState) => {
  if (nodesMapCache !== state.nodes) {
    nodesMapCache = state.nodes;
    nodesArrayCache = Array.from(state.nodes.values());
  }
  return nodesArrayCache!;
};

let edgesArrayCache: CodeEdge[] | null = null;
let edgesMapCache: Map<string, CodeEdge> | null = null;

export const selectEdgesArray = (state: CodeGraphState) => {
  if (edgesMapCache !== state.edges) {
    edgesMapCache = state.edges;
    edgesArrayCache = Array.from(state.edges.values());
  }
  return edgesArrayCache!;
};

// Get only file nodes (for leaf rendering)
export const selectFileNodes = (state: CodeGraphState) =>
  Array.from(state.nodes.values()).filter((n) => n.type === 'file');

// Get only directory nodes (for branch rendering)
export const selectDirNodes = (state: CodeGraphState) =>
  Array.from(state.nodes.values()).filter((n) => n.type === 'dir');

// Get hierarchy edges
export const selectHierarchyEdges = (state: CodeGraphState) =>
  Array.from(state.edges.values()).filter((e) => e.type === 'hierarchy');

// Get import edges
export const selectImportEdges = (state: CodeGraphState) =>
  Array.from(state.edges.values()).filter((e) => e.type === 'import');