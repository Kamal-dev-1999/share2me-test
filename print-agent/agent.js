const { io } = require('socket.io-client');
const { print } = require('pdf-to-printer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const { exec } = require('child_process');

const DEFAULT_SERVER_URL = 'https://api.share2me.in';
const SERVER_URL = process.env.SERVER_URL || DEFAULT_SERVER_URL;
const CONFIG_DIR = path.join(os.homedir(), '.share2me');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

let cachedPrinters = [];
let socket = null;

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;
    client.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Follow redirect
        file.close();
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
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

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return {
        token: data.token || null,
        serverUrl: data.serverUrl || DEFAULT_SERVER_URL,
      };
    }
  } catch (err) {
    console.warn('[Config] Could not read existing config:', err.message);
  }
  return { token: null, serverUrl: DEFAULT_SERVER_URL };
}

function saveConfig(token, serverUrl) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ token, serverUrl: serverUrl || DEFAULT_SERVER_URL }, null, 2));
    console.log('[Config] Saved credentials to:', CONFIG_FILE);
  } catch (err) {
    console.error('[Config] Failed to save config:', err.message);
  }
}

/**
 * Ensures the agent auto-starts as soon as the user's PC/laptop boots into Windows.
 * Configures both the Windows Run Registry key and Startup folder script for maximum reliability.
 */
function setupAutoStart() {
  if (process.platform !== 'win32') return;

  try {
    const exePath = process.execPath;
    // Skip if running directly inside node during development
    if (path.basename(exePath).toLowerCase().includes('node')) return;

    // 1. Windows Run Registry key
    const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "Share2MePrintAgent" /t REG_SZ /d "\\"${exePath}\\" --hidden" /f`;
    exec(regCmd, (err) => {
      if (err) {
        console.warn('[AutoStart] Registry registration notice:', err.message);
      } else {
        console.log('[AutoStart] Registered Share2Me Print Agent in Windows Startup Registry.');
      }
    });

    // 2. Windows Startup folder script (.bat) fallback
    const startupDir = path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      'Startup'
    );
    if (fs.existsSync(startupDir)) {
      const batPath = path.join(startupDir, 'Share2Me-PrintAgent-AutoStart.bat');
      const batContent = `@echo off\r\nstart "" "${exePath}" --hidden\r\n`;
      fs.writeFileSync(batPath, batContent);
      console.log('[AutoStart] Placed startup launcher in Windows Startup folder:', batPath);
    }
  } catch (err) {
    console.warn('[AutoStart] Could not configure startup:', err.message);
  }
}

function fetchPrinters() {
  return new Promise((resolve) => {
    // Try PowerShell first (works on Windows 10 & Windows 11 where wmic is deprecated)
    exec('powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name"', (psErr, psStdout) => {
      if (!psErr && psStdout) {
        const names = psStdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (names.length > 0) {
          cachedPrinters = names;
          return resolve(names);
        }
      }

      // Fallback to wmic
      exec('wmic printer get name', (wmicErr, wmicStdout) => {
        if (!wmicErr && wmicStdout) {
          const names = wmicStdout.split(/\r?\n/)
            .map(p => p.trim())
            .filter(p => p && p.toLowerCase() !== 'name');
          cachedPrinters = names;
          return resolve(names);
        }
        resolve(cachedPrinters || []);
      });
    });
  });
}

function connectSocket(token, url) {
  if (socket) {
    socket.disconnect();
  }

  const targetUrl = url || DEFAULT_SERVER_URL;
  console.log('[Socket] Connecting to server:', targetUrl);
  socket = io(targetUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to server! Authenticating agent...');
    socket.emit('agent:authenticate', { token }, async (res) => {
      if (res?.error) {
        console.error('[Socket] Authentication rejected:', res.error);
        return;
      }

      console.log('[Socket] Authentication successful! Fetching installed printers...');
      const printers = await fetchPrinters();
      console.log(`[Socket] Found ${printers.length} printer(s):`, printers.join(', '));
      socket.emit('agent:printers', { printers });
    });
  });

  socket.on('agent:print_job', async (job) => {
    console.log(`\n[Print Job] Received job ${job.jobId} -> ${job.printerName}`);
    console.log(`Copies: ${job.copies}, Color Mode: ${job.colorMode}`);

    const tempFilePath = path.join(os.tmpdir(), `job_${job.jobId}_${crypto.randomBytes(4).toString('hex')}.pdf`);

    try {
      console.log('[Print Job] Downloading document...');
      await downloadFile(job.fileUrl, tempFilePath);
      console.log('[Print Job] Sending to physical printer:', job.printerName);

      const printOpts = {
        printer: job.printerName,
        copies: job.copies,
        monochrome: job.colorMode === 'bw',
      };

      const sumatraPath = getSumatraPath();
      if (sumatraPath) {
        printOpts.sumatraPdfPath = sumatraPath;
      }

      await print(tempFilePath, printOpts);

      console.log('[Print Job] Spooled successfully to printer!');
      socket.emit('agent:job_status', { jobId: job.jobId, status: 'printed' });
    } catch (err) {
      console.error('[Print Job] Printing failed:', err.message);
      socket.emit('agent:job_status', { jobId: job.jobId, status: 'failed', error: err.message });
    } finally {
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch {}
      }
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected from server (' + reason + '). Will automatically reconnect...');
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection attempt error:', err.message);
  });
}

async function startAgent() {
  if (process.argv.includes('--hidden')) {
    // Divert console output to a log file when running as a background service
    try {
      const logPath = path.join(os.tmpdir(), 'Share2Me-PrintAgent.log');
      const logStream = fs.createWriteStream(logPath, { flags: 'a' });
      console.log = function () {
        logStream.write(`[${new Date().toISOString()}] ` + Array.from(arguments).join(' ') + '\n');
      };
      console.error = function () {
        logStream.write(`[${new Date().toISOString()}] [ERROR] ` + Array.from(arguments).join(' ') + '\n');
      };
      console.warn = function () {
        logStream.write(`[${new Date().toISOString()}] [WARN] ` + Array.from(arguments).join(' ') + '\n');
      };
    } catch {}
  }

  console.log('=============================================');
  console.log('      Share2Me Local Print Agent v1.1        ');
  console.log('=============================================');

  // Configure auto-start in Windows so it boots automatically
  setupAutoStart();

  let { token, serverUrl } = loadConfig();
  if (!serverUrl) serverUrl = SERVER_URL;

  // Local HTTP Bridge for dashboard auto-connection
  await new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const origin = req.headers.origin || '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Control-Request-Private-Network, Authorization, Accept');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }

      // Ping / Status check for automated connection probe
      if (req.method === 'GET' && (req.url === '/status' || req.url === '/ping')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          running: true,
          connected: Boolean(socket && socket.connected),
          hasToken: Boolean(token),
          printers: cachedPrinters,
          version: '1.1.0'
        }));
      }

      // Website sends authentication token to bridge
      if (req.method === 'POST' && req.url === '/auth') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.token) {
              token = data.token;
              serverUrl = data.serverUrl || DEFAULT_SERVER_URL;
              saveConfig(token, serverUrl);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, connected: true }));
              console.log('[Bridge] Received token from web dashboard! Connecting to:', serverUrl);
              connectSocket(token, serverUrl);
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'invalid_token' }));
            }
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_json' }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('[Bridge] Another instance is already running on port 13337. Exiting this duplicate.');
        process.exit(0);
      }
    });

    server.listen(13337, '127.0.0.1', () => {
      console.log('[Bridge] Local HTTP Bridge active on 127.0.0.1:13337');
      resolve();
    });
  });

  // Pre-load printers cache
  fetchPrinters().then(printers => {
    console.log(`[Printers] Available: ${printers.length > 0 ? printers.join(', ') : 'None detected'}`);
  });

  if (token) {
    console.log('[Agent] Saved credentials found. Automatically connecting to server...');
    connectSocket(token, serverUrl);
  } else {
    console.log('[Agent] Awaiting connection from Share2Me dashboard. Please open the Print Shop dashboard.');
  }
}

startAgent();
