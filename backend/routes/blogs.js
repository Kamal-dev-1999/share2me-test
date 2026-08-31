const express = require('express');
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const router = express.Router();

// Initialize AWS S3 Client
const s3Config = {
  region: process.env.AWS_REGION || 'ap-south-1',
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const s3 = new S3Client(s3Config);

const BUCKET_NAME = (process.env.S3_BLOGS_BUCKET || 'share2me-auto-blogs-prod').replace(/[^a-z0-9-]/g, '');

// In-memory cache
let blogListCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper function to convert S3 stream to string
const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

/**
 * GET /api/blogs
 * Fetch all blogs from S3 (metadata only, omitting large sections)
 */
router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    if (blogListCache && (now - lastCacheTime < CACHE_TTL)) {
      return res.json(blogListCache);
    }

    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'blogs/',
    });

    const response = await s3.send(listCommand);
    
    if (!response.Contents || response.Contents.length === 0) {
      return res.json([]);
    }

    // Filter for .json files and sort by LastModified descending
    const files = response.Contents
      .filter((obj) => obj.Key.endsWith('.json'))
      .sort((a, b) => b.LastModified - a.LastModified);

    // Fetch the contents of all blog files to build the index
    // Note: If you get hundreds of blogs, we should cache this heavily or use a metadata file.
    const blogs = await Promise.all(
      files.map(async (file) => {
        try {
          const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: file.Key,
          });
          const objResponse = await s3.send(getCommand);
          const contentStr = await streamToString(objResponse.Body);
          const blogData = JSON.parse(contentStr);
          
          // Extract slug from filename (e.g. blogs/2026-08-28-title.json)
          const slug = file.Key.replace('blogs/', '').replace('.json', '');

          return {
            slug,
            title: blogData.title,
            category: blogData.category,
            readTime: blogData.readTime,
            date: blogData.date,
            intro: blogData.intro, // We need intro for the index card
            status: blogData.status,
          };
        } catch (err) {
          console.error(`[Blogs] Error parsing blog ${file.Key}:`, err);
          return null;
        }
      })
    );

    // Filter out any that failed to parse AND filter out drafts
    blogListCache = blogs.filter(blog => blog && blog.status !== 'draft');
    lastCacheTime = Date.now();

    res.json(blogListCache);
  } catch (error) {
    console.error('[Blogs] Fetch index error:', error);
    
    // If credentials are not configured on the deployment platform, return empty list gracefully 
    // instead of a 500 error which would break Next.js static generation.
    if (error.name === 'CredentialsProviderError') {
      return res.json([]);
    }
    
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

/**
 * GET /api/blogs/:slug
 * Fetch a specific blog by slug
 */
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  // Basic sanitization
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug format' });
  }

  try {
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `blogs/${slug}.json`,
    });
    
    const objResponse = await s3.send(getCommand);
    const contentStr = await streamToString(objResponse.Body);
    const blogData = JSON.parse(contentStr);

    res.json(blogData);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return res.status(404).json({ error: 'Blog not found' });
    }
    console.error(`[Blogs] Fetch blog ${slug} error:`, error);
    res.status(500).json({ error: 'Failed to fetch blog content' });
  }
});

module.exports = router;
