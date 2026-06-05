/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow data: URIs (used for QR code base64 images)
    dangerouslyAllowSVG: true,
    remotePatterns: [],
    // data: URLs are generated locally by qrcode package — safe to allow
    unoptimized: true,
  },
};

export default nextConfig;

