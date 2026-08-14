const express = require('express');
const router = express.Router();
const multer = require('multer');
const { execFile } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const upload = multer({ dest: os.tmpdir() });

router.post('/process', upload.array('files'), async (req, res) => {
  try {
    const { slug, config: configStr } = req.body;
    const config = configStr ? JSON.parse(configStr) : {};
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).send('No files provided.');
    }

    if (slug === 'protect-pdf') {
      const { userPassword, ownerPassword } = config;
      if (!userPassword) {
        // Clean up inputs
        for (const f of files) await fs.unlink(f.path).catch(() => {});
        return res.status(400).send('A user password is required to protect the PDF.');
      }

      const inputPath = files[0].path;
      const outputPath = `${inputPath}-protected.pdf`;

      const pw = ownerPassword || userPassword;
      // qpdf --encrypt user-password owner-password 256 -- input.pdf output.pdf
      const args = [
        '--encrypt',
        userPassword,
        pw,
        '256',
        '--',
        inputPath,
        outputPath
      ];

      execFile('qpdf', args, async (error, stdout, stderr) => {
        // Clean up input
        await fs.unlink(inputPath).catch(() => {});

        if (error) {
          console.error('QPDF Error:', stderr);
          return res.status(500).send('Failed to encrypt PDF.');
        }

        res.download(outputPath, 'protected.pdf', async (err) => {
          // Clean up output after send
          await fs.unlink(outputPath).catch(() => {});
        });
      });
    } else {
      // Clean up inputs for unsupported tools
      for (const f of files) {
        await fs.unlink(f.path).catch(() => {});
      }
      return res.status(400).send(`Server-side tool ${slug} is not implemented yet.`);
    }

  } catch (error) {
    console.error('Tool processing error:', error);
    res.status(500).send('An unexpected error occurred on the server.');
  }
});
const r2 = require('../../lib/r2');
const bullmqMock = require('../workers/bullmq-mock');
const { v4: uuidv4 } = require('uuid');

// ── PHASE 2 ASYNC ENDPOINTS ──────────────────────────────────────────────────

router.post('/presign', async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Filename is required' });

    const fileExt = path.extname(filename);
    const fileKey = `tools/input/${uuidv4()}${fileExt}`;
    const uploadUrl = await r2.getUploadUrl(fileKey);

    res.json({ r2_key: fileKey, upload_url: uploadUrl });
  } catch (error) {
    console.error('Presign error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

router.post('/:slug/enqueue', async (req, res) => {
  try {
    const { slug } = req.params;
    const { input_r2_key, filename, sizeBytes, config } = req.body;

    if (!input_r2_key) return res.status(400).json({ error: 'input_r2_key is required' });

    const job = await bullmqMock.addJob('tools-queue', {
      slug,
      input_r2_key,
      filename,
      sizeBytes,
      config
    });

    res.json({ job_id: job.id });
  } catch (error) {
    console.error('Enqueue error:', error);
    res.status(500).json({ error: 'Failed to enqueue job' });
  }
});

router.get('/jobs/:job_id/stream', (req, res) => {
  const { job_id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send an initial heartbeat to establish connection
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const unsubscribe = bullmqMock.subscribeToJobEvents(job_id, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    
    if (event.type === 'complete' || event.type === 'error') {
      res.end();
      unsubscribe();
    }
  });

  req.on('close', () => {
    unsubscribe();
  });
});

// Download the final output
router.get('/jobs/:job_id/download', async (req, res) => {
  try {
    const { output_key } = req.query; // Assume the client passes output_key in query
    if (!output_key) return res.status(400).json({ error: 'output_key is required' });

    const downloadUrl = await r2.getDownloadUrl(output_key);
    res.json({ download_url: downloadUrl });
  } catch (error) {
    console.error('Download presign error:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});
module.exports = router;
