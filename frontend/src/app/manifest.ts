import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Share2Me — Secure P2P File Transfer',
    short_name: 'Share2Me',
    description: 'Send files peer-to-peer with end-to-end AES-GCM encryption and ECDH key exchange.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0e11',
    theme_color: '#0b0e11',
    icons: [
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
