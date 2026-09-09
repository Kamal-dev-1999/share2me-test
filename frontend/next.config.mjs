/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  // 'standalone' mode bundles only the necessary files to run the app.
  // Required by the production Dockerfile for a minimal image size (~50MB vs 400MB+).
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        "string_decoder/": false,
        "string_decoder": false,
        "https-proxy-agent": false,
      };
    }
    return config;
  },

  async headers() {
    return [
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://pagead2.googlesyndication.com https://partner.googleadservices.com https://adservice.google.com https://googleads.g.doubleclick.net https://checkout.razorpay.com https://unpkg.com https://cdnjs.cloudflare.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http://localhost:* http://127.0.0.1:*",
              "connect-src 'self' blob: data: wss: ws: https: http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https://www.google-analytics.com https://analytics.google.com https://region1.analytics.google.com https://pagead2.googlesyndication.com https://api.razorpay.com https://lumberjack-cx.razorpay.com https://unpkg.com",
              "media-src 'self' blob: https: http://localhost:* http://127.0.0.1:*",
              "worker-src 'self' blob: https://unpkg.com",
              "frame-src 'self' blob: https://www.googletagmanager.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://api.razorpay.com https://checkout.razorpay.com",
              "object-src 'self' blob:",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";
    return [
      {
        source: "/api/admin/:path*",
        destination: `${backendUrl}/api/admin/:path*`,
      },
      {
        source: "/api/tools/:path*",
        destination: `${backendUrl}/api/tools/:path*`,
      },
    ];
  },
};

export default nextConfig;
