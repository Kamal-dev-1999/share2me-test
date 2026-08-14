const { EventEmitter } = require('events');
const { v4: uuidv4 } = require('uuid');

// In-memory job event bus
const jobEvents = new EventEmitter();

/**
 * Mock adding a job to BullMQ
 * @param {string} queueName 
 * @param {object} data 
 * @returns {object} The mocked job object
 */
async function addJob(queueName, data) {
  const jobId = uuidv4();
  
  // Simulate asynchronous worker picking up the job
  setTimeout(() => {
    processJob(jobId, data);
  }, 1000);

  return { id: jobId };
}

/**
 * Subscribe to job progress/completion events
 * @param {string} jobId 
 * @param {function} callback 
 */
function subscribeToJobEvents(jobId, callback) {
  const listener = (event) => callback(event);
  jobEvents.on(`job:${jobId}`, listener);
  return () => jobEvents.off(`job:${jobId}`, listener);
}

// Private dummy worker function
async function processJob(jobId, data) {
  console.log(`[Worker Mock] Processing job ${jobId}`, data);
  const { slug } = data;

  // Let's emit some progress
  jobEvents.emit(`job:${jobId}`, { type: 'progress', pct: 10, message: 'Initializing engine...' });
  await sleep(1500);

  jobEvents.emit(`job:${jobId}`, { type: 'progress', pct: 30, message: 'Downloading input from R2...' });
  await sleep(2000);

  jobEvents.emit(`job:${jobId}`, { type: 'progress', pct: 60, message: `Running ${slug} engine...` });
  await sleep(3000);

  jobEvents.emit(`job:${jobId}`, { type: 'progress', pct: 90, message: 'Uploading output to R2...' });
  await sleep(1500);

  // Return dummy completed event. In a real scenario, this would be an R2 key.
  // For the mock, we can just say it's done. But wait, if we are actually uploading to R2,
  // we might want the mock to just return a dummy output key so the UI can fetch it?
  // Let's just return a dummy output_key.
  jobEvents.emit(`job:${jobId}`, { 
    type: 'complete', 
    output_key: `tools/output/mock-output-${jobId}.pdf`,
    output_bytes: 1024 * 500 // 500kb
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  addJob,
  subscribeToJobEvents,
};
