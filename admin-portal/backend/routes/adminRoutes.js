'use strict';

const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { adminAuthMiddleware, getAuthorizedAdminEmails } = require('../lib/adminAuth');
const { validateBlogSeo } = require('../lib/seoValidator');
const { publishBlog, logAdminActivity, createBlogRevision, TARGET_DESTINATIONS } = require('../lib/publisher');

const fs = require('fs');
const path = require('path');

// Auto-initialize admin database tables on load
async function initAdminTables() {
  try {
    const schemaPath = path.join(__dirname, '../database/admin-schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await db.query(sql);
      console.log('[AdminDB] Admin database schema initialized successfully');
    }
  } catch (err) {
    console.warn('[AdminDB] Schema initialization notice:', err.message);
  }
}
initAdminTables();

// Apply admin authorization middleware to ALL /api/admin routes
router.use(adminAuthMiddleware);

// ── 1. Check Auth & Admin Status ─────────────────────────────────────────────
router.get('/check-auth', (req, res) => {
  res.json({
    authorized: true,
    email: req.adminEmail,
    allowedAdmins: getAuthorizedAdminEmails(),
    destinations: TARGET_DESTINATIONS,
  });
});

// ── 2. List All Blogs (with Search & Status Filter) ───────────────────────────
router.get('/blogs', async (req, res) => {
  try {
    const { status, search } = req.query;
    let queryText = `
      SELECT b.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', r.id,
                   'destination', r.destination,
                   'status', r.status,
                   'publishedUrl', r.published_url,
                   'publishedAt', r.published_at
                 )
               ) FILTER (WHERE r.id IS NOT NULL), '[]'
             ) AS records
      FROM admin_blogs b
      LEFT JOIN admin_publishing_records r ON b.id = r.blog_id
    `;
    const params = [];
    const whereClauses = [];

    if (status && status !== 'all') {
      params.push(status);
      whereClauses.push(`b.status = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      whereClauses.push(`(LOWER(b.title) LIKE $${params.length} OR LOWER(b.slug) LIKE $${params.length} OR LOWER(b.category) LIKE $${params.length})`);
    }

    if (whereClauses.length > 0) {
      queryText += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    queryText += ` GROUP BY b.id ORDER BY b.updated_at DESC`;

    const result = await db.query(queryText, params);
    res.json({ blogs: result.rows });
  } catch (err) {
    console.error('[AdminAPI] Failed to fetch blogs:', err);
    res.status(500).json({ error: 'Failed to retrieve blogs from database.' });
  }
});

// ── 3. Get Single Blog ────────────────────────────────────────────────────────
router.get('/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const blogRes = await db.query(`SELECT * FROM admin_blogs WHERE id = $1`, [id]);
    if (blogRes.rows.length === 0) {
      return res.status(404).json({ error: 'Blog not found.' });
    }

    const recordsRes = await db.query(`SELECT * FROM admin_publishing_records WHERE blog_id = $1 ORDER BY published_at DESC`, [id]);
    const revisionsRes = await db.query(`SELECT id, version, created_by, created_at FROM admin_blog_revisions WHERE blog_id = $1 ORDER BY version DESC`, [id]);

    res.json({
      blog: blogRes.rows[0],
      records: recordsRes.rows,
      revisions: revisionsRes.rows,
    });
  } catch (err) {
    console.error('[AdminAPI] Failed to fetch blog:', err);
    res.status(500).json({ error: 'Failed to fetch blog details.' });
  }
});

// ── 4. Save Draft ─────────────────────────────────────────────────────────────
router.post('/blogs/draft', async (req, res) => {
  try {
    const {
      id,
      title = 'Untitled Draft',
      slug,
      metaDescription = '',
      keywords = [],
      author = 'Share2Me Team',
      featuredImage = '',
      canonicalUrl = '',
      category = 'General',
      tags = [],
      htmlContent = '',
    } = req.body;

    const draftSlug = (slug && slug.trim()) ? slug.trim().toLowerCase() : `draft-${Date.now()}`;

    let blogRecord;
    if (id) {
      const updateRes = await db.query(
        `UPDATE admin_blogs
         SET title = $1, slug = $2, meta_description = $3, keywords = $4, author = $5,
             featured_image = $6, canonical_url = $7, category = $8, tags = $9,
             html_content = $10, status = 'draft', updated_at = NOW()
         WHERE id = $11
         RETURNING *`,
        [title, draftSlug, metaDescription, keywords, author, featuredImage, canonicalUrl, category, tags, htmlContent, id]
      );
      blogRecord = updateRes.rows[0];
    } else {
      const insertRes = await db.query(
        `INSERT INTO admin_blogs 
           (title, slug, meta_description, keywords, author, featured_image, canonical_url, category, tags, html_content, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
         RETURNING *`,
        [title, draftSlug, metaDescription, keywords, author, featuredImage, canonicalUrl, category, tags, htmlContent]
      );
      blogRecord = insertRes.rows[0];
    }

    await logAdminActivity({
      adminEmail: req.adminEmail,
      action: 'SAVE_DRAFT',
      blogTitle: title,
      status: 'SUCCESS',
    });

    res.json({ message: 'Draft saved successfully.', blog: blogRecord });
  } catch (err) {
    console.error('[AdminAPI] Failed to save draft:', err);
    res.status(500).json({ error: `Failed to save draft: ${err.message}` });
  }
});

// ── 5. Run SEO Validation ──────────────────────────────────────────────────────
router.post('/blogs/validate-seo', (req, res) => {
  try {
    const body = req.body || {};
    const validation = validateBlogSeo(body);
    res.json(validation);
  } catch (err) {
    console.error('[AdminAPI] SEO validation error:', err);
    res.json({
      isValid: false,
      errors: [{ id: 'validation_error', message: 'SEO validation processing error: ' + err.message }],
      warnings: [],
      summary: { errorCount: 1, warningCount: 0 }
    });
  }
});

// ── 6. Publish Blog ───────────────────────────────────────────────────────────
router.post('/blogs/publish', async (req, res) => {
  try {
    const body = req.body || {};
    const { destinations = [], blogData = {} } = body;
    if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
      return res.status(400).json({ error: 'Please select at least one publishing destination.' });
    }

    const publishResult = await publishBlog(destinations, blogData, req.adminEmail);
    res.json(publishResult);
  } catch (err) {
    console.error('[AdminAPI] Publishing failed:', err);
    res.status(400).json({ error: err.message });
  }
});

// ── 7. Delete Blog ────────────────────────────────────────────────────────────
router.delete('/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fetchRes = await db.query(`SELECT title FROM admin_blogs WHERE id = $1`, [id]);
    const title = fetchRes.rows[0]?.title || id;

    await db.query(`DELETE FROM admin_blogs WHERE id = $1`, [id]);

    await logAdminActivity({
      adminEmail: req.adminEmail,
      action: 'DELETE_BLOG',
      blogTitle: title,
      status: 'SUCCESS',
    });

    res.json({ message: 'Blog deleted successfully.' });
  } catch (err) {
    console.error('[AdminAPI] Failed to delete blog:', err);
    res.status(500).json({ error: 'Failed to delete blog.' });
  }
});

// ── 8. Duplicate Blog ─────────────────────────────────────────────────────────
router.post('/blogs/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params;
    const origRes = await db.query(`SELECT * FROM admin_blogs WHERE id = $1`, [id]);
    if (origRes.rows.length === 0) return res.status(404).json({ error: 'Blog not found' });

    const orig = origRes.rows[0];
    const newTitle = `${orig.title} (Copy)`;
    const newSlug = `${orig.slug}-copy-${Date.now().toString().slice(-4)}`;

    const dupRes = await db.query(
      `INSERT INTO admin_blogs 
         (title, slug, meta_description, keywords, author, featured_image, canonical_url, category, tags, html_content, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
       RETURNING *`,
      [newTitle, newSlug, orig.meta_description, orig.keywords, orig.author, orig.featured_image, orig.canonical_url, orig.category, orig.tags, orig.html_content]
    );

    await logAdminActivity({
      adminEmail: req.adminEmail,
      action: 'DUPLICATE_BLOG',
      blogTitle: newTitle,
      status: 'SUCCESS',
    });

    res.json({ message: 'Blog duplicated successfully.', blog: dupRes.rows[0] });
  } catch (err) {
    console.error('[AdminAPI] Failed to duplicate blog:', err);
    res.status(500).json({ error: 'Failed to duplicate blog.' });
  }
});

// ── 9. Revisions History & Rollback ──────────────────────────────────────────
router.get('/blogs/:id/revisions', async (req, res) => {
  try {
    const { id } = req.params;
    const revisionsRes = await db.query(
      `SELECT id, version, html_content, metadata_snapshot, created_by, created_at
       FROM admin_blog_revisions
       WHERE blog_id = $1
       ORDER BY version DESC`,
      [id]
    );
    res.json({ revisions: revisionsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch revisions.' });
  }
});

router.post('/blogs/:id/revisions/:version/restore', async (req, res) => {
  try {
    const { id, version } = req.params;
    const revRes = await db.query(
      `SELECT * FROM admin_blog_revisions WHERE blog_id = $1 AND version = $2`,
      [id, version]
    );

    if (revRes.rows.length === 0) {
      return res.status(404).json({ error: 'Revision not found.' });
    }

    const rev = revRes.rows[0];
    const meta = typeof rev.metadata_snapshot === 'string' ? JSON.parse(rev.metadata_snapshot) : rev.metadata_snapshot;

    const restoredRes = await db.query(
      `UPDATE admin_blogs
       SET title = $1, meta_description = $2, keywords = $3, author = $4,
           featured_image = $5, canonical_url = $6, category = $7, tags = $8,
           html_content = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        meta.title || 'Restored Blog',
        meta.metaDescription || '',
        meta.keywords || [],
        meta.author || 'Share2Me Team',
        meta.featuredImage || '',
        meta.canonicalUrl || '',
        meta.category || 'General',
        meta.tags || [],
        rev.html_content,
        id,
      ]
    );

    await logAdminActivity({
      adminEmail: req.adminEmail,
      action: 'RESTORE_REVISION',
      blogTitle: meta.title,
      status: 'SUCCESS',
      errorDetails: `Restored to version #${version}`,
    });

    res.json({ message: `Successfully restored blog to Revision #${version}.`, blog: restoredRes.rows[0] });
  } catch (err) {
    console.error('[AdminAPI] Failed to restore revision:', err);
    res.status(500).json({ error: 'Failed to restore revision.' });
  }
});

// ── 10. Audit Activity Logs ───────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
  try {
    const logsRes = await db.query(
      `SELECT * FROM admin_activity_logs ORDER BY timestamp DESC LIMIT 100`
    );
    res.json({ logs: logsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

module.exports = router;
