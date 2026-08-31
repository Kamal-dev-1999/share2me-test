'use strict';

const db = require('./db');
const { validateBlogSeo } = require('./seoValidator');

/**
 * Modular Multi-Site Publishing Adapter
 * Handles publication to share2.me, share2me.in, or future target destinations.
 */

const TARGET_DESTINATIONS = {
  share2me: {
    label: 'Share2Me (share2.me)',
    domain: 'https://share2.me',
    tokenEnv: 'SHARE2ME_DEPLOY_TOKEN',
  },
  share2me_in: {
    label: 'Share2Me India (share2me.in)',
    domain: 'https://share2me.in',
    tokenEnv: 'SHARE2ME_IN_DEPLOY_TOKEN',
  },
};

async function logAdminActivity({ adminEmail, action, blogTitle, destination, status, errorDetails }) {
  try {
    await db.query(
      `INSERT INTO admin_activity_logs (admin_email, action, blog_title, destination, status, error_details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminEmail, action, blogTitle || 'Untitled', destination || 'N/A', status, errorDetails || null]
    );
  } catch (err) {
    console.error('[AdminLog] Failed to record activity log:', err.message);
  }
}

async function createBlogRevision(blogId, htmlContent, metadataSnapshot, adminEmail) {
  try {
    const res = await db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM admin_blog_revisions WHERE blog_id = $1`,
      [blogId]
    );
    const nextVersion = res.rows[0].next_version;

    await db.query(
      `INSERT INTO admin_blog_revisions (blog_id, version, html_content, metadata_snapshot, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [blogId, nextVersion, htmlContent, JSON.stringify(metadataSnapshot), adminEmail]
    );
    return nextVersion;
  } catch (err) {
    console.error('[Revision] Failed to create blog revision:', err.message);
    return 1;
  }
}

async function publishSingleDestination(destinationKey, blog, adminEmail) {
  const targetConfig = TARGET_DESTINATIONS[destinationKey];
  if (!targetConfig) {
    throw new Error(`Unknown publishing destination: "${destinationKey}"`);
  }

  const deployToken = process.env[targetConfig.tokenEnv] || 'default_server_deploy_token';
  const publishedUrl = `${targetConfig.domain}/blog/${blog.slug}`;

  // Perform backend deployment API ping / webhook trigger if webhook URL is configured
  const webhookUrlEnv = `DEPLOY_WEBHOOK_${destinationKey.toUpperCase()}`;
  const webhookUrl = process.env[webhookUrlEnv];

  if (webhookUrl) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deployToken}`,
        },
        body: JSON.stringify({
          action: 'PUBLISH_BLOG',
          slug: blog.slug,
          title: blog.title,
          url: publishedUrl,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Deployment server returned status ${response.status}: ${await response.text()}`);
      }
    } catch (err) {
      console.error(`[Publish:${destinationKey}] Deployment webhook failed:`, err.message);
    }
  }

  // Record publishing result in database
  await db.query(
    `INSERT INTO admin_publishing_records (blog_id, destination, status, published_url, published_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [blog.id, destinationKey, 'published', publishedUrl]
  );

  await logAdminActivity({
    adminEmail,
    action: 'PUBLISH_BLOG',
    blogTitle: blog.title,
    destination: targetConfig.label,
    status: 'SUCCESS',
  });

  return {
    destination: destinationKey,
    label: targetConfig.label,
    status: 'published',
    url: publishedUrl,
  };
}

async function publishBlog(destinations, blogData, adminEmail) {
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw new Error('At least one publishing destination must be selected (e.g. "share2me" or "share2me_in").');
  }

  // 1. Run SEO validation
  const validation = validateBlogSeo(blogData);
  if (!validation.isValid) {
    const errorMsgs = validation.errors.map((e) => e.message).join(' ');
    throw new Error(`SEO Validation Failed: ${errorMsgs}`);
  }

  const {
    id,
    title,
    slug,
    metaDescription,
    keywords = [],
    author = 'Share2Me Team',
    featuredImage,
    canonicalUrl,
    category = 'General',
    tags = [],
    htmlContent,
  } = blogData;

  // 2. Upsert blog into database
  let blogId = id;
  let blogRecord;

  if (blogId) {
    const updateRes = await db.query(
      `UPDATE admin_blogs
       SET title = $1, slug = $2, meta_description = $3, keywords = $4, author = $5,
           featured_image = $6, canonical_url = $7, category = $8, tags = $9,
           html_content = $10, status = 'published', updated_at = NOW(), published_at = COALESCE(published_at, NOW())
       WHERE id = $11
       RETURNING *`,
      [title, slug, metaDescription, keywords, author, featuredImage, canonicalUrl, category, tags, htmlContent, blogId]
    );
    blogRecord = updateRes.rows[0];
  } else {
    const insertRes = await db.query(
      `INSERT INTO admin_blogs 
         (title, slug, meta_description, keywords, author, featured_image, canonical_url, category, tags, html_content, status, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'published', NOW())
       RETURNING *`,
      [title, slug, metaDescription, keywords, author, featuredImage, canonicalUrl, category, tags, htmlContent]
    );
    blogRecord = insertRes.rows[0];
    blogId = blogRecord.id;
  }

  // 3. Save Revision Snapshot
  await createBlogRevision(blogId, htmlContent, blogData, adminEmail);

  // 4. Publish to each selected target destination
  const results = [];
  const failures = [];

  for (const dest of destinations) {
    try {
      const res = await publishSingleDestination(dest, blogRecord, adminEmail);
      results.push(res);
    } catch (err) {
      console.error(`[Publishing] Failed to publish to ${dest}:`, err.message);
      failures.push({
        destination: dest,
        label: TARGET_DESTINATIONS[dest]?.label || dest,
        status: 'failed',
        error: err.message,
      });

      await db.query(
        `INSERT INTO admin_publishing_records (blog_id, destination, status, error_message, published_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [blogId, dest, 'failed', err.message]
      );

      await logAdminActivity({
        adminEmail,
        action: 'PUBLISH_BLOG',
        blogTitle: title,
        destination: dest,
        status: 'FAILED',
        errorDetails: err.message,
      });
    }
  }

  return {
    blog: blogRecord,
    results,
    failures,
    hasFailures: failures.length > 0,
  };
}

module.exports = {
  publishBlog,
  logAdminActivity,
  createBlogRevision,
  TARGET_DESTINATIONS,
};
