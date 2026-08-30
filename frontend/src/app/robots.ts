import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/p2p', '/g2p', '/about', '/blog', '/how-it-works', '/privacy', '/terms'],
      disallow: ['/p2p/*', '/g2p/*'],
    },
    sitemap: 'https://www.share2me.in/sitemap.xml',
  };
}
