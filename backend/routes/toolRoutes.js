'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer for memory storage (max 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5002/remove-background';

/**
 * POST /api/tools/bg-remover
 * Self-hosted AI background removal route.
 * Calls local Python AI inference service at ML_SERVICE_URL. Zero external API dependencies.
 */
router.post('/bg-remover', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validMimes.includes(req.file.mimetype.toLowerCase())) {
      return res.status(400).json({ error: 'Unsupported file format. Please upload a JPG, PNG, or WebP image.' });
    }

    // Prepare native FormData to pass to self-hosted ML service
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
    const formData = new FormData();
    formData.append('image', blob, req.file.originalname || 'upload.png');

    const apiRes = await fetch(ML_SERVICE_URL, {
      method: 'POST',
      body: formData,
    });

    if (!apiRes.ok) {
      const status = apiRes.status;
      let errorMsg = 'Failed to remove background from image.';
      try {
        const errJson = await apiRes.json();
        if (errJson && errJson.error) {
          errorMsg = errJson.error;
        }
      } catch (e) {
        // Not JSON
      }
      return res.status(status >= 400 && status < 600 ? status : 500).json({ error: errorMsg });
    }

    const arrayBuffer = await apiRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.send(buffer);
  } catch (err) {
    console.error('[BG-Remover Route] ML service connection error:', err.message);
    return res.status(503).json({
      error: 'Self-hosted AI inference service is starting or offline. Please check Python ML service status.'
    });
  }
});

module.exports = router;
