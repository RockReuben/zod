/** Effect colour tokens - CSS variable backed with hex fallbacks */

export interface EffectTokens {
  readonly write: {
    readonly primary: string;
    readonly glow: string;
    readonly particle: string;
  };
  readonly read: {
    readonly primary: string;
    readonly ripple: string;
  };
  readonly search: {
    readonly primary: string;
    readonly spiral: string;
  };
  readonly error: {
    readonly primary: string;
    readonly flash: string;
    readonly ring: string;
  };
  readonly other: {
    readonly primary: string;
    readonly glow: string;
  };
}

/** Default tokens with CSS variable names (resolved at draw time via resolveColor) */
export const effectTokens: EffectTokens = {
  write: {
    primary: 'var(--fx-write-primary, #1a73e8)',
    glow: 'var(--fx-write-glow, #1a73e8cc)',
    particle: 'var(--fx-write-particle, #1a73e8)',
  },
  read: {
    primary: 'var(--fx-read-primary, #00bcd4)',
    ripple: 'var(--fx-read-ripple, #00bcd480)',
  },
  search: {
    primary: 'var(--fx-search-primary, #9c27b0)',
    spiral: 'var(--fx-search-spiral, #9c27b0)',
  },
  error: {
    primary: 'var(--fx-error-primary, #d32f2f)',
    flash: 'var(--fx-error-flash, #d32f2f59)',
    ring: 'var(--fx-error-ring, #d32f2f33)',
  },
  other: {
    primary: 'var(--fx-other-primary, #757575)',
    glow: 'var(--fx-other-glow, #75757580)',
  },
};

/** Get resolved colour for canvas drawing (computes CSS vars if available) */
export function resolveColor(cssVarOrHex: string): string {
  if (typeof window === 'undefined') return cssVarOrHex;
  if (!cssVarOrHex.startsWith('var(')) return cssVarOrHex;

  // Extract var name from var(--name, fallback) - handle both var(--name) and var(--name, fallback)
  const match = cssVarOrHex.match(/var\(--([^,)]+)(?:,\s*[^)]+)?\)/);
  if (!match) return cssVarOrHex;

  const computed = getComputedStyle(document.documentElement).getPropertyValue(`--${match[1]}`).trim();
  // If CSS var not defined, extract fallback from var()
  if (!computed) {
    const fallbackMatch = cssVarOrHex.match(/var\(--[^,)]+,\s*([^)]+)\)/);
    if (fallbackMatch) return fallbackMatch[1].trim();
  }
  return computed || cssVarOrHex;
}

/** Get all resolved colours for a kind */
export function getResolvedTokens(kind: keyof EffectTokens): Record<string, string> {
  const tokens = effectTokens[kind];
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    resolved[key] = resolveColor(value);
  }
  return resolved;
}

/** CSS custom properties to add to :root for theming */
export const effectTokenCSS = `
:root {
  --fx-write-primary: #1a73e8;
  --fx-write-glow: #1a73e8cc;
  --fx-write-particle: #1a73e8;
  --fx-read-primary: #00bcd4;
  --fx-read-ripple: #00bcd480;
  --fx-search-primary: #9c27b0;
  --fx-search-spiral: #9c27b0;
  --fx-error-primary: #d32f2f;
  --fx-error-flash: #d32f2f59;
  --fx-error-ring: #d32f2f33;
  --fx-other-primary: #757575;
  --fx-other-glow: #75757580;
}

/* Dark mode adjustments (if using a dark theme class) */
@media (prefers-color-scheme: dark) {
  :root {
    --fx-write-glow: #1a73e8ee;
    --fx-read-ripple: #00bcd4aa;
    --fx-error-flash: #d32f2f77;
    --fx-error-ring: #d32f2f44;
    --fx-other-glow: #757575aa;
  }
}
`;

/** Inject effect token CSS variables into the document */
export function injectEffectTokens(): void {
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.id = 'fx-effect-tokens';
  style.textContent = effectTokenCSS;
  // Avoid duplicate injection
  if (!document.getElementById('fx-effect-tokens')) {
    document.head.appendChild(style);
  }
}

/** Shared color parsing utility */
export function parseColorWithAlpha(color: string, alpha: number): string {
  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    let r: number, g: number, b: number;

    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    } else if (hex.length === 8) {
      // #RRGGBBAA
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      // Blend with existing alpha
      const existingAlpha = parseInt(hex.slice(6, 8), 16) / 255;
      alpha = alpha * existingAlpha;
    } else {
      return `rgba(128, 128, 128, ${alpha})`;
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Handle rgb/rgba
  if (color.startsWith('rgb')) {
    return color.replace(/rgb\(([^)]+)\)/, (match, vals) => {
      const parts = vals.split(',').map((v: string) => v.trim());
      if (parts.length >= 3) {
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
      }
      return match;
    });
  }

  // Fallback
  return `rgba(128, 128, 128, ${alpha})`;
}