import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock import.meta.env FIRST
vi.stubGlobal('import.meta', {
  env: {
    VITE_API_BASE: 'http://127.0.0.1:8081',
    VITE_TOKEN: 'test-token',
  },
});

// Expose CSS escape polyfill since jsdom may not have it
global.CSS = global.CSS || {
  escape: (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
};

// Also expose document methods needed by tests
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));