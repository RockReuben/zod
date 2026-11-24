/** Shared pan/zoom utilities for svg-pan-zoom integration */

interface SvgPanZoomInstance {
  getPan(): { x: number; y: number } | null;
  getZoom(): number;
  pan(pos: { x: number; y: number }): void;
  zoom(k: number): void;
  destroy(): void;
  resize(): void;
  fit(): void;
  center(): void;
}

interface SVGWithPanZoom extends SVGSVGElement {
  __svgPanZoom?: SvgPanZoomInstance;
}

/** Get current pan/zoom from an SVG element that has svg-pan-zoom attached */
export function getCurrentPanZoom(svg: SVGSVGElement): { x: number; y: number; k: number } {
  try {
    // svg-pan-zoom stores its instance on the SVG element
    const instance = (svg as SVGWithPanZoom).__svgPanZoom;
    if (instance && typeof instance.getPan === 'function' && typeof instance.getZoom === 'function') {
      const pan = instance.getPan();
      const zoom = instance.getZoom();
      if (pan && typeof pan.x === 'number' && typeof pan.y === 'number' && typeof zoom === 'number') {
        return { x: pan.x, y: pan.y, k: zoom };
      }
    }
    // Fallback: compute from transform
    const transform = svg.style.transform;
    if (transform) {
      const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)\s*scale\(([^)]+)\)/);
      if (match) {
        return {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          k: parseFloat(match[3]),
        };
      }
    }
    return { x: 0, y: 0, k: 1 };
  } catch (e) {
    console.warn('[panZoomUtils] Error getting pan/zoom:', e);
    return { x: 0, y: 0, k: 1 };
  }
}

/** Set pan/zoom on an SVG element, using svg-pan-zoom instance if available */
export function setPanZoom(svg: SVGSVGElement, x: number, y: number, k: number): void {
  try {
    const instance = (svg as SVGWithPanZoom).__svgPanZoom;
    if (instance && typeof instance.pan === 'function' && typeof instance.zoom === 'function') {
      instance.pan({ x, y });
      instance.zoom(k);
    } else {
      // Fallback: apply transform directly
      svg.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      svg.style.transformOrigin = '0 0';
    }
  } catch (e) {
    console.warn('[panZoomUtils] Error setting pan/zoom:', e);
    // Fallback: apply transform directly
    svg.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    svg.style.transformOrigin = '0 0';
  }
}

/** Store svg-pan-zoom instance on SVG element for external access */
export function storePanZoomInstance(svg: SVGSVGElement, instance: SvgPanZoomInstance): void {
  (svg as SVGWithPanZoom).__svgPanZoom = instance;
}