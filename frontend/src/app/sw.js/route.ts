import { NextResponse } from "next/server";

const SW_CONTENT = `// Monetag service worker disabled
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.registration.unregister().then(() => {
            return self.clients.matchAll();
        }).then((clients) => {
            clients.forEach((client) => client.navigate(client.url));
        })
    );
});
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
