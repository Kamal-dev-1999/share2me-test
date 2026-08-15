/**
 * useSocket — singleton Socket.io client hook.
 * Returns the socket instance; reconnects automatically.
 */
"use client";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let _socket: Socket | null = null;

function getSocket(): Socket {
  if (!_socket) {
    const url = process.env.NEXT_PUBLIC_SIGNAL_URL || process.env.NEXT_PUBLIC_EXPRESS_URL || process.env.NEXT_PUBLIC_EXPRESS_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://share2me-version-2-0.onrender.com";
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
