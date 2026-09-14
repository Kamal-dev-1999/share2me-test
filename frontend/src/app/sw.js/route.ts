import { NextResponse } from "next/server";

const SW_CONTENT = `self.options = {
    "domain": "5gvci.com",
    "zoneId": 11803047
}
self.lary = ""
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw')
`;

const CORS_HEADERS = {
  "Content-Type": "application/javascript; charset=utf-8",
  "Service-Worker-Allowed": "/",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-cache, no-store, must-revalidate",
};

export async function GET() {
  return new NextResponse(SW_CONTENT, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
