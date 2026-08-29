import { NextRequest, NextResponse } from "next/server";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:5002/remove-background";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

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

    console.log(`[Next.js BG-Remover Route] Received file '${file.name}' (${file.type}, ${file.size} bytes). Forwarding to ML service...`);

    // Prepare FormData to proxy to local Python ML service
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });
    const forwardFormData = new FormData();
    forwardFormData.append("image", blob, file.name || "upload.png");

    const mlRes = await fetch(ML_SERVICE_URL, {
      method: "POST",
      body: forwardFormData,
    });

    if (!mlRes.ok) {
      const status = mlRes.status;
      let errorMsg = "Self-hosted AI inference service returned an error.";
      try {
        const errJson = await mlRes.json();
        if (errJson && errJson.error) {
          errorMsg = errJson.error;
        }
      } catch (e) {
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
      { error: "Self-hosted AI background removal service is temporarily offline or initializing. Please ensure the Python ML service is running." },
      { status: 503 }
    );
  }
}
