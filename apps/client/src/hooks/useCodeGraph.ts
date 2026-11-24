import { useEffect, useRef, useCallback } from 'react';
import { getApiBase } from '../config';
import { useCodeGraphStore, GraphDelta, selectIsConnected, selectSyncStatus } from '../stores/codeGraph';

interface UseCodeGraphOptions {
  /** Enable/disable the code graph connection */
  enabled?: boolean;
  /** Callback when snapshot received */
  onSnapshot?: () => void;
  /** Callback when delta received */
  onDelta?: (delta: GraphDelta) => void;
  /** Callback on connection error */
  onError?: (error: Error) => void;
}

const RECONNECT_BASE_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const FINGERPRINT_CHECK_INTERVAL = 30000; // 30 seconds

export function useCodeGraph({
  enabled = true,
  onSnapshot,
  onDelta,
  onError,
}: UseCodeGraphOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const fingerprintCheckIntervalRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isMountedRef = useRef(true);

  const {
    applySnapshot,
    applyDelta,
    setSyncStatus,
    setConnected,
    setFingerprintCheck,
    fingerprint,
    // syncStatus is used via setSyncStatus calls below
  } = useCodeGraphStore();

  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const apiBase = getApiBase().replace('http', 'ws');
    // Token is passed via Authorization header in WebSocket handshake
    const wsUrl = `${apiBase}/ws/code-graph`;

    console.log('[useCodeGraph] Connecting to', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useCodeGraph] Connected');
        setConnected(true);
        reconnectAttemptRef.current = 0;

        // Send current fingerprint for validation
        if (fingerprint) {
          ws.send(JSON.stringify({ type: 'fingerprint_check', fingerprint }));
        }

        // Start periodic fingerprint checks
        fingerprintCheckIntervalRef.current = window.setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN && fingerprint) {
            wsRef.current.send(JSON.stringify({ type: 'fingerprint_check', fingerprint }));
            setFingerprintCheck(Date.now());
          }
        }, FINGERPRINT_CHECK_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'graph_snapshot': {
              console.log('[useCodeGraph] Received snapshot:', {
                nodes: Object.keys(data.nodes).length,
                edges: Object.keys(data.edges).length,
                fingerprint: data.fingerprint?.slice(0, 16),
              });
              applySnapshot({
                nodes: data.nodes,
                edges: data.edges,
                fingerprint: data.fingerprint,
              });
              setSyncStatus('synced');
              onSnapshot?.();
              break;
            }

            case 'graph_delta': {
              console.log('[useCodeGraph] Received delta:', {
                addedNodes: data.added_nodes?.length,
                removedNodes: data.removed_node_ids?.length,
                updatedNodes: data.updated_nodes?.length,
                addedEdges: data.added_edges?.length,
                removedEdges: data.removed_edge_ids?.length,
              });
              const delta: GraphDelta = {
                added_nodes: data.added_nodes || [],
                removed_node_ids: data.removed_node_ids || [],
                updated_nodes: data.updated_nodes || [],
                added_edges: data.added_edges || [],
                removed_edge_ids: data.removed_edge_ids || [],
                updated_edges: data.updated_edges || [],
                timestamp: data.timestamp || Date.now(),
              };
              applyDelta(delta);
              setSyncStatus('synced');
              onDelta?.(delta);
              break;
            }

            case 'graph_fingerprint': {
              console.log('[useCodeGraph] Fingerprint mismatch, requesting resync');
              setSyncStatus('resyncing');
              // Force resync by closing and reconnecting
              if (wsRef.current) {
                wsRef.current.close(1000, 'fingerprint mismatch');
              }
              break;
            }

            default:
              console.log('[useCodeGraph] Unknown message type:', data.type);
          }
        } catch (err) {
          console.error('[useCodeGraph] Error parsing message:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('[useCodeGraph] Disconnected:', event.code, event.reason);
        setConnected(false);
        setSyncStatus('disconnected');

        if (fingerprintCheckIntervalRef.current) {
          clearInterval(fingerprintCheckIntervalRef.current);
          fingerprintCheckIntervalRef.current = null;
        }

        wsRef.current = null;

        // Attempt reconnection if mounted and not cleanly closed
        if (isMountedRef.current && enabled && event.code !== 1000) {
          scheduleReconnect();
        }
      };

      ws.onerror = (event) => {
        console.error('[useCodeGraph] WebSocket error:', event);
        const error = new Error('WebSocket connection error');
        onError?.(error);
      };
    } catch (err) {
      console.error('[useCodeGraph] Failed to create WebSocket:', err);
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      scheduleReconnect();
    }
  }, [enabled, fingerprint, applySnapshot, applyDelta, setSyncStatus, setConnected, setFingerprintCheck, onSnapshot, onDelta, onError]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptRef.current),
      MAX_RECONNECT_DELAY
    );
    reconnectAttemptRef.current += 1;

    console.log(`[useCodeGraph] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

    reconnectTimeoutRef.current = window.setTimeout(() => {
      if (isMountedRef.current) {
        connect();
      }
    }, delay);
  }, [connect]);

  const disconnect = useCallback(() => {
    isMountedRef.current = false;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (fingerprintCheckIntervalRef.current) {
      clearInterval(fingerprintCheckIntervalRef.current);
      fingerprintCheckIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Component unmounted');
      wsRef.current = null;
    }

    setConnected(false);
    setSyncStatus('disconnected');
  }, [setConnected, setSyncStatus]);

  const requestResync = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'fingerprint_check', fingerprint }));
    } else {
      connect();
    }
  }, [fingerprint, connect]);

  useEffect(() => {
    isMountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Expose control functions
  return {
    connect,
    disconnect,
    requestResync,
    isConnected: useCodeGraphStore(selectIsConnected),
    syncStatus: useCodeGraphStore(selectSyncStatus),
  };
}