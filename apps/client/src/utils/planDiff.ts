/**
 * Plan Diff Utilities
 *
 * Core logic for parsing Mermaid diagrams, computing diffs between
 * current and proposed diagrams, and rendering combined diagrams
 * with color-coded diff states.
 */

// ============================================================================
// Types
// ============================================================================

/** Node information extracted from Mermaid diagram */
export interface NodeInfo {
  id: string;
  label: string;
  subgraph: string;
  shape?: string;
}

/** Edge information extracted from Mermaid diagram */
export interface EdgeInfo {
  source: string;
  target: string;
  label?: string;
  style?: string;
}

/** Parsed diagram structure */
export interface ParsedDiagram {
  nodes: Map<string, NodeInfo>;
  edges: EdgeInfo[];
}

/** Result of comparing two diagrams */
export interface DiagramDiff {
  added: Set<string>;
  removed: Set<string>;
  modified: Set<string>;
  unchanged: Set<string>;
}

/** Diff mode for rendering */
export type DiffMode = 'none' | 'overlay' | 'side-by-side' | 'code';

/** Color constants for diff states (Material Design palette) */
export const DIFF_COLORS = {
  added: '#4caf50',    // Green 500
  modified: '#ff9800', // Amber 500
  removed: '#f44336',  // Red 500
  unchanged: '#757575', // Grey 600
} as const;

// ============================================================================
// Mermaid Parser
// ============================================================================

/**
 * Parse a Mermaid flowchart diagram and extract nodes and edges.
 * Supports basic flowchart TD syntax with subgraphs.
 * Node IDs can contain letters, digits, underscores, hyphens, and dots.
 */
export function parseMermaidNodes(mermaidSource: string): ParsedDiagram {
  const nodes = new Map<string, NodeInfo>();
  const edges: EdgeInfo[] = [];

  // Remove markdown code fences if present
  let source = mermaidSource.trim();
  if (source.startsWith('```mermaid')) {
    const match = source.match(/```mermaid\n([\s\S]*?)\n```/);
    if (match) source = match[1].trim();
  }

  // Track current subgraph
  let currentSubgraph = 'root';
  const subgraphStack: string[] = ['root'];

  // Regex patterns for node IDs (allow hyphens, underscores, dots)
  // \w = [a-zA-Z0-9_], so we need [a-zA-Z0-9_\-.] for hyphens and dots
  const NODE_ID = '[a-zA-Z0-9_\\-.]+';
  const NODE_ID_CAPTURE = '(' + NODE_ID + ')';

  // First pass: join multiline statements
  // A node/edge definition can span multiple lines if the label contains newlines
  // We'll scan through the source and join lines that are part of the same statement
  const rawLines = source.split('\n');
  const lines: string[] = [];
  let continuationBuffer = '';

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue;

    continuationBuffer += (continuationBuffer ? '\n' : '') + line;

    // Check if this is a subgraph start/end or classDef - always single line
    const isSubgraphStart = /^subgraph\s+/.test(line);
    const isSubgraphEnd = line === 'end';
    const isClassDef = /^class(Def)?\s+/.test(line);
    const isCompleteStatement = isSubgraphStart || isSubgraphEnd || isClassDef;

    // Check if buffer contains a complete node definition (has closing bracket/paren)
    // For nodes with multiline labels, the closing bracket might be on a later line
    const hasOpeningBracket = /[\[\(\(]/.test(continuationBuffer);
    const hasClosingBracket = /[\]\)\)]/.test(continuationBuffer);

    // Check if buffer contains a complete edge definition
    // Edge: source --> target (possibly with |label| or : label)
    // The edge ends with the target node ID (word with allowed chars)
    // Check if buffer contains a complete edge definition
    // Edge: source --> target (possibly with |label| or : label)
    // The edge ends with the target node ID (word with allowed chars)
    // Must also account for pipe labels |...| which can span multiple lines
    const hasOpenPipe = continuationBuffer.includes('|') && (continuationBuffer.match(/\|/g) || []).length % 2 === 1;
    const hasEdge = /[\w\-\.]+\s*[-.=]+>\s*([\w\-\.]+|(\|.*\|)\s*[\w\-\.]+)/.test(continuationBuffer);

    // A statement is complete if:
    // 1. It's a subgraph/class statement (always single line)
    // 2. It's a node definition that has both opening and closing brackets
    // 3. It's an edge definition - but for edges with pipe labels, need closing |
    const isNodeComplete = hasOpeningBracket && hasClosingBracket;
    const isEdgeComplete = hasEdge && !hasOpenPipe;
    const isComplete = isCompleteStatement || isNodeComplete || isEdgeComplete;

    if (isComplete) {
      lines.push(continuationBuffer.trim());
      continuationBuffer = '';
    }
  }

  // Flush any remaining buffer
  if (continuationBuffer.trim()) {
    lines.push(continuationBuffer.trim());
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    // Handle subgraph start: `subgraph Name["Label"]`
    const subgraphStartMatch = trimmed.match(new RegExp(`^subgraph\\s+${NODE_ID_CAPTURE}\\s*\\[["']?([^"'\]]+)["']?\\]`));
    if (subgraphStartMatch) {
      currentSubgraph = subgraphStartMatch[1];
      subgraphStack.push(currentSubgraph);
      continue;
    }

    // Handle subgraph end
    if (trimmed === 'end') {
      subgraphStack.pop();
      currentSubgraph = subgraphStack[subgraphStack.length - 1] || 'root';
      continue;
    }

    // Handle classDef (styling) - skip for parsing
    if (trimmed.startsWith('classDef') || trimmed.startsWith('class ')) {
      continue;
    }

    // Handle node definitions with labels: `id["Label"]` or `id[Label]` or `id("Label")` or `id((Label))`
    // Use a simpler regex that matches the node ID at start of line, followed by bracket/paren
    const nodeIdMatch = trimmed.match(new RegExp(`^(${NODE_ID})\\s*[\\[\(\(]`));
    if (nodeIdMatch) {
      const nodeId = nodeIdMatch[1];
      // Extract label between first bracket/paren and matching closing bracket/paren
      // Find the first opening bracket/paren
      const firstBracket = trimmed.search(/[\[\(\(]/);
      if (firstBracket >= 0) {
        const closingBracket = trimmed.search(/[\]\)\)]/);
        if (closingBracket > firstBracket) {
          const label = trimmed.substring(firstBracket + 1, closingBracket).replace(/\\n/g, '\n');

          // Determine shape from brackets
          let shape = 'rect';
          const bracketPart = trimmed.substring(firstBracket, closingBracket + 1);
          if (bracketPart.startsWith('((')) shape = 'circle';
          else if (bracketPart.startsWith('(')) shape = 'rounded';
          else if (bracketPart.startsWith('[[')) shape = 'subroutine';
          else if (bracketPart.startsWith('[(')) shape = 'cylindrical';

          const logicalId = getLogicalNodeId(nodeId);
          nodes.set(logicalId, {
            id: logicalId,
            label,
            subgraph: currentSubgraph,
            shape,
          });
          continue;
        }
      }
      // Fallback if no label found
      const logicalId = getLogicalNodeId(nodeId);
      nodes.set(logicalId, {
        id: logicalId,
        label: nodeId,
        subgraph: currentSubgraph,
        shape: 'rect',
      });
      continue;
    }

    // Handle edges: `A --> B` or `A -.-> B` or `A ==> B` etc.
    // Also handle labeled edges: `A -->|label| B`
    const edgeMatch = trimmed.match(new RegExp(`^(${NODE_ID})\\s*([-.=]+>)\\s*(\\|.*?\\|)?\\s*(${NODE_ID})`));
    if (edgeMatch) {
      const [, source, style, labelPart, target] = edgeMatch;
      const label = labelPart ? labelPart.slice(1, -1) : undefined;
      edges.push({ source: getLogicalNodeId(source), target: getLogicalNodeId(target), label, style });
      continue;
    }

    // Handle edges with colon label: `A --> B : label`
    const edgeColonMatch = trimmed.match(new RegExp(`^(${NODE_ID})\\s*([-.=]+>)\\s*(${NODE_ID})\\s*:\\s*(.+)$`));
    if (edgeColonMatch) {
      const [, source, style, target, label] = edgeColonMatch;
      edges.push({ source: getLogicalNodeId(source), target: getLogicalNodeId(target), label, style });
      continue;
    }
  }

  return { nodes, edges };
}

/**
 * Normalize node ID for comparison.
 * Removes common prefixes and normalizes case.
 */
export function normalizeNodeId(id: string): string {
  // Remove common prefixes like "node-"
  return id.replace(/^node-/, '').toLowerCase();
}

/**
 * Get the logical node ID for a node (used as key in parsed diagram)
 */
function getLogicalNodeId(nodeId: string): string {
  return normalizeNodeId(nodeId);
}

/**
 * Check if two nodes are equivalent (same logical identity)
 */
export function nodesEquivalent(a: NodeInfo, b: NodeInfo): boolean {
  // Compare by normalized ID
  if (normalizeNodeId(a.id) !== normalizeNodeId(b.id)) return false;

  // Compare label (ignoring whitespace differences)
  if (a.label.trim() !== b.label.trim()) return false;

  // Compare subgraph
  if (a.subgraph !== b.subgraph) return false;

  return true;
}

/**
 * Create a signature for an edge for comparison
 */
function edgeSignature(edge: EdgeInfo): string {
  return `${edge.source}|${edge.target}|${edge.label || ''}|${edge.style || ''}`;
}

// ============================================================================
// Diagram Diff
// ============================================================================

/**
 * Compare two parsed diagrams and compute the diff.
 * Nodes are compared by normalized ID.
 * A node is "modified" if it exists in both but has different label or subgraph.
 */
export function diffDiagrams(current: ParsedDiagram, proposed: ParsedDiagram): DiagramDiff {
  const added = new Set<string>();
  const removed = new Set<string>();
  const modified = new Set<string>();
  const unchanged = new Set<string>();

  const currentIds = new Set(current.nodes.keys());
  const proposedIds = new Set(proposed.nodes.keys());

  // Find added and removed by node ID
  for (const id of proposedIds) {
    if (!currentIds.has(id)) {
      added.add(id);
    }
  }

  for (const id of currentIds) {
    if (!proposedIds.has(id)) {
      removed.add(id);
    }
  }

  // Find modified and unchanged (intersection)
  for (const id of currentIds) {
    if (proposedIds.has(id)) {
      const currentNode = current.nodes.get(id)!;
      const proposedNode = proposed.nodes.get(id)!;

      if (nodesEquivalent(currentNode, proposedNode)) {
        unchanged.add(id);
      } else {
        modified.add(id);
      }
    }
  }

  // Also check for edge differences that affect nodes
  const currentEdges = new Map(current.edges.map(e => [edgeSignature(e), e]));
  const proposedEdges = new Map(proposed.edges.map(e => [edgeSignature(e), e]));

  // Nodes connected to changed edges are modified
  for (const [sig, edge] of proposedEdges) {
    if (!currentEdges.has(sig)) {
      // New edge - mark both nodes as modified if they exist in both
      if (currentIds.has(edge.source) && proposedIds.has(edge.source)) modified.add(edge.source);
      if (currentIds.has(edge.target) && proposedIds.has(edge.target)) modified.add(edge.target);
    }
  }

  for (const [sig, edge] of currentEdges) {
    if (!proposedEdges.has(sig)) {
      // Removed edge - mark both nodes as modified if they exist in both
      if (currentIds.has(edge.source) && proposedIds.has(edge.source)) modified.add(edge.source);
      if (currentIds.has(edge.target) && proposedIds.has(edge.target)) modified.add(edge.target);
    }
  }

  // Remove from unchanged if marked modified
  for (const id of modified) {
    unchanged.delete(id);
  }

  return { added, removed, modified, unchanged };
}

// ============================================================================
// Combined Diagram Renderer
// ============================================================================

/**
 * Render a combined Mermaid diagram showing current vs proposed with diff styling.
 * Uses classDef for added/modified/removed nodes.
 */
export function renderPlanDiff(currentDiagram: string, proposedDiagram: string): string {
  // Parse both diagrams
  const current = parseMermaidNodes(currentDiagram);
  const proposed = parseMermaidNodes(proposedDiagram);

  // Compute diff
  const diff = diffDiagrams(current, proposed);

  // Build combined diagram using proposed as base (shows new structure)
  // but include removed nodes from current

  const allNodes = new Map<string, NodeInfo>();

  // Add all proposed nodes
  for (const [id, node] of proposed.nodes) {
    allNodes.set(id, node);
  }

  // Add removed nodes from current (so they appear in diff)
  for (const [id, node] of current.nodes) {
    if (!proposed.nodes.has(id)) {
      allNodes.set(id, node);
    }
  }

  // Generate Mermaid source
  let output = 'flowchart TD\n';

  // Group nodes by subgraph
  const subgraphNodes = new Map<string, Map<string, NodeInfo>>();
  for (const [id, node] of allNodes) {
    if (!subgraphNodes.has(node.subgraph)) {
      subgraphNodes.set(node.subgraph, new Map());
    }
    subgraphNodes.get(node.subgraph)!.set(id, node);
  }

  // Render subgraphs
  for (const [subgraphId, nodesInSubgraph] of subgraphNodes) {
    if (subgraphId === 'root') {
      // Nodes without subgraph
      for (const [id, node] of nodesInSubgraph) {
        output += `    ${id}["${escapeLabel(node.label)}"]\n`;
      }
    } else {
      // Find subgraph label from proposed or current
      const subgraphLabel = findSubgraphLabel(proposedDiagram, subgraphId)
        || findSubgraphLabel(currentDiagram, subgraphId)
        || subgraphId;
      output += `    subgraph ${subgraphId}["${subgraphLabel}"]\n`;
      for (const [id, node] of nodesInSubgraph) {
        output += `      ${id}["${escapeLabel(node.label)}"]\n`;
      }
      output += `    end\n`;
    }
  }

  // Render edges (from proposed)
  for (const edge of proposed.edges) {
    const labelPart = edge.label ? `|${edge.label}|` : '';
    output += `    ${edge.source} ${edge.style || '-->'} ${labelPart} ${edge.target}\n`;
  }

  // Add classDef for diff styling
  output += '\n';
  output += `    classDef added fill:${DIFF_COLORS.added},stroke:${DIFF_COLORS.added},color:#fff;\n`;
  output += `    classDef modified fill:${DIFF_COLORS.modified},stroke:${DIFF_COLORS.modified},color:#fff;\n`;
  output += `    classDef removed fill:${DIFF_COLORS.removed},stroke:${DIFF_COLORS.removed},color:#fff;\n`;
  output += `    classDef unchanged fill:${DIFF_COLORS.unchanged},stroke:${DIFF_COLORS.unchanged},color:#fff;\n`;

  // Apply classes to nodes
  const addedClasses = [...diff.added].join(',');
  const modifiedClasses = [...diff.modified].join(',');
  const removedClasses = [...diff.removed].join(',');
  const unchangedClasses = [...diff.unchanged].join(',');

  if (addedClasses) output += `    class ${addedClasses} added;\n`;
  if (modifiedClasses) output += `    class ${modifiedClasses} modified;\n`;
  if (removedClasses) output += `    class ${removedClasses} removed;\n`;
  if (unchangedClasses) output += `    class ${unchangedClasses} unchanged;\n`;

  return output;
}

/**
 * Escape label for Mermaid
 */
function escapeLabel(label: string): string {
  return label
    .replace(/"/g, '\\"')
    .replace(/\n/g, '<br/>');
}

/**
 * Find subgraph label from diagram source
 */
function findSubgraphLabel(source: string, subgraphId: string): string | null {
  const match = source.match(new RegExp(`subgraph\\s+${subgraphId}\\s*\\[["']?([^"'\]]+)["']?\\]`));
  return match ? match[1] : null;
}

// ============================================================================
// Utility: Load diagram from file
// ============================================================================

/**
 * Extract Mermaid code from a markdown file
 */
export function extractMermaidCode(markdown: string): string | null {
  const match = markdown.match(/```mermaid\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : null;
}

/**
 * Fetch diagram from server endpoint
 */
export async function fetchDiagram(diagramName: string): Promise<string> {
  const apiBase = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8081';
  const token = import.meta.env.VITE_TOKEN || 'zod-control-center-token';

  const response = await fetch(`${apiBase}/diagrams/${diagramName}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to load diagram: ${response.status}`);
  }

  const content = await response.text();
  const code = extractMermaidCode(content);
  if (!code) {
    throw new Error('No mermaid diagram found in file');
  }
  return code;
}

/**
 * Fetch proposed diagram from plan folder
 */
export async function fetchProposedDiagram(_planName: string): Promise<string | null> {
  // In a real implementation, this would fetch from the plan folder
  // For now, we'll use a local file approach
  try {
    // This would need a server endpoint or file system access
    // Placeholder for future implementation
    return null;
  } catch {
    return null;
  }
}