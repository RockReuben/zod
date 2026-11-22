import { vi } from 'vitest';

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    VITE_API_BASE: 'http://127.0.0.1:8081',
    VITE_TOKEN: 'test-token',
  },
});