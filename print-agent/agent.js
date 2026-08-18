const { io } = require('socket.io-client');
const { print } = require('pdf-to-printer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const os = require('os');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const CONFIG_DIR = path.join(os.homedir(), '.share2me');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

function getSumatraPath() {
  if (process.pkg) {
    try {
      const sumatraSrc = path.join(path.dirname(require.resolve('pdf-to-printer')), 'SumatraPDF-3.4.6-32.exe');
      const sumatraDest = path.join(os.tmpdir(), 'Share2Me-SumatraPDF.exe');
      if (fs.existsSync(sumatraSrc)) {
        if (!fs.existsSync(sumatraDest)) {
          fs.copyFileSync(sumatraSrc, sumatraDest);
        }
        return sumatraDest;
      }
    } catch (e) {
      console.error('Could not extract SumatraPDF:', e);
    }
  }
  return undefined;
}

function loadToken() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return data.token;
    }
  } catch (err) { }
  return null;
}

function saveToken(token) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ token }));
  } catch (err) {
    console.error('Failed to save config:', err.message);
  }
}

async function startAgent() {
  if (process.platform === 'win32' && process.pkg && !process.argv.includes('--hidden')) {
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, ['--hidden'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
    process.exit(0);
  }

  if (process.argv.includes('--hidden')) {
    // Redirect console output to a log file to prevent crashes when stdout is closed
    const logStream = fs.createWriteStream(path.join(os.tmpdir(), 'Share2Me-Agent.log'), { flags: 'a' });
    console.log = function () {
      logStream.write(Array.from(arguments).join(' ') + '\n');
    };
    console.error = function () {
      logStream.write('[ERROR] ' + Array.from(arguments).join(' ') + '\n');
    };
  }

  console.log('--- Share2Me Print Agent Started ---');
  let token = loadToken();

  await new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Request-Private-Network');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }

      if (req.method === 'POST' && req.url === '/auth') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.token) {
              token = data.token;
              saveToken(token);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
              console.log('Received token from web dashboard! Connecting...');
              connectSocket(token);
            } else {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'invalid_token' }));
            }
          } catch (err) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'invalid_json' }));
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('Agent is already running! Exiting this instance.');
        process.exit(0);
      }
    });

    server.listen(13337, '127.0.0.1', () => {
      console.log('Local Bridge running on port 13337 (Single instance lock active).');
      resolve();
    });
  });

  if (!token) {
    console.log('Waiting for connection from the web dashboard... Please click "Link Agent" on the website.');
  } else {
    connectSocket(token);
  }
}

let socket = null;

function connectSocket(token) {
  if (socket) {
    socket.disconnect();
  }

  console.log('Connecting to server...');
  socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Connected to server! Authenticating...');
    socket.emit('agent:authenticate', { token }, async (res) => {
      if (res?.error) {
        console.error('Authentication failed:', res.error);
        return; // Don't exit, they can re-link from dashboard
      }

      console.log('Authentication successful! Fetching printers...');

      try {
        const { exec } = require('child_process');
        exec('wmic printer get name', (err, stdout) => {
          if (err) throw err;
          const printerNames = stdout.split('\n')
            .map(p => p.trim())
            .filter(p => p && p.toLowerCase() !== 'name');
          console.log(`Found ${printerNames.length} printers.`);
          socket.emit('agent:printers', { printers: printerNames });
        });
      } catch (err) {
        console.error('Failed to list printers:', err.message);
        socket.emit('agent:printers', { printers: [] });
      }
    });
  });

  socket.on('agent:print_job', async (job) => {
    console.log(`\n[New Job] ${job.jobId} -> ${job.printerName}`);
    console.log(`Copies: ${job.copies}, Color Mode: ${job.colorMode}`);

    // Download to system temp folder (pkg prevents writing to __dirname)
    const tempFilePath = path.join(os.tmpdir(), `job_${job.jobId}_${crypto.randomBytes(4).toString('hex')}.pdf`);

    try {
      console.log('Downloading file...');
      await downloadFile(job.fileUrl, tempFilePath);
      console.log('Printing...');

      const printOpts = {
        printer: job.printerName,
        copies: job.copies,
        monochrome: job.colorMode === 'bw'
      };

      const sumatraPath = getSumatraPath();
      if (sumatraPath) {
        printOpts.sumatraPdfPath = sumatraPath;
      }

      await print(tempFilePath, printOpts);

      console.log('Print spooled successfully!');
      socket.emit('agent:job_status', { jobId: job.jobId, status: 'printed' });
    } catch (err) {
      console.error('Print failed:', err.message);
      socket.emit('agent:job_status', { jobId: job.jobId, status: 'failed', error: err.message });
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server. Retrying...');
  });
}

startAgent();
