import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveNodeGeometry, getSVGDiagramBounds, diagramToScreen, screenToDiagram, isInDeadZone } from '../../src/fx/nodeGeometry';

describe('nodeGeometry', () => {
  let mockSvg: SVGSVGElement;
  let mockNode: SVGGElement;

  beforeEach(() => {
    // Create mock SVG element using global document (should be available from jsdom)
    // Create a minimal mock SVG element with all required methods
    mockSvg = {
      createElementNS: vi.fn(),
      querySelector: vi.fn(),
      getBBox: vi.fn(),
      setAttribute: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      viewBox: { baseVal: { width: 800, height: 600 } },
      width: { baseVal: { value: 800 } },
      height: { baseVal: { value: 600 } },
    } as unknown as SVGSVGElement;

    // Create mock node element with all required methods
    mockNode = {
      getBBox: vi.fn().mockReturnValue({
        x: 100,
        y: 100,
        width: 50,
        height: 30,
        left: 100,
        top: 100,
        right: 150,
        bottom: 130,
      }),
      setAttribute: vi.fn(),
      getAttribute: vi.fn(),
      appendChild: vi.fn(),
    } as unknown as SVGGElement;

    // Mock the SVG's querySelector to return our mock node for the specific selectors
    mockSvg.querySelector = vi.fn((selector: string) => {
      if (selector.includes('node-server') || selector.includes('flowchart-node-client') || selector.includes('flowchart-subgraph-hooks')) {
        return mockNode;
      }
      return null;
    });

    // Mock getBBox on the SVG element itself
    mockSvg.getBBox = vi.fn().mockReturnValue({
      x: 0, y: 0, width: 800, height: 600,
      left: 0, top: 0, right: 800, bottom: 600
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('resolves node geometry by ID suffix', () => {
    const geo = resolveNodeGeometry(mockSvg, 'server');
    expect(geo).not.toBeNull();
    expect(geo?.cx).toBe(125); // 100 + 50/2
    expect(geo?.cy).toBe(115); // 100 + 30/2
    expect(geo?.w).toBe(50);
    expect(geo?.h).toBe(30);
  });

  it('resolves node with flowchart-node prefix', () => {
    mockNode.setAttribute('id', 'flowchart-node-client');
    const geo = resolveNodeGeometry(mockSvg, 'client');
    expect(geo).not.toBeNull();
  });

  it('resolves subgraph by ID', () => {
    mockNode.setAttribute('id', 'flowchart-subgraph-hooks');
    const geo = resolveNodeGeometry(mockSvg, 'hooks');
    expect(geo).not.toBeNull();
  });

  it('returns null for missing node', () => {
    const geo = resolveNodeGeometry(mockSvg, 'nonexistent');
    expect(geo).toBeNull();
  });

  it('returns null for null SVG', () => {
    const geo = resolveNodeGeometry(null as any, 'server');
    expect(geo).toBeNull();
  });

  it('gets SVG diagram bounds from viewBox', () => {
    const bounds = getSVGDiagramBounds(mockSvg);
    expect(bounds.width).toBe(800);
    expect(bounds.height).toBe(600);
  });

  it('converts diagram to screen coordinates', () => {
    const geo = { cx: 100, cy: 100, w: 50, h: 50 };
    const pan = { x: 50, y: 30 };
    const zoom = 2;

    const screen = diagramToScreen(geo, pan, zoom);
    expect(screen.x).toBe(250); // 100 * 2 + 50
    expect(screen.y).toBe(230); // 100 * 2 + 30
  });

  it('converts screen to diagram coordinates', () => {
    const pan = { x: 50, y: 30 };
    const zoom = 2;

    const diagram = screenToDiagram(250, 230, pan, zoom);
    expect(diagram.x).toBe(100);
    expect(diagram.y).toBe(100);
  });

  it('detects node in dead zone (center 60%)', () => {
    const geo = { cx: 400, cy: 300, w: 50, h: 50 }; // Center of 800x600
    const pan = { x: 0, y: 0 };
    const zoom = 1;
    const viewport = { w: 800, h: 600 };

    const inDeadZone = isInDeadZone(geo, pan, zoom, viewport.w, viewport.h, 0.6);
    expect(inDeadZone).toBe(true);
  });

  it('detects node outside dead zone', () => {
    const geo = { cx: 100, cy: 100, w: 50, h: 50 }; // Top-left
    const pan = { x: 0, y: 0 };
    const zoom = 1;
    const viewport = { w: 800, h: 600 };

    const inDeadZone = isInDeadZone(geo, pan, zoom, viewport.w, viewport.h, 0.6);
    expect(inDeadZone).toBe(false);
  });

  it('handles pan/zoom in dead zone check', () => {
    const geo = { cx: 400, cy: 300, w: 50, h: 50 }; // Diagram center
    const pan = { x: -400, y: -300 }; // Panned so diagram center is at screen origin
    const zoom = 1;
    const viewport = { w: 800, h: 600 };

    const inDeadZone = isInDeadZone(geo, pan, zoom, viewport.w, viewport.h, 0.6);
    expect(inDeadZone).toBe(false); // Node is now at screen (0,0) which is outside center 60%
  });
});