/**
 * useToolProcessor — React hook that acts as the client SDK for the
 * PDF Processing Worker Microservice (public/workers/pdf-processor.js).
 *
 * Responsibilities:
 *  - Spawns & owns a single Web Worker instance per component mount
 *  - Manages the full job lifecycle: idle → uploading → processing → complete | error
 *  - Translates typed worker messages into React state
 *  - Handles PDF→JPG on the main thread (via PDF.js) as a delegated action
 *  - Returns a stable `process` function and reactive state to the consumer
 *
 * Each call to `process()` generates a unique requestId so concurrent requests
 * (if ever needed) are safely isolated.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToolBySlug } from "../lib/pdfTools";
import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ProcessorStatus = "idle" | "loading" | "processing" | "complete" | "error";

export interface ProcessedOutput {
  /** The processed file as a Blob (always available client-side) */
  blob: Blob;
  /** Suggested download filename */
  filename: string;
  /** MIME type of the output */
  mimeType: string;
  /** Original input file sizes for compression ratio display */
  inputBytes: number;
  /** Output size */
  outputBytes: number;
}

export interface ProcessorState {
  status: ProcessorStatus;
  progress: number;
  progressMessage: string;
  output: ProcessedOutput | null;
  error: { code: string; message: string } | null;
}

export interface UseToolProcessorReturn extends ProcessorState {
  process: (files: File[], config?: Record<string, unknown>) => Promise<void>;
  reset: () => void;
  isWorkerSupported: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const WORKER_PATH = "/workers/pdf-processor.js";
const EXPRESS_BACKEND_URL = process.env.NEXT_PUBLIC_EXPRESS_URL || "http://localhost:3000";

const INITIAL_STATE: ProcessorState = {
  status: "idle",
  progress: 0,
  progressMessage: "",
  output: null,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useToolProcessor(slug: string): UseToolProcessorReturn {
  const [state, setState] = useState<ProcessorState>(INITIAL_STATE);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef<string>("");

  // Detect Worker support once on mount
  const isWorkerSupported = typeof Worker !== "undefined";

  // Lazily initialize the worker on first process() call
  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = new Worker(WORKER_PATH);
    }
    return workerRef.current;
  }, []);

  // Terminate worker on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const process = useCallback(
    async (files: File[], config: Record<string, unknown> = {}) => {
      if (!isWorkerSupported) {
        setState(prev => ({
          ...prev,
          status: "error",
          error: { code: "NO_WORKER", message: "Your browser doesn't support Web Workers. Please try a modern browser like Chrome or Firefox." },
        }));
        return;
      }

      if (files.length === 0) {
        setState(prev => ({
          ...prev,
          status: "error",
          error: { code: "NO_FILES", message: "Please add at least one file before processing." },
        }));
        return;
      }

      // Generate unique request ID for this job
      const requestId = `${slug}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      requestIdRef.current = requestId;

      setState({
        status: "loading",
        progress: 0,
        progressMessage: "Reading files…",
        output: null,
        error: null,
      });

      const totalInputBytes = files.reduce((sum, f) => sum + f.size, 0);
      const toolInfo = getToolBySlug(slug);

      if (toolInfo?.processingTier === "server") {
        setState(prev => ({ ...prev, progressMessage: "Requesting upload link…" }));
        try {
          const file = files[0]; // For phase 2, assume 1 file for now (OCR, Office conversions are 1-to-1)
          
          // 1. Presign
          const presignRes = await fetch(`${EXPRESS_BACKEND_URL}/g2p/tools/presign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name }),
          });
          
          if (!presignRes.ok) throw new Error("Failed to get presigned URL");
          const { r2_key, upload_url } = await presignRes.json();

          // 2. Upload to R2 via Axios to get progress
          setState(prev => ({ ...prev, progressMessage: "Uploading to cloud…" }));
          await axios.put(upload_url, file, {
            headers: { "Content-Type": file.type },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
              // Map upload to 0-40% of total progress
              setState(prev => ({ ...prev, progress: Math.round(percentCompleted * 0.4) }));
            }
          });

          // 3. Enqueue Job
          setState(prev => ({ ...prev, progressMessage: "Queuing job...", progress: 40 }));
          const enqueueRes = await fetch(`${EXPRESS_BACKEND_URL}/g2p/tools/${slug}/enqueue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input_r2_key: r2_key,
              filename: file.name,
              sizeBytes: file.size,
              config,
            }),
          });

          if (!enqueueRes.ok) throw new Error("Failed to enqueue job");
          const { job_id } = await enqueueRes.json();

          // 4. SSE Stream
          const eventSource = new EventSource(`${EXPRESS_BACKEND_URL}/g2p/tools/jobs/${job_id}/stream`);

          eventSource.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'progress') {
              // Map 0-100% of backend progress to 40-95% of total progress
              const mappedProgress = 40 + Math.round((data.pct / 100) * 55);
              setState(prev => ({ ...prev, progress: mappedProgress, progressMessage: data.message }));
            }
            
            if (data.type === 'complete') {
              eventSource.close();
              
              // Get download URL from backend
              const downloadRes = await fetch(`${EXPRESS_BACKEND_URL}/g2p/tools/jobs/${job_id}/download?output_key=${data.output_key}`);
              const { download_url } = await downloadRes.json();

              // Fetch the final blob so the ActionPanel works exactly as before
              setState(prev => ({ ...prev, progressMessage: "Fetching output..." }));
              const outputRes = await fetch(download_url);
              const blob = await outputRes.blob();

              // Determine the correct output extension from the backend's output_key
              const extMatch = data.output_key ? data.output_key.match(/\.[a-z0-9]+$/i) : null;
              const outExt = extMatch ? extMatch[0] : ".pdf";
              const baseName = file.name.replace(/\.[a-z0-9]+$/i, "");
              const finalFilename = `processed-${baseName}${outExt}`;

              setState({
                status: "complete",
                progress: 100,
                progressMessage: "Done!",
                output: {
                  blob,
                  filename: finalFilename,
                  mimeType: outputRes.headers.get("Content-Type") || "application/pdf",
                  inputBytes: totalInputBytes,
                  outputBytes: data.output_bytes || blob.size,
                },
                error: null,
              });
            }

            if (data.type === 'error') {
              eventSource.close();
              setState({
                status: "error",
                progress: 0,
                progressMessage: "",
                output: null,
                error: { code: "SERVER_ERROR", message: data.message || "Failed to process job." },
              });
            }
          };

          eventSource.onerror = () => {
            eventSource.close();
            setState({
              status: "error",
              progress: 0,
              progressMessage: "",
              output: null,
              error: { code: "STREAM_ERROR", message: "Lost connection to the processing server." },
            });
          };

        } catch (err: any) {
          setState({
            status: "error",
            progress: 0,
            progressMessage: "",
            output: null,
            error: { code: "SERVER_ERROR", message: err.message },
          });
        }
        return;
      }

      // Read all files as ArrayBuffers
      let buffers: ArrayBuffer[];
      try {
        buffers = await Promise.all(
          files.map(
            (f) =>
              new Promise<ArrayBuffer>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = () => reject(new Error(`Failed to read file: ${f.name}`));
                reader.readAsArrayBuffer(f);
              })
          )
        );
      } catch (err) {
        setState({
          status: "error",
          progress: 0,
          progressMessage: "",
          output: null,
          error: { code: "FILE_READ_ERROR", message: (err as Error).message },
        });
        return;
      }

      setState(prev => ({ ...prev, status: "processing", progress: 5, progressMessage: "Starting…" }));

      const worker = getWorker();

      // Set up message handler for this specific request
      const messageHandler = (event: MessageEvent) => {
        const { type, requestId: rId } = event.data;

        // Ignore messages for other requests (safety for concurrent calls)
        if (rId !== requestId) return;

        switch (type) {
          case "PROGRESS":
            setState(prev => ({
              ...prev,
              progress: event.data.pct,
              progressMessage: event.data.message || "",
            }));
            break;

          case "COMPLETE": {
            const { buffer, filename, mimeType } = event.data;
            const blob = new Blob([buffer], { type: mimeType || "application/pdf" });
            setState({
              status: "complete",
              progress: 100,
              progressMessage: "Done!",
              output: {
                blob,
                filename,
                mimeType: mimeType || "application/pdf",
                inputBytes: totalInputBytes,
                outputBytes: blob.size,
              },
              error: null,
            });
            worker.removeEventListener("message", messageHandler);
            break;
          }

          case "ERROR":
            setState({
              status: "error",
              progress: 0,
              progressMessage: "",
              output: null,
              error: { code: event.data.code, message: event.data.message },
            });
            worker.removeEventListener("message", messageHandler);
            break;

          case "DELEGATE_TO_MAIN":
            // pdf-to-jpg needs PDF.js (main thread DOM access) — handle here
            handlePdfToJpgMainThread(event.data, requestId, totalInputBytes, setState);
            worker.removeEventListener("message", messageHandler);
            break;
        }
      };

      worker.addEventListener("message", messageHandler);

      // Handle worker-level errors (syntax errors, etc.)
      const errorHandler = (event: ErrorEvent) => {
        setState({
          status: "error",
          progress: 0,
          progressMessage: "",
          output: null,
          error: { code: "WORKER_ERROR", message: event.message || "Worker crashed unexpectedly." },
        });
        worker.removeEventListener("error", errorHandler);
        worker.removeEventListener("message", messageHandler);
      };
      worker.addEventListener("error", errorHandler);

      // Post message to worker — transfer buffers for zero-copy performance
      worker.postMessage({ type: "PROCESS", requestId, slug, buffers, config }, buffers);
    },
    [slug, isWorkerSupported, getWorker]
  );

  return { ...state, process, reset, isWorkerSupported };
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF → JPG handler (main thread, uses PDF.js via dynamic import)
// Runs when the worker delegates this tool back to the main thread
// ─────────────────────────────────────────────────────────────────────────────

async function handlePdfToJpgMainThread(
  data: { buffers: ArrayBuffer[]; config: Record<string, unknown> },
  requestId: string,
  totalInputBytes: number,
  setState: React.Dispatch<React.SetStateAction<ProcessorState>>
) {
  setState(prev => ({ ...prev, progress: 5, progressMessage: "Loading PDF renderer…" }));

  try {
    // Dynamically load PDF.js only when needed. We use an indirect import via
    // new Function() to prevent TypeScript from performing static module resolution,
    // since pdfjs-dist is an optional CDN-loaded dependency, not a hard install.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfjsLib: any = await new Function('specifier', 'return import(specifier)')('pdfjs-dist').catch(() => {
      throw new Error("PDF renderer failed to load. Please use Download instead.");
    });

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data.buffers[0]) }).promise;
    const scale = parseFloat((data.config.scale as string) || "2");
    const pageNum = parseInt((data.config.page as string) || "1", 10);
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;

    setState(prev => ({ ...prev, progress: 50, progressMessage: "Rendering page…" }));
    await page.render({ canvasContext: ctx, viewport }).promise;

    setState(prev => ({ ...prev, progress: 85, progressMessage: "Encoding image…" }));

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/jpeg", 0.95);
    });

    setState({
      status: "complete",
      progress: 100,
      progressMessage: "Done!",
      output: {
        blob,
        filename: `page-${pageNum}.jpg`,
        mimeType: "image/jpeg",
        inputBytes: totalInputBytes,
        outputBytes: blob.size,
      },
      error: null,
    });
  } catch (err) {
    setState({
      status: "error",
      progress: 0,
      progressMessage: "",
      output: null,
      error: { code: "PDF_RENDER_ERROR", message: (err as Error).message },
    });
  }
}

