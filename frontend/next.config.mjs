/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' mode bundles only the necessary files to run the app.
  // Required by the production Dockerfile for a minimal image size (~50MB vs 400MB+).
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,

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
};

export default nextConfig;

