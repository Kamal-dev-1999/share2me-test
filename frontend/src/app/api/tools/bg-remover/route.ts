import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:5002/remove-background";
let isSpawning = false;

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:5002/health", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.status === "ready" || data.status === "initializing") return true;
    }
  } catch {
    // service offline
  }
  return false;
}

async function ensureMlServiceRunning(): Promise<boolean> {
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
    const scriptPath = path.resolve(process.cwd(), "..", "backend", "ml", "bg_remover_service.py");
    console.log(`[Next.js BG-Remover] ML service offline. Auto-launching Python script at: ${scriptPath}`);

    const pythonCmd = process.env.PYTHON_EXECUTABLE || "python";
    const pythonProc = spawn(pythonCmd, [scriptPath], {
      detached: true,
      stdio: "ignore",
      cwd: path.dirname(scriptPath),
    });
    pythonProc.unref();

    for (let i = 0; i < 30; i++) {
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

export async function POST(request: NextRequest) {
  try {
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

    let mlRes: Response | null = null;
    try {
      mlRes = await fetch(ML_SERVICE_URL, {
        method: "POST",
        body: forwardFormData,
      });
    } catch (fetchErr) {
      console.warn("[Next.js BG-Remover Route] ML service connection error. Triggering auto-launch recovery...", fetchErr);
      const recovered = await ensureMlServiceRunning();
      if (recovered) {
        mlRes = await fetch(ML_SERVICE_URL, {
          method: "POST",
          body: forwardFormData,
        });
      } else {
        throw fetchErr;
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
      { error: "Self-hosted AI background removal service is temporarily initializing. Please try again in a few seconds." },
      { status: 503 }
    );
  }
}
