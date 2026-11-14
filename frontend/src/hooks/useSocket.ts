/**
 * useSocket — singleton Socket.io client hook.
 * Returns the socket instance on the client; reconnects automatically.
 * Strictly guards against SSR execution to prevent server-side socket leaks.
 *
 * Production (OCI): connects to window.location.origin (share2.me).
 *   Caddy routes /socket.io/* → backend:8000 internally.
 *   The backend host is NEVER transmitted to the browser.
 *
 * Local dev: connects to http://localhost:3000 (dev Express).
 * Cloud Run: connects to the Cloud Run backend URL directly.
 */
"use client";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { CLOUD_RUN_BACKEND_URL } from "@/lib/backendUrl";

let _socket: Socket | null = null;

function getSocketUrl(): string {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname.toLowerCase();

  // Local development — connect directly to dev backend
  if (host === "localhost" || host === "127.0.0.1") {
    return process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";
  }

  // Cloud Run (GCP legacy) — connect directly to Cloud Run backend
  if (host.endsWith(".run.app")) {
    return CLOUD_RUN_BACKEND_URL;
  }

  // All production hosts (OCI IP, share2.me, share2me.in):
  // Connect to same origin — Caddy routes /socket.io/* to backend:8000.
  // The browser only sees share2.me, never the backend address.
  return window.location.origin;
}

function getSocket(): Socket | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!_socket) {
    const url = getSocketUrl();
    _socket = io(url, {
      transports: ["websocket"],
      path: "/socket.io/",   // explicit path so Caddy matcher works
    });
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
