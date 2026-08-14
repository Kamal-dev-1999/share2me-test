const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');
const r2 = require('../../lib/r2');
const path = require('path');
const axios = require('axios'); // For downloading from R2 presigned URLs
const fs = require('fs/promises');

// Engines
const libreoffice = require('./engines/libreoffice');
const puppeteer = require('./engines/puppeteer');
const ai = require('./engines/ai');

// In-memory job event bus
const jobEvents = new EventEmitter();

async function addJob(queueName, data) {
  const jobId = uuidv4();
  
  // Simulate asynchronous worker picking up the job
  setTimeout(() => {
    processJob(jobId, data).catch(err => {
      console.error(`[Worker Mock] Job ${jobId} failed:`, err);
      jobEvents.emit(`job:${jobId}`, { type: 'error', message: err.message });
    });
  }, 500);

  return { id: jobId };
}

function subscribeToJobEvents(jobId, callback) {
  const listener = (event) => callback(event);
  jobEvents.on(`job:${jobId}`, listener);
  return () => jobEvents.off(`job:${jobId}`, listener);
}

async function processJob(jobId, data) {
  console.log(`[Worker Mock] Processing job ${jobId}`, data);
  const { slug, input_r2_key, config } = data;

  const emitProgress = (pct, message) => {
    jobEvents.emit(`job:${jobId}`, { type: 'progress', pct, message });
  };

  // 1. Download input from R2
  emitProgress(5, "Downloading input from cloud...");
  const downloadUrl = await r2.getDownloadUrl(input_r2_key);
  const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
  const inputBuffer = Buffer.from(response.data);

  // 2. Route to Engine
  let outputBuffer;
  let ext = '.pdf';

  if (slug === 'word-to-pdf' || slug === 'powerpoint-to-pdf' || slug === 'excel-to-pdf') {
    outputBuffer = await libreoffice.processDocxToPdf(inputBuffer, slug.split('-')[0], emitProgress);
  } 
  else if (slug === 'html-to-pdf') {
    outputBuffer = await puppeteer.processHtmlToPdf(inputBuffer, emitProgress);
  }
  else if (slug === 'ocr-pdf') {
    outputBuffer = await ai.processAi(inputBuffer, 'ocr', config, emitProgress);
  }
  else if (slug === 'ai-summarizer') {
    outputBuffer = await ai.processAi(inputBuffer, 'summarize', config, emitProgress);
  }
  else if (slug === 'translate-pdf') {
    outputBuffer = await ai.processAi(inputBuffer, 'translate', config, emitProgress);
  }
  else {
    throw new Error(`Engine for slug ${slug} is not implemented yet.`);
  }

  // 3. Upload Output to R2
  emitProgress(95, "Uploading output to cloud...");
  const outputKey = `tools/output/${jobId}${ext}`;
  const uploadUrl = await r2.getUploadUrl(outputKey);
  
  await axios.put(uploadUrl, outputBuffer, {
    headers: { 'Content-Type': ext === '.pdf' ? 'application/pdf' : 'text/plain' }
  });

  jobEvents.emit(`job:${jobId}`, { 
    type: 'complete', 
    output_key: outputKey,
    output_bytes: outputBuffer.length
  });
}

module.exports = {
  addJob,
  subscribeToJobEvents,
};
