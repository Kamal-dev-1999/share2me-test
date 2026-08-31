import { MetadataRoute } from 'next';
import { LANDING_PAGES } from './[...slug]/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.share2me.in';

  const baseRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: baseUrl + '/p2p',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: baseUrl + '/g2p',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: baseUrl + '/how-it-works',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: baseUrl + '/pricing',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: baseUrl + '/tools',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: baseUrl + '/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: baseUrl + '/privacy',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: baseUrl + '/terms',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
    {
      url: baseUrl + '/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }
  ];

  // Dynamic Tools Pages
  const { PDF_TOOLS } = await import('@/lib/pdfTools');
  const toolRoutes: MetadataRoute.Sitemap = PDF_TOOLS.map((tool) => ({
    url: `${baseUrl}/tools/${tool.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Dynamic Landing Pages
  const landingRoutes: MetadataRoute.Sitemap = Object.keys(LANDING_PAGES).map((slug) => ({
    url: `${baseUrl}/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Dynamic Blog Posts
  const backendUrl = process.env.NEXT_PUBLIC_EXPRESS_URL || 'http://localhost:3000';
  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${backendUrl}/api/blogs`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const blogs = await res.json();
      blogRoutes = blogs.map((b: any) => ({
        url: `${baseUrl}/blog/${b.slug}`,
        lastModified: new Date(b.date || Date.now()),
        changeFrequency: 'monthly',
        priority: 0.7,
      }));
    }
  } catch (err) {
    console.error('Sitemap failed to fetch blogs:', err);
  }

  return [...baseRoutes, ...landingRoutes, ...toolRoutes, ...blogRoutes];
}
