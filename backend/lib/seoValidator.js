'use strict';

/**
 * SEO Validation Engine
 * Analyzes HTML content and Metadata, separating findings into ERRORS (blocking) and WARNINGS (advisory).
 */

function validateBlogSeo(blogData = {}) {
  const errors = [];
  const warnings = [];

  const safeData = (blogData && typeof blogData === 'object') ? blogData : {};

  const {
    title = '',
    slug = '',
    htmlContent = '',
    metaDescription = '',
    canonicalUrl = '',
    featuredImage = '',
    category = '',
  } = safeData;

  const safeTitle = (title || '').toString();
  const safeSlug = (slug || '').toString();
  const safeHtml = (htmlContent || '').toString();
  const safeMetaDesc = (metaDescription || '').toString();
  const safeCanonical = (canonicalUrl || '').toString();
  const safeImage = (featuredImage || '').toString();

  // ── 1. Blocking Errors ───────────────────────────────────────────────────────
  if (!safeTitle || !safeTitle.trim()) {
    errors.push({ id: 'title_missing', message: 'Blog Title is required.' });
  }

  if (!safeSlug || !safeSlug.trim()) {
    errors.push({ id: 'slug_missing', message: 'Blog Slug is required.' });
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(safeSlug.trim())) {
    errors.push({ id: 'slug_invalid', message: 'Slug must contain only lowercase letters, numbers, and hyphens (e.g. "how-webrtc-works").' });
  }

  if (!safeHtml || !safeHtml.trim()) {
    errors.push({ id: 'html_empty', message: 'HTML content cannot be empty.' });
  }

  // Count H1 tags in HTML
  const h1Match = safeHtml.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
  if (h1Match.length > 1) {
    errors.push({ id: 'multiple_h1', message: `Found ${h1Match.length} <h1> tags. Every page must have exactly ONE <h1> tag for SEO.` });
  }

  // Check for malformed HTML structure (basic tag matching)
  if (safeHtml.includes('<html') && !safeHtml.includes('</html>')) {
    errors.push({ id: 'html_malformed', message: 'HTML document has unclosed <html> tag.' });
  }

  // ── 2. Advisory Warnings ──────────────────────────────────────────────────────
  if (safeTitle.length > 60) {
    warnings.push({ id: 'title_length', message: `Title is ${safeTitle.length} characters long. Recommended length is under 60 characters for search snippet previews.` });
  }

  if (!safeMetaDesc || !safeMetaDesc.trim()) {
    warnings.push({ id: 'meta_desc_missing', message: 'Meta description is missing.' });
  } else if (safeMetaDesc.length > 160) {
    warnings.push({ id: 'meta_desc_length', message: `Meta description is ${safeMetaDesc.length} characters long. Recommended length is between 120-160 characters.` });
  }

  if (h1Match.length === 0) {
    warnings.push({ id: 'h1_missing', message: 'No <h1> tag found in HTML content or title.' });
  }

  if (!safeCanonical || !safeCanonical.trim()) {
    warnings.push({ id: 'canonical_missing', message: 'Canonical URL is missing. Adding a canonical URL prevents duplicate content penalties.' });
  }

  if (!safeImage || !safeImage.trim()) {
    warnings.push({ id: 'featured_image_missing', message: 'Featured Image URL is missing. Adding a social preview image increases CTR.' });
  }

  // Check images missing alt text
  const imgTags = safeHtml.match(/<img[^>]*>/gi) || [];
  const imgWithoutAlt = imgTags.filter((img) => !/alt=["']([^"']+)["']/i.test(img) || /alt=["']\s*["']/i.test(img));

  if (imgWithoutAlt.length > 0) {
    warnings.push({
      id: 'img_alt_missing',
      message: `${imgWithoutAlt.length} image(s) missing descriptive alt attributes for accessibility and SEO.`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length,
    },
  };
}

module.exports = {
  validateBlogSeo,
};
