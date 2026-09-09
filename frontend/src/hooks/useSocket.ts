/**
 * useSocket — singleton Socket.io client hook.
 * Returns the socket instance; reconnects automatically.
 */
"use client";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

import { getBackendUrl } from "@/lib/backendUrl";

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    const url = getBackendUrl();
    _socket = io(url, { transports: ["websocket"] });
  }
  return _socket;
}

export function useSocket() {
  const socketRef = useRef<Socket>(getSocket());
  useEffect(() => {
    // Don't disconnect on unmount — the socket is shared across the app.
    return () => {};
  }, []);
  return socketRef.current;
}
