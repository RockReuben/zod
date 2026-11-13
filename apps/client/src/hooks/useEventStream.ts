import { useEffect, useRef, useState, useCallback } from 'react';
import { HookEvent, ConnectionStatus } from '../types';
import { useEventsStore } from '../stores/events';

const WS_URL = 'ws://127.0.0.1:8081/ws';
const RECONNECT_BASE_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

export function useEventStream() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const addEvent = useEventsStore((s) => s.addEvent);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus('reconnecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
      console.log('[EventStream] WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'event') {
          addEvent(data as HookEvent);
        }
      } catch (e) {
        console.warn('[EventStream] Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      console.log('[EventStream] WebSocket closed, scheduling reconnect...');
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      setStatus('error');
      console.error('[EventStream] WebSocket error:', error);
    };
  }, [addEvent]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current),
      MAX_RECONNECT_DELAY
    );
    reconnectAttemptsRef.current += 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { status, connect, disconnect };
}