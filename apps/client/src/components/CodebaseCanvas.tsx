import { useEffect, useRef } from 'react';
import { useCodeGraphStore, selectNodesArray, selectEdgesArray, selectMode, selectSyncStatus, CodeNode, CodeEdge } from '../stores/codeGraph';
import { CameraController, Camera, Viewport } from '../fx/CameraController';
import { motionConfig } from '../fx/motionConfig';

interface CodebaseCanvasProps {
  /** Container ref for canvas sizing */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Camera controller instance (shared with DiagramPanel) */
  cameraController?: CameraController;
  /** Callback when camera changes */
  onCameraChange?: (camera: Camera) => void;
  /** Enable/disable effects */
  enabled?: boolean;
  /** Reduced motion preference */
  reducedMotion?: boolean;
}

// Gource-style radial tree layout constants
const RADIUS_STEP = 120; // pixels per depth level
const MIN_RADIUS = 40; // center empty space
const DIR_NODE_RADIUS = 8; // directory node visual radius
const FILE_NODE_BASE_RADIUS = 3; // base file node radius
const FILE_NODE_LOC_SCALE = 0.8; // sqrt(LOC) multiplier
const MAX_FILE_NODE_RADIUS = 20;
const AGENT_AVATAR_RADIUS = 6;

interface LayoutNode extends CodeNode {
  // Computed layout properties
  angle: number; // radians
  radius: number; // distance from center
  x: number; // canvas x
  y: number; // canvas y
  // For agent avatar animation
  targetNodeId?: string;
  avatarProgress?: number; // 0-1 along path to target
}

interface AgentAvatar {
  agentName: string;
  color: string;
  currentNodeId: string;
  targetNodeId: string | null;
  progress: number; // 0-1 along current edge
  trail: Array<{ x: number; y: number; timestamp: number }>;
}

function computeRadialLayout(
  nodes: CodeNode[],
  edges: CodeEdge[],
  centerX: number,
  centerY: number
): Map<string, LayoutNode> {
  const layout = new Map<string, LayoutNode>();
  const dirNodes = nodes.filter((n) => n.type === 'dir');
  const fileNodes = nodes.filter((n) => n.type === 'file');
  const hierarchyEdges = edges.filter((e) => e.type === 'hierarchy');

  // Build adjacency for tree traversal
  const childrenMap = new Map<string, string[]>();
  for (const edge of hierarchyEdges) {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    childrenMap.get(edge.source)!.push(edge.target);
  }

  // Calculate subtree sizes for angle allocation
  const subtreeSize = new Map<string, number>();

  function calcSize(nodeId: string): number {
    if (subtreeSize.has(nodeId)) return subtreeSize.get(nodeId)!;
    const children = childrenMap.get(nodeId) || [];
    let size = 1; // count self
    for (const childId of children) {
      size += calcSize(childId);
    }
    subtreeSize.set(nodeId, size);
    return size;
  }

  // Find root (directory with no parent in hierarchy)
  let rootId: string | null = null;
  for (const node of dirNodes) {
    const hasParent = hierarchyEdges.some((e) => e.target === node.id);
    if (!hasParent) {
      rootId = node.id;
      break;
    }
  }
  if (!rootId && dirNodes.length > 0) {
    rootId = dirNodes[0].id;
  }

  // Recursive layout - nested function to capture all needed variables
  function computeLayoutNode(
    nodeId: string,
    startAngle: number,
    endAngle: number,
    depth: number
  ) {
    const node = nodes.find((n: CodeNode) => n.id === nodeId);
    if (!node) return;

    const angle = (startAngle + endAngle) / 2;
    const radius = MIN_RADIUS + depth * RADIUS_STEP;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    const layoutNode: LayoutNode = {
      ...node,
      angle,
      radius,
      x,
      y,
    };
    layout.set(nodeId, layoutNode);

    // Layout children
    const children = childrenMap.get(nodeId) || [];
    if (children.length > 0) {
      const totalSize = children.reduce((sum: number, childId: string) => sum + (subtreeSize.get(childId) || 1), 0);
      let currentAngle = startAngle;
      for (const childId of children) {
        const childSize = subtreeSize.get(childId) || 1;
        const childAngleSpan = (endAngle - startAngle) * (childSize / totalSize);
        const childStart = currentAngle;
        const childEnd = currentAngle + childAngleSpan;
        computeLayoutNode(childId, childStart, childEnd, depth + 1);
        currentAngle = childEnd;
      }
    }
  }

  if (rootId) {
    calcSize(rootId);
    computeLayoutNode(rootId, -Math.PI, Math.PI, 0);
  }

  // Layout file nodes (attach to their parent directory)
  for (const fileNode of fileNodes) {
    const parentLayout = layout.get(fileNode.parent || '');
    if (parentLayout) {
      // Place file node slightly further out on same angle
      const radius = parentLayout.radius + RADIUS_STEP * 0.6;
      const x = centerX + Math.cos(parentLayout.angle) * radius;
      const y = centerY + Math.sin(parentLayout.angle) * radius;

      layout.set(fileNode.id, {
        ...fileNode,
        angle: parentLayout.angle,
        radius,
        x,
        y,
      });
    }
  }

  return layout;
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: LayoutNode,
  camera: Camera,
  viewport: Viewport,
  isHighlighted: boolean = false
) {
  // Transform to screen coordinates
  const screenX = node.x * camera.k + camera.x;
  const screenY = node.y * camera.k + camera.y;

  // Skip if off-screen (with margin)
  const margin = 50 / camera.k;
  if (screenX < -margin || screenX > viewport.w + margin || screenY < -margin || screenY > viewport.h + margin) {
    return;
  }

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.scale(camera.k, camera.k);

  if (node.type === 'dir') {
    // Directory: circle with border
    ctx.beginPath();
    ctx.arc(0, 0, DIR_NODE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isHighlighted ? '#4ade80' : '#64748b';
    ctx.fill();
    ctx.strokeStyle = isHighlighted ? '#22c55e' : '#475569';
    ctx.lineWidth = isHighlighted ? 2 / camera.k : 1 / camera.k;
    ctx.stroke();

    // Label
    if (camera.k > 0.5) {
      ctx.font = `${Math.max(10 / camera.k, 8)}px monospace`;
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, 0, -DIR_NODE_RADIUS - 4 / camera.k);
    }
  } else {
    // File: circle sized by LOC
    const locRadius = Math.min(
      FILE_NODE_BASE_RADIUS + Math.sqrt(Math.max(0, node.loc)) * FILE_NODE_LOC_SCALE,
      MAX_FILE_NODE_RADIUS
    );

    // Language color hint
    const langColors: Record<string, string> = {
      typescript: '#3178c6',
      javascript: '#f7df1e',
      python: '#3776ab',
      json: '#000000',
      markdown: '#083fa1',
      yaml: '#cb171e',
      shell: '#89e051',
    };
    const fillColor = langColors[node.language] || '#64748b';

    ctx.beginPath();
    ctx.arc(0, 0, locRadius, 0, Math.PI * 2);
    ctx.fillStyle = isHighlighted ? '#4ade80' : fillColor;
    ctx.globalAlpha = isHighlighted ? 1 : 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = isHighlighted ? '#22c55e' : '#475569';
    ctx.lineWidth = isHighlighted ? 2 / camera.k : 0.5 / camera.k;
    ctx.stroke();

    // Label for larger files
    if (camera.k > 0.8 && locRadius > 6) {
      ctx.font = `${Math.max(9 / camera.k, 7)}px monospace`;
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.fillText(node.name, 0, locRadius + 10 / camera.k);
    }
  }

  ctx.restore();
}

function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: CodeEdge,
  layout: Map<string, LayoutNode>,
  camera: Camera,
  viewport: Viewport
) {
  const source = layout.get(edge.source);
  const target = layout.get(edge.target);
  if (!source || !target) return;

  const screenSx = source.x * camera.k + camera.x;
  const screenSy = source.y * camera.k + camera.y;
  const screenTx = target.x * camera.k + camera.x;
  const screenTy = target.y * camera.k + camera.y;

  // Skip if both off-screen
  const margin = 50 / camera.k;
  if (
    screenSx < -margin && screenTx < -margin ||
    screenSx > viewport.w + margin && screenTx > viewport.w + margin ||
    screenSy < -margin && screenTy < -margin ||
    screenSy > viewport.h + margin && screenTy > viewport.h + margin
  ) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(screenSx, screenSy);

  if (edge.type === 'hierarchy') {
    // Curved line for hierarchy
    const cpX = (screenSx + screenTx) / 2;
    const cpY = (screenSy + screenTy) / 2;
    ctx.quadraticCurveTo(cpX, cpY, screenTx, screenTy);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1 / camera.k;
  } else if (edge.type === 'import') {
    // Dashed line for imports
    ctx.setLineDash([5 / camera.k, 5 / camera.k]);
    ctx.lineTo(screenTx, screenTy);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 0.5 / camera.k;
  }
  ctx.stroke();
  ctx.restore();
}

function drawAgentAvatar(
  ctx: CanvasRenderingContext2D,
  avatar: AgentAvatar,
  layout: Map<string, LayoutNode>,
  camera: Camera,
  viewport: Viewport
) {
  const currentLayout = layout.get(avatar.currentNodeId);
  if (!currentLayout) return;

  let x = currentLayout.x;
  let y = currentLayout.y;

  // If moving to target, interpolate
  if (avatar.targetNodeId && avatar.progress < 1) {
    const targetLayout = layout.get(avatar.targetNodeId);
    if (targetLayout) {
      x = currentLayout.x + (targetLayout.x - currentLayout.x) * avatar.progress;
      y = currentLayout.y + (targetLayout.y - currentLayout.y) * avatar.progress;
    }
  }

  const screenX = x * camera.k + camera.x;
  const screenY = y * camera.k + camera.y;

  // Skip if off-screen
  const margin = 50 / camera.k;
  if (screenX < -margin || screenX > viewport.w + margin || screenY < -margin || screenY > viewport.h + margin) {
    return;
  }

  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.scale(camera.k, camera.k);

  // Draw trail
  if (avatar.trail.length > 1) {
    ctx.beginPath();
    ctx.moveTo(avatar.trail[0].x, avatar.trail[0].y);
    for (let i = 1; i < avatar.trail.length; i++) {
      const alpha = (i / avatar.trail.length) * 0.5;
      ctx.strokeStyle = `${avatar.color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 2;
      ctx.lineTo(avatar.trail[i].x, avatar.trail[i].y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(avatar.trail[i].x, avatar.trail[i].y);
    }
  }

  // Draw avatar
  ctx.beginPath();
  ctx.arc(0, 0, AGENT_AVATAR_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = avatar.color;
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2 / camera.k;
  ctx.stroke();

  // Agent name label
  ctx.font = `${10 / camera.k}px monospace`;
  ctx.fillStyle = avatar.color;
  ctx.textAlign = 'center';
  ctx.fillText(avatar.agentName, 0, -AGENT_AVATAR_RADIUS - 12 / camera.k);

  ctx.restore();
}

export function CodebaseCanvas({
  containerRef,
  cameraController,
  enabled = true,
  reducedMotion = false,
}: CodebaseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const avatarsRef = useRef<Map<string, AgentAvatar>>(new Map());
  const layoutRef = useRef<Map<string, LayoutNode>>(new Map());

  const nodes = useCodeGraphStore(selectNodesArray);
  const edges = useCodeGraphStore(selectEdgesArray);
  const mode = useCodeGraphStore(selectMode);
  const syncStatus = useCodeGraphStore(selectSyncStatus);

  // Only render in gource mode
  if (mode !== 'gource') {
    return (
      <canvas
        ref={canvasRef}
        className="codebase-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
        aria-hidden="true"
      />
    );
  }

  // Compute layout when nodes/edges change
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    layoutRef.current = computeRadialLayout(nodes, edges, centerX, centerY);
  }, [nodes, edges, containerRef]);

  // Handle agent activity events (would come from hook events)
  // For now, we'll simulate with a placeholder

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio, motionConfig.effects.maxDPR);
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
  }, [containerRef]);

  // Animation loop
  useEffect(() => {
    if (!enabled) return;

    const animate = (timestamp: number) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const targetFrameTime = 1000 / motionConfig.performance.targetFPS;
      if (timestamp - lastFrameTimeRef.current < targetFrameTime) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTimeRef.current = timestamp;

      if (motionConfig.performance.stopOnHidden && document.hidden) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const camera = cameraController?.getCamera() || { x: 0, y: 0, k: 1 };
      const viewport: Viewport = { w: container.clientWidth, h: container.clientHeight };
      const dpr = Math.min(window.devicePixelRatio, motionConfig.effects.maxDPR);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewport.w, viewport.h);

      // Draw edges first (behind nodes)
      for (const edge of edges) {
        if (edge.type === 'hierarchy') {
          drawEdge(ctx, edge, layoutRef.current, camera, viewport);
        }
      }
      for (const edge of edges) {
        if (edge.type === 'import') {
          drawEdge(ctx, edge, layoutRef.current, camera, viewport);
        }
      }

      // Draw nodes
      for (const [, layoutNode] of layoutRef.current) {
        drawNode(ctx, layoutNode, camera, viewport);
      }

      // Draw agent avatars
      for (const [, avatar] of avatarsRef.current) {
        drawAgentAvatar(ctx, avatar, layoutRef.current, camera, viewport);
      }

      // Draw sync status indicator
      drawSyncIndicator(ctx, syncStatus, viewport);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, nodes, edges, syncStatus, cameraController, containerRef, reducedMotion]);

  // Handle new events for agent activity (placeholder - would connect to event store)
  useEffect(() => {
    // This would subscribe to the event store for file edit events
    // and spawn/move agent avatars accordingly
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="codebase-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
      aria-hidden="true"
    />
  );
}

function drawSyncIndicator(
  ctx: CanvasRenderingContext2D,
  syncStatus: 'synced' | 'stale' | 'resyncing' | 'disconnected',
  viewport: Viewport
) {
  const colors = {
    synced: '#22c55e',
    stale: '#f59e0b',
    resyncing: '#3b82f6',
    disconnected: '#ef4444',
  };
  const labels = {
    synced: 'Synced',
    stale: 'Stale',
    resyncing: 'Resyncing…',
    disconnected: 'Disconnected',
  };

  const color = colors[syncStatus];
  const label = labels[syncStatus];

  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'right';
  ctx.fillText(`● ${label}`, viewport.w - 16, 24);
  ctx.restore();
}