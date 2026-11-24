/** Node geometry resolver - maps SVG node IDs to diagram-space coordinates */

export interface NodeGeo {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** Result of node geometry resolution */
export interface NodeGeoResult {
  geometry: NodeGeo | null;
  element: SVGGElement | SVGGraphicsElement | null;
}

/**
 * Resolve a node ID to its geometry in diagram space (not screen space).
 * The returned coordinates are in the SVG's internal coordinate system,
 * before any pan/zoom transform is applied.
 *
 * @param svg - The rendered Mermaid SVG element
 * @param nodeId - The logical node ID (e.g., "server", "client")
 * @returns NodeGeo with center and dimensions, or null if not found
 */
export function resolveNodeGeometry(
  svg: SVGSVGElement,
  nodeId: string
): NodeGeo | null {
  if (!svg) return null;

  // Mermaid generates various ID patterns for nodes
  // We need to find the actual SVG element that represents the node
  const selectors = buildNodeSelectors(nodeId);

  for (const selector of selectors) {
    const element = svg.querySelector<SVGGElement | SVGGraphicsElement>(selector);
    if (element) {
      return getElementGeometry(element, svg);
    }
  }

  // Try finding by subgraph
  const subgraphSelectors = buildSubgraphSelectors(nodeId);
  for (const selector of subgraphSelectors) {
    const element = svg.querySelector<SVGGElement | SVGGraphicsElement>(selector);
    if (element) {
      return getElementGeometry(element, svg);
    }
  }

  return null;
}

/** Build CSS selectors for a node ID (matches Mermaid's ID patterns) */
function buildNodeSelectors(nodeId: string): string[] {
  // Use global CSS or fallback
  const cssEscape = (globalThis.CSS?.escape) || ((str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const escaped = cssEscape(nodeId);
  return [
    // Direct node ID patterns
    `[id="node-${escaped}"]`,
    `[id="flowchart-node-${escaped}"]`,
    `[id="flowchart-subgraph-${escaped}"]`,
    // Class-based (some Mermaid versions)
    `.node[id*="${escaped}"]`,
    `g[id*="${escaped}"]`,
    // Subgraph containers
    `subgraph[id*="${escaped}"]`,
    // Generic fallback - any element with this ID suffix
    `[id$="-${escaped}"]`,
    `[id$="${escaped}"]`,
  ];
}

/** Build CSS selectors for a subgraph ID */
function buildSubgraphSelectors(nodeId: string): string[] {
  const cssEscape = (globalThis.CSS?.escape) || ((str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const escaped = cssEscape(nodeId);
  return [
    `[id="subgraph-${escaped}"]`,
    `[id="flowchart-subgraph-${escaped}"]`,
    `g.class[id*="${escaped}"]`,
  ];
}

/**
 * Get geometry of an SVG element in diagram space (SVG coordinate system).
 * Uses getBBox() which returns coordinates in the SVG's internal space.
 */
function getElementGeometry(
  element: SVGGElement | SVGGraphicsElement,
  svg: SVGSVGElement
): NodeGeo | null {
  try {
    // getBBox() returns coordinates in the SVG's coordinate system
    const bbox = element.getBBox();

    // If the element has no size, it might be hidden or empty
    if (bbox.width === 0 && bbox.height === 0) {
      // Try to find a child with actual geometry
      const child = element.querySelector<SVGGraphicsElement>('*');
      if (child) {
        return getElementGeometry(child, svg);
      }
      return null;
    }

    return {
      cx: bbox.x + bbox.width / 2,
      cy: bbox.y + bbox.height / 2,
      w: bbox.width,
      h: bbox.height,
    };
  } catch {
    // getBBox can throw if element is not rendered
    return null;
  }
}

/**
 * Get the SVG's viewBox or implicit coordinate system bounds.
 * Useful for converting between diagram space and normalized space.
 */
export function getSVGDiagramBounds(svg: SVGSVGElement): { width: number; height: number } {
  // Try viewBox first
  const viewBox = svg.viewBox.baseVal;
  if (viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  // Fall back to SVG width/height attributes
  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;
  if (width > 0 && height > 0) {
    return { width, height };
  }

  // Last resort: getBBox of entire SVG content
  try {
    const bbox = svg.getBBox();
    return { width: bbox.width, height: bbox.height };
  } catch {
    return { width: 800, height: 600 }; // Reasonable default
  }
}

/**
 * Convert diagram-space coordinates to screen-space coordinates
 * given the current pan/zoom transform.
 */
export function diagramToScreen(
  geo: NodeGeo,
  pan: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  return {
    x: geo.cx * zoom + pan.x,
    y: geo.cy * zoom + pan.y,
  };
}

/**
 * Convert screen-space coordinates to diagram-space coordinates
 * given the current pan/zoom transform.
 */
export function screenToDiagram(
  screenX: number,
  screenY: number,
  pan: { x: number; y: number },
  zoom: number
): { x: number; y: number } {
  return {
    x: (screenX - pan.x) / zoom,
    y: (screenY - pan.y) / zoom,
  };
}

/**
 * Check if a node is inside the dead zone (central portion of viewport).
 * Returns true if the node center is within the central deadZoneRatio of the viewport.
 */
export function isInDeadZone(
  geo: NodeGeo,
  pan: { x: number; y: number },
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
  deadZoneRatio: number = 0.6
): boolean {
  const screen = diagramToScreen(geo, pan, zoom);
  const leftBound = viewportWidth * (1 - deadZoneRatio) / 2;
  const rightBound = viewportWidth * (1 + deadZoneRatio) / 2;
  const topBound = viewportHeight * (1 - deadZoneRatio) / 2;
  const bottomBound = viewportHeight * (1 + deadZoneRatio) / 2;

  return (
    screen.x >= leftBound &&
    screen.x <= rightBound &&
    screen.y >= topBound &&
    screen.y <= bottomBound
  );
}