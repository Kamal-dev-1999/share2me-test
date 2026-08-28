/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
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
};

export default nextConfig;

