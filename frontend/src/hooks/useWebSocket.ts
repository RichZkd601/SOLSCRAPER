import { useEffect, useRef, useCallback, useState } from 'react';

export type WSEventType = 'WALLET_TX' | 'COPY_TRADE_EXECUTED' | 'ALERT' | 'PRICE_UPDATE' | 'TRACKER_STATUS' | 'ERROR';

export interface WSMessage {
  type: WSEventType;
  data: unknown;
  timestamp: number;
}

interface UseWebSocketOptions {
  onMessage?: (msg: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(opts: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      opts.onConnect?.();
    };

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(evt.data) as WSMessage;
        setLastMessage(msg);
        opts.onMessage?.(msg);
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      opts.onDisconnect?.();
      reconnectRef.current = setTimeout(connect, 4_000);
    };

    ws.onerror = () => ws.close();
  }, []); // eslint-disable-line

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected, lastMessage };
}
