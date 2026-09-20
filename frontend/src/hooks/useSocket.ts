/**
 * useSocket — singleton Socket.io client hook.
 * Returns the socket instance on the client; reconnects automatically.
 * Strictly guards against SSR execution to prevent server-side socket leaks.
 */
"use client";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getBackendUrl } from "@/lib/backendUrl";

let _socket: Socket | null = null;

function getSocket(): Socket | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!_socket) {
    const url = getBackendUrl();
    _socket = io(url, { transports: ["websocket"] });
  }
  return _socket;
}

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(() => {
    if (typeof window !== "undefined") {
      return getSocket();
    }
    return null;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const s = getSocket();
      if (s && s !== socket) {
        setSocket(s);
      }
    }
  }, [socket]);

  return socket;
}
