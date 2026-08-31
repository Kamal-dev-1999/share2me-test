'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer for memory storage (max 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const { spawn } = require('child_process');
const path = require('path');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5002/remove-background';
let isSpawning = false;

async function checkHealth() {
  try {
    const res = await fetch('http://127.0.0.1:5002/health', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.status === 'ready' || data.status === 'initializing') return true;
    }
  } catch {
    // service offline
  }
  return false;
}

async function ensureMlServiceRunning() {
  if (await checkHealth()) return true;

  if (isSpawning) {
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 600));
      if (await checkHealth()) return true;
    }
    return false;
  }

  isSpawning = true;
  try {
    const scriptPath = path.resolve(__dirname, '..', 'ml', 'bg_remover_service.py');
    console.log(`[Express BG-Remover] ML service offline. Auto-launching Python script at: ${scriptPath}`);

    const pythonCmd = process.env.PYTHON_EXECUTABLE || 'python';
    const pythonProc = spawn(pythonCmd, [scriptPath], {
      detached: true,
      stdio: 'ignore',
      cwd: path.dirname(scriptPath),
    });
    pythonProc.unref();

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 600));
      if (await checkHealth()) {
        console.log('[Express BG-Remover] Python ML service auto-launched and active!');
        return true;
      }
    }
  } catch (err) {
    console.error('[Express BG-Remover] Failed to auto-launch Python ML service:', err);
  } finally {
    isSpawning = false;
  }
  return false;
}

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

    let apiRes = null;
    try {
      apiRes = await fetch(ML_SERVICE_URL, {
        method: 'POST',
        body: formData,
      });
    } catch (fetchErr) {
      console.warn('[Express BG-Remover Route] ML service connection error. Triggering auto-launch recovery...');
      const recovered = await ensureMlServiceRunning();
      if (recovered) {
        apiRes = await fetch(ML_SERVICE_URL, {
          method: 'POST',
          body: formData,
        });
      } else {
        throw fetchErr;
      }
    }

    if (!apiRes || !apiRes.ok) {
      const status = apiRes ? apiRes.status : 500;
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
      error: 'Self-hosted AI inference service is initializing. Please try again in a few seconds.'
    });
  }
});

module.exports = router;
