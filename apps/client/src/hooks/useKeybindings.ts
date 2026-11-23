import { useEffect, useMemo, useState } from 'react';

interface KeybindingConfig {
  shortcuts: Record<string, string>;
  platformOverrides?: Record<string, Record<string, string>>;
}

interface ParsedShortcut {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

/**
 * Parse a shortcut string like "Meta+K" or "Control+Shift+K" into key/modifier parts
 */
function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split('+').map(p => p.trim().toLowerCase());
  return {
    key: parts[parts.length - 1],
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
  };
}

/**
 * Check if a keyboard event matches a parsed shortcut
 */
function eventMatchesShortcut(event: KeyboardEvent, shortcut: ParsedShortcut): boolean {
  const eventKey = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();

  // Handle special keys
  const keyMap: Record<string, string> = {
    ' ': 'space',
    'escape': 'esc',
    'arrowup': 'up',
    'arrowdown': 'down',
    'arrowleft': 'left',
    'arrowright': 'right',
  };

  const normalizedEventKey = keyMap[eventKey] || eventKey;
  const normalizedShortcutKey = keyMap[shortcutKey] || shortcutKey;

  return (
    normalizedEventKey === normalizedShortcutKey &&
    event.ctrlKey === shortcut.ctrl &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt &&
    (event.metaKey || event.ctrlKey) === shortcut.meta // Meta on Mac, Ctrl on Win/Linux for "Meta" shortcuts
  );
}

/**
 * Load keybindings from the JSON config file
 */
async function loadKeybindings(): Promise<KeybindingConfig> {
  try {
    const response = await fetch('/keybindings.json');
    if (!response.ok) throw new Error('Failed to load keybindings');
    return await response.json();
  } catch (e) {
    console.warn('Failed to load keybindings, using defaults:', e);
    return {
      shortcuts: {
        focusChat: 'Meta+K',
        cycleChatTarget: 'Meta+Shift+K',
        toggleChatPanel: 'Meta+J',
      },
    };
  }
}

/**
 * Get the resolved shortcut for the current platform
 */
function resolveShortcut(config: KeybindingConfig, action: string): string {
  const platform = navigator.platform.toLowerCase();
  let platformKey: string | null = null;

  if (platform.includes('win')) platformKey = 'win32';
  else if (platform.includes('linux')) platformKey = 'linux';
  else if (platform.includes('mac')) platformKey = 'darwin';

  if (platformKey && config.platformOverrides?.[platformKey]?.[action]) {
    return config.platformOverrides[platformKey][action];
  }

  return config.shortcuts[action] || '';
}

/**
 * Hook to register a global keyboard shortcut
 */
export function useShortcut(action: string, callback: () => void, deps: unknown[] = []): void {
  const [shortcut, setShortcut] = useState<ParsedShortcut | null>(null);

  useEffect(() => {
    let mounted = true;
    loadKeybindings().then(cfg => {
      if (mounted) {
        const resolved = resolveShortcut(cfg, action);
        if (resolved) setShortcut(parseShortcut(resolved));
      }
    });
    return () => { mounted = false; };
  }, [action]);

  useEffect(() => {
    if (!shortcut) return;

    const handler = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Exception: allow shortcuts in chat input for focusChat action
        if (action !== 'focusChat' || !target.closest('.chat-input')) {
          return;
        }
      }

      if (eventMatchesShortcut(event, shortcut)) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcut, action, callback, ...deps]);
}

/**
 * Hook to get all resolved shortcuts for display/tooltips
 */
export function useResolvedShortcuts(): Record<string, string> {
  const [config, setConfig] = useState<KeybindingConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    loadKeybindings().then(cfg => {
      if (mounted) setConfig(cfg);
    });
    return () => { mounted = false; };
  }, []);

  return useMemo(() => {
    if (!config) return {};
    const actions = ['focusChat', 'cycleChatTarget', 'toggleChatPanel'];
    const result: Record<string, string> = {};
    for (const action of actions) {
      result[action] = resolveShortcut(config, action);
    }
    return result;
  }, [config]);
}