'use strict';
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const r2 = require('../../lib/r2');
const bullmqMock = require('../workers/bullmq-mock');
const { v4: uuidv4 } = require('uuid');
const { verifyVendorJWT } = require('../lib/auth');

// ── Rate Limiting ─────────────────────────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hrs
  max: 20,
  message: { error: 'You have exceeded your 20 free daily requests. Please try again tomorrow.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Auth Middleware ───────────────────────────────────────────────────────────
// All tools endpoints require a valid vendor JWT.

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  const vendor = await verifyVendorJWT(token);
  if (!vendor) return res.status(401).json({ error: 'unauthorized' });
  req.vendorId = vendor.id;
  next();
}

// ── Slug Whitelist ────────────────────────────────────────────────────────────
// Only known tool slugs may be enqueued.

const ALLOWED_SLUGS = new Set([
  'word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'html-to-pdf',
  'ocr-pdf', 'ai-summarizer', 'translate-pdf',
  'pdf-to-markdown', 'repair-pdf', 'pdf-to-pdfa',
  'pdf-to-word', 'pdf-to-excel', 'pdf-to-powerpoint',
  'protect-pdf',
]);

// ── Config Schema (per-slug) ──────────────────────────────────────────────────

const configSchemas = {
  'translate-pdf': z.object({ targetLanguage: z.string().max(50).optional() }),
  'protect-pdf':   z.object({
    userPassword:  z.string().min(1).max(128),
    ownerPassword: z.string().max(128).optional(),
  }),
  'default': z.object({}).passthrough(), // unknown fields stripped by safeParse
};

function parseConfig(slug, rawConfig) {
  const schema = configSchemas[slug] || configSchemas['default'];
  const result = schema.safeParse(rawConfig || {});
  if (!result.success) return null;
  return result.data;
}

// ── In-memory job ownership store ─────────────────────────────────────────────
// Maps jobId → vendorId. Used to enforce output download ownership.
// Ephemeral: survives as long as the process is running.

const jobOwners = new Map(); // jobId → vendorId

// ── File Upload (Multer) ──────────────────────────────────────────────────────

const upload = multer({ dest: os.tmpdir() });

// ── /process — Synchronous protect-pdf endpoint ───────────────────────────────

router.post('/process', requireAuth, upload.array('files'), async (req, res) => {
  try {
    const { slug, config: configStr } = req.body;

    if (slug !== 'protect-pdf') {
      if (req.files) for (const f of req.files) await fs.unlink(f.path).catch(() => {});
      return res.status(400).json({ error: 'Only protect-pdf is handled by /process.' });
    }

    const rawConfig = configStr ? JSON.parse(configStr) : {};
    const config = parseConfig(slug, rawConfig);
    if (!config) {
      if (req.files) for (const f of req.files) await fs.unlink(f.path).catch(() => {});
      return res.status(400).json({ error: 'Invalid configuration for this tool.' });
    }

    const files = req.files;
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files provided.' });

    const { userPassword, ownerPassword } = config;
    const inputPath = files[0].path;
    const outputPath = `${inputPath}-protected.pdf`;
    const pw = ownerPassword || userPassword;

    const args = ['--encrypt', userPassword, pw, '256', '--', inputPath, outputPath];

    execFile('qpdf', args, async (error, _stdout, stderr) => {
      await fs.unlink(inputPath).catch(() => {});
      if (error) {
        console.error('[Tools] QPDF Error:', stderr);
        return res.status(500).json({ error: 'Failed to encrypt PDF.' });
      }
      res.download(outputPath, 'protected.pdf', async () => {
        await fs.unlink(outputPath).catch(() => {});
      });
    });

  } catch (error) {
    console.error('[Tools] /process error:', error);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

// ── /presign — Generate R2 upload URL ─────────────────────────────────────────

router.post('/presign', requireAuth, async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename || typeof filename !== 'string' || filename.length > 255) {
      return res.status(400).json({ error: 'A valid filename is required.' });
    }

    // Sanitize: strip path traversal, keep only extension
    const safeExt = path.extname(path.basename(filename)).toLowerCase().slice(0, 10);
    const ALLOWED_EXTS = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.html', '.htm', '.txt', '.jpg', '.jpeg', '.png']);
    if (!ALLOWED_EXTS.has(safeExt)) {
      return res.status(400).json({ error: 'File type not allowed.' });
    }

    const fileKey = `tools/input/${uuidv4()}${safeExt}`;
    const uploadUrl = await r2.getUploadUrl(fileKey);
    res.json({ r2_key: fileKey, upload_url: uploadUrl });

  } catch (error) {
    console.error('[Tools] /presign error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL.' });
  }
});

// ── /:slug/enqueue — Queue an async job ───────────────────────────────────────

router.post('/:slug/enqueue', requireAuth, apiLimiter, async (req, res) => {
  try {
    const { slug } = req.params;

    // 1. Slug whitelist
    if (!ALLOWED_SLUGS.has(slug)) {
      return res.status(400).json({ error: `Unknown tool: ${slug}` });
    }

    const { input_r2_key, filename, sizeBytes, config: rawConfig } = req.body;
    if (!input_r2_key || typeof input_r2_key !== 'string') {
      return res.status(400).json({ error: 'input_r2_key is required.' });
    }

    // 2. Validate that the R2 key belongs to the tools/input/ prefix (not arbitrary path)
    if (!input_r2_key.startsWith('tools/input/')) {
      return res.status(400).json({ error: 'Invalid input key.' });
    }

    // 3. Parse and validate config
    const config = parseConfig(slug, rawConfig);
    if (config === null) {
      return res.status(400).json({ error: 'Invalid configuration for this tool.' });
    }

    const job = await bullmqMock.addJob('tools-queue', {
      slug,
      input_r2_key,
      filename,
      sizeBytes,
      config,
    });

    // 4. Store job ownership — only this vendor can download the output
    jobOwners.set(job.id, req.vendorId);

    res.json({ job_id: job.id });

  } catch (error) {
    console.error('[Tools] /enqueue error:', error);
    res.status(500).json({ error: 'Failed to enqueue job.' });
  }
});

// ── /jobs/:job_id/stream — SSE progress stream ────────────────────────────────

router.get('/jobs/:job_id/stream', requireAuth, (req, res) => {
  const { job_id } = req.params;

  // Ownership check — must be the job creator or an unowned job (already completed)
  const owner = jobOwners.get(job_id);
  if (owner && owner !== req.vendorId) {
    return res.status(403).json({ error: 'forbidden' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const unsubscribe = bullmqMock.subscribeToJobEvents(job_id, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    if (event.type === 'complete' || event.type === 'error') {
      res.end();
      unsubscribe();
    }
  });

  req.on('close', () => { unsubscribe(); });
});

// ── /jobs/:job_id/download — Get output presigned URL ────────────────────────

router.get('/jobs/:job_id/download', requireAuth, async (req, res) => {
  try {
    const { job_id } = req.params;

    // ── OWNERSHIP CHECK ───────────────────────────────────────────────────────
    const owner = jobOwners.get(job_id);
    if (!owner) {
      return res.status(404).json({ error: 'Job not found or already expired.' });
    }
    if (owner !== req.vendorId) {
      return res.status(403).json({ error: 'You do not have permission to download this output.' });
    }

    const { output_key } = req.query;
    if (!output_key || typeof output_key !== 'string') {
      return res.status(400).json({ error: 'output_key is required.' });
    }

    // Validate the output key belongs to the expected output path (not arbitrary R2 key)
    if (!output_key.startsWith('tools/output/')) {
      return res.status(400).json({ error: 'Invalid output key.' });
    }

    const downloadUrl = await r2.getDownloadUrl(output_key);
    res.json({ download_url: downloadUrl });

  } catch (error) {
    console.error('[Tools] /download error:', error);
    res.status(500).json({ error: 'Failed to generate download URL.' });
  }
});

module.exports = router;
