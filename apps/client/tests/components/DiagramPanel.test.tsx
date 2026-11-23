import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiagramPanel } from '../../src/components/DiagramPanel';

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg>test</svg>' }),
  },
}));

// Mock config
vi.mock('../../src/config', () => ({
  getApiBase: vi.fn(),
  getToken: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { getApiBase, getToken } from '../../src/config';
const mockGetApiBase = vi.mocked(getApiBase);
const mockGetToken = vi.mocked(getToken);

describe('DiagramPanel', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Reset mermaid render mock
    const mermaid = await import('mermaid');
    vi.mocked(mermaid.default.render).mockResolvedValue({ svg: '<svg>test</svg>' });
    // Reset config mocks
    mockGetApiBase.mockReturnValue('http://127.0.0.1:8081');
    mockGetToken.mockReturnValue('test-token');
  });

  it('renders loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<DiagramPanel diagramName="system-overview" />);

    expect(screen.getByRole('status', { name: 'Loading diagram' })).toBeInTheDocument();
    expect(screen.getByText('Loading diagram…')).toBeInTheDocument();
  });

  it('fetches diagram from correct endpoint with auth', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('```mermaid\ngraph TD\nA --> B\n```'),
    });

    render(<DiagramPanel diagramName="system-overview" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8081/diagrams/system-overview',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
  });

  it('renders mermaid diagram after successful fetch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('```mermaid\ngraph TD\nA --> B\n```'),
    });

    render(<DiagramPanel diagramName="system-overview" />);

    await waitFor(() => {
      const container = screen.getByTestId('diagram-container');
      expect(container).toBeInTheDocument();
    });
  });

  it('shows error when diagram not found (404)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const onError = vi.fn();
    render(<DiagramPanel diagramName="missing" onDiagramError={onError} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('Diagram "missing" not found')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith('Diagram "missing" not found');
  });

  it('shows error when unauthorized (401)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const onError = vi.fn();
    render(<DiagramPanel diagramName="system-overview" onDiagramError={onError} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('Unauthorized - check token')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith('Unauthorized - check token');
  });

  it('shows error when file has no mermaid code block', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Just markdown\nNo mermaid here.'),
    });

    const onError = vi.fn();
    render(<DiagramPanel diagramName="system-overview" onDiagramError={onError} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('No mermaid diagram found in file')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith('No mermaid diagram found in file');
  });

  it('shows error when mermaid render fails', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('```mermaid\ngraph TD\nA --> B\n```'),
    });

    const mermaid = await import('mermaid');
    vi.mocked(mermaid.default.render).mockRejectedValue(new Error('Invalid syntax'));

    const onError = vi.fn();
    render(<DiagramPanel diagramName="system-overview" onDiagramError={onError} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByText('Invalid syntax')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith('Invalid syntax');
  });

  it('retries on button click', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Server Error',
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('```mermaid\ngraph TD\nA --> B\n```'),
      });
    });

    const onError = vi.fn();
    render(<DiagramPanel diagramName="system-overview" onDiagramError={onError} />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Click retry
    const retryBtn = screen.getByRole('button', { name: 'Retry' });
    await act(async () => {
      await userEvent.click(retryBtn);
    });

    // Should fetch again
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('uses custom diagram name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('```mermaid\ngraph TD\nA --> B\n```'),
    });

    render(<DiagramPanel diagramName="custom-diagram" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8081/diagrams/custom-diagram',
        expect.anything()
      );
    });
  });

  it('uses custom API base and token from config', async () => {
    mockGetApiBase.mockReturnValue('http://custom.api:9999');
    mockGetToken.mockReturnValue('custom-token');

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('```mermaid\ngraph TD\nA --> B\n```'),
    });

    render(<DiagramPanel diagramName="system-overview" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom.api:9999/diagrams/system-overview',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer custom-token',
          }),
        })
      );
    });
  });

  it('extracts mermaid from markdown with multiple code blocks', async () => {
    const mermaid = await import('mermaid');
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(
        '# Title\n\n```mermaid\ngraph TD\nA --> B\n```\n\nSome text\n\n```javascript\nconsole.log("not mermaid");\n```'
      ),
    });

    render(<DiagramPanel diagramName="system-overview" />);

    await waitFor(() => {
      expect(vi.mocked(mermaid.default.render)).toHaveBeenCalledTimes(1);
      const call = vi.mocked(mermaid.default.render).mock.calls[0];
      expect(call[0]).toBe('diagram-system-overview');
      expect(call[1]).toBe('graph TD\nA --> B');
    });
  });
});