/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  // 'standalone' mode bundles only the necessary files to run the app.
  // Required by the production Dockerfile for a minimal image size (~50MB vs 400MB+).
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  eslint: {
    // Kept only until the existing lint backlog is cleared. CI runs
    // `npm run lint:report` so the count stays visible instead of silently
    // growing. TypeScript is enforced at build time below.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // `npx tsc --noEmit` is clean; type errors must fail the build again.
    ignoreBuildErrors: false,
  },
  outputFileTracingRoot: process.cwd(),
  images: {
    // Allow data: URIs (used for QR code base64 images)
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      }
    ],
    // data: URLs are generated locally by qrcode package — safe to allow
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts", "@monaco-editor/react"],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },

  async headers() {
    return [
      {
        // Immutable cache for heavy static public worker assets (do NOT include worker.js as it changes)
        source: "/(pdf\\.worker\\.min\\.mjs|workers/pdf-lib\\.min\\.js|Share2Me-PrintAgent\\.exe)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Prevent CDN edge from caching HTML pages so chunk hashes are always fresh on deployment
        source: "/((?!_next/static|_next/image|favicon.ico|pdf\\.worker\\.min\\.mjs|workers/pdf-lib\\.min\\.js|Share2Me-PrintAgent\\.exe).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=0, must-revalidate",
          },
        ],
      },
      {
        // Immutable cache for content-hashed static assets
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, HEAD, OPTIONS",
          },
        ],
      },
      {
        // Apply security headers to every route
        source: "/(.*)",
        headers: [
          // Bug 6 — Clickjacking prevention: disallow embedding site in third-party iframes
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          // Bug 7 — MIME sniffing prevention: force browser to respect declared Content-Type
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Bug 8 — HSTS: enforce HTTPS for 2 years, include all subdomains, submit to preload list
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
          // Best practice: limit referrer information sent to third parties
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Bug 5 — Content Security Policy
          // NOTE: unsafe-inline and unsafe-eval are required by Next.js App Router (hydration scripts).
          // NOTE: wss:, ws:, https:, and http://localhost:* in connect-src allow WebRTC signalling, local dev backend, and production APIs.
          // All known external origins (AdSense, GTM, GA4, Google Fonts, profile images, R2) are explicitly allowlisted.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://pagead2.googlesyndication.com https://partner.googleadservices.com https://adservice.google.com https://googleads.g.doubleclick.net https://checkout.razorpay.com https://unpkg.com https://cdnjs.cloudflare.com https://3nbf4.com https://*.3nbf4.com https://5gvci.com https://*.5gvci.com https://quge5.com https://*.quge5.com https://nap5k.com https://*.nap5k.com https://n6wxm.com https://*.n6wxm.com https://*.adtrafficquality.google https://adtrafficquality.google",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http://localhost:* http://127.0.0.1:*",
              "connect-src 'self' blob: data: wss: ws: https: http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://region1.analytics.google.com https://stats.g.doubleclick.net https://*.g.doubleclick.net https://pagead2.googlesyndication.com https://api.razorpay.com https://lumberjack-cx.razorpay.com https://unpkg.com https://3nbf4.com https://*.3nbf4.com https://5gvci.com https://*.5gvci.com https://quge5.com https://*.quge5.com https://nap5k.com https://*.nap5k.com https://n6wxm.com https://*.n6wxm.com https://*.adtrafficquality.google https://adtrafficquality.google",
              "media-src 'self' blob: https: http://localhost:* http://127.0.0.1:*",
              "worker-src 'self' blob: https://unpkg.com https://3nbf4.com https://*.3nbf4.com https://5gvci.com https://*.5gvci.com https://quge5.com https://*.quge5.com https://nap5k.com https://*.nap5k.com https://n6wxm.com https://*.n6wxm.com",
              "frame-src 'self' blob: https://www.googletagmanager.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://api.razorpay.com https://checkout.razorpay.com https://3nbf4.com https://*.3nbf4.com https://5gvci.com https://*.5gvci.com https://quge5.com https://*.quge5.com https://nap5k.com https://*.nap5k.com https://n6wxm.com https://*.n6wxm.com",
              "object-src 'self' blob:",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/price",
        destination: "/pricing",
        permanent: true,
      },
      // UX aliases for routes users commonly type or follow from old links.
      // Keep these temporary (307) until we are sure they should be cached.
      {
        source: "/login",
        destination: "/g2p",
        permanent: false,
      },
      {
        source: "/signup",
        destination: "/g2p",
        permanent: false,
      },
      {
        source: "/dashboard",
        destination: "/g2p",
        permanent: false,
      },
      {
        // Must be declared before the /g2p/[code] dynamic page can match it.
        source: "/g2p/dashboard",
        destination: "/g2p",
        permanent: false,
      },
      {
        source: "/printshop",
        destination: "/g2p/nearby",
        permanent: false,
      },
      {
        source: "/send",
        destination: "/p2p?mode=send",
        permanent: false,
      },
    ];
  },

  async rewrites() {
    // BACKEND_URL is a server-side-only env var (no NEXT_PUBLIC_ prefix).
    // It is declared as an ARG in the Dockerfile and available during `next build`.
    // In Docker: http://backend:8000 (internal network, never sent to browser).
    // Locally: falls back to NEXT_PUBLIC_EXPRESS_URL or localhost:3000.
    const backendUrl = process.env.BACKEND_URL
      || process.env.NEXT_PUBLIC_EXPRESS_URL
      || "http://10.0.1.218:8000";
    return [
      {
        source: "/api/admin/:path*",
        destination: `${backendUrl}/api/admin/:path*`,
      },
      {
        source: "/api/tools/:path*",
        destination: `${backendUrl}/api/tools/:path*`,
      },
      {
        source: "/api/blogs/:path*",
        destination: `${backendUrl}/api/blogs/:path*`,
      },
    ];
  },
};

export default nextConfig;
