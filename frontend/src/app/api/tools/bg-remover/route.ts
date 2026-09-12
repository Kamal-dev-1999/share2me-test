import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "https://ai.share2me.in/remove-background";
const INTERNAL_ML_SECRET = process.env.INTERNAL_ML_SECRET || "";
let isSpawning = false;

function getHealthUrl(): string {
  try {
    const parsed = new URL(ML_SERVICE_URL);
    parsed.pathname = "/health";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return "http://127.0.0.1:5002/health";
  }
}

async function checkHealth(): Promise<boolean> {
  try {
    const healthUrl = getHealthUrl();
    const res = await fetch(healthUrl, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.status === "ready" || data.status === "initializing") return true;
    }
  } catch {
    // service offline or waking up
  }
  return false;
}

async function ensureMlServiceRunning(): Promise<boolean> {
  if (await checkHealth()) return true;

  // Only auto-spawn local Python if running in local environment
  const isLocal = ML_SERVICE_URL.includes("127.0.0.1") || ML_SERVICE_URL.includes("localhost");
  if (!isLocal) {
    // For remote Cloud Run service, wait up to 15s for scale-from-zero cold start
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await checkHealth()) return true;
    }
    return false;
  }

  if (isSpawning) {
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 600));
      if (await checkHealth()) return true;
    }
    return false;
  }

  isSpawning = true;
  try {
    const scriptPath = path.resolve(process.cwd(), "..", "backend", "ml", "bg_remover_service.py");
    console.log(`[Next.js BG-Remover] ML service offline. Auto-launching Python script at: ${scriptPath}`);

    const pythonCmd = process.env.PYTHON_EXECUTABLE || "python";
    const pythonProc = spawn(pythonCmd, [scriptPath], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: path.dirname(scriptPath),
    });

    let hasExited = false;
    pythonProc.stderr?.on("data", (chunk) => {
      console.error(`[Python ML Error] ${chunk.toString().trim()}`);
    });
    pythonProc.stdout?.on("data", (chunk) => {
      console.log(`[Python ML] ${chunk.toString().trim()}`);
    });
    pythonProc.on("exit", (code, signal) => {
      hasExited = true;
      if (code !== 0 && code !== null) {
        console.error(`[Next.js BG-Remover] Python ML service exited with code ${code} (${signal || "no signal"}). Check if 'rembg' is installed in Python environment (pip install -r backend/ml/requirements.txt).`);
      }
    });
    pythonProc.unref();

    for (let i = 0; i < 30; i++) {
      if (hasExited) break;
      await new Promise((r) => setTimeout(r, 600));
      if (await checkHealth()) {
        console.log("[Next.js BG-Remover] Python ML service auto-launched and active!");
        return true;
      }
    }
  } catch (err) {
    console.error("[Next.js BG-Remover] Failed to auto-launch Python ML service:", err);
  } finally {
    isSpawning = false;
  }
  return false;
}

const ipRateMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = ipRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (ip !== "unknown" && !checkRateLimit(ip, 10, 60_000)) {
      return NextResponse.json(
        { error: "Too many background removal requests from your IP. Please wait a moment before trying again." },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image");
    const model = formData.get("model")?.toString() || "auto";
    const postProcessMask = formData.get("post_process_mask")?.toString() || "true";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No valid image file uploaded. Field 'image' is required." }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Uploaded image file is empty (0 bytes)." }, { status: 400 });
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 15MB limit. Please upload a smaller image." }, { status: 413 });
    }

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      return NextResponse.json({ error: `Unsupported image format (${file.type}). Please upload a JPG, PNG, or WebP image.` }, { status: 400 });
    }

    console.log(`[Next.js BG-Remover Route] Received file '${file.name}' (${file.type}, ${file.size} bytes) | model='${model}', post_process=${postProcessMask}. Forwarding to ML service...`);

    // Prepare FormData to proxy to local Python ML service
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const forwardFormData = new FormData();
    forwardFormData.append("image", blob, file.name || "upload.png");
    forwardFormData.append("model", model);
    forwardFormData.append("post_process_mask", postProcessMask);

    const fetchHeaders: Record<string, string> = {};
    if (INTERNAL_ML_SECRET) {
      fetchHeaders["X-Internal-Secret"] = INTERNAL_ML_SECRET;
    }

    const isLocal = ML_SERVICE_URL.includes("127.0.0.1") || ML_SERVICE_URL.includes("localhost");
    let mlRes: Response | null = null;
    try {
      mlRes = await fetch(ML_SERVICE_URL, {
        method: "POST",
        body: forwardFormData,
        headers: fetchHeaders,
        signal: AbortSignal.timeout(isLocal ? 15000 : 50000),
      });
    } catch (fetchErr: any) {
      if (isLocal) {
        console.warn("[Next.js BG-Remover Route] Local ML service connection error. Triggering recovery...", fetchErr?.message || fetchErr);
        const recovered = await ensureMlServiceRunning();
        if (recovered) {
          mlRes = await fetch(ML_SERVICE_URL, {
            method: "POST",
            body: forwardFormData,
            headers: fetchHeaders,
            signal: AbortSignal.timeout(30000),
          });
        } else {
          throw fetchErr;
        }
      } else {
        console.error("[Next.js BG-Remover Route] Cloud Run ML service fetch error or timeout:", fetchErr?.message || fetchErr);
        return NextResponse.json(
          { error: "AI background removal service timed out while waking up from idle. Please click Try Again in a few moments." },
          { status: 504 }
        );
      }
    }

    if (!mlRes || !mlRes.ok) {
      const status = mlRes ? mlRes.status : 500;
      let errorMsg = "Self-hosted AI inference service returned an error.";
      try {
        const errJson = await mlRes?.json();
        if (errJson && errJson.error) {
          errorMsg = errJson.error;
        }
      } catch {
        // Not JSON
      }
      console.error(`[Next.js BG-Remover Route] ML Service failed with status HTTP ${status}: ${errorMsg}`);
      return NextResponse.json({ error: errorMsg }, { status: status >= 400 && status < 600 ? status : 500 });
    }

    const outputBuffer = await mlRes.arrayBuffer();
    console.log(`[Next.js BG-Remover Route] ML inference succeeded! Returning ${outputBuffer.byteLength} bytes transparent PNG.`);

    return new Response(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": "inline; filename=\"no-bg.png\"",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("[Next.js BG-Remover Route] Unhandled exception:", err);
    return NextResponse.json(
      { error: "AI background removal service is offline or initializing. Please ensure the Python service is running (`npm run dev:ml` or `pip install -r backend/ml/requirements.txt`)." },
      { status: 503 }
    );
  }
}
