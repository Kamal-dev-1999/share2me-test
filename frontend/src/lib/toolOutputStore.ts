/**
 * toolOutputStore — High-capacity, reliable client storage for transferring
 * processed tool output files (Blobs/Files) between pages (Tools → P2P, Tools → G2P).
 *
 * Key advantages over sessionStorage:
 * 1. No 5MB quota — stores large multi-page PDFs, images, and archives up to 1GB+.
 * 2. Native binary storage — stores Blob directly, eliminating base64 CPU spikes.
 * 3. Never blocked by CSP — uses browser IndexedDB, not network fetch().
 */

const DB_NAME = "share2me_tool_store";
const DB_VERSION = 1;
const STORE_NAME = "outputs";
const KEY = "latest_output";

export interface StoredToolOutput {
  id: string;
  blob: Blob;
  filename: string;
  mimeType: string;
  timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available"));
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveToolOutput(output: { blob: Blob; filename: string; mimeType: string }): Promise<void> {
  if (typeof window === "undefined") return;

  // Set window global for immediate in-memory SPA routing
  (window as unknown as Record<string, unknown>).__SHARE2ME_TOOL_OUTPUT__ = {
    file: new File([output.blob], output.filename, { type: output.mimeType }),
    timestamp: Date.now(),
  };

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const record: StoredToolOutput = {
        id: KEY,
        blob: output.blob,
        filename: output.filename,
        mimeType: output.mimeType,
        timestamp: Date.now(),
      };
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
  } catch (e) {
    console.warn("Could not save to IndexedDB, fallback to memory active:", e);
  }
}

export async function loadToolOutput(): Promise<File | null> {
  if (typeof window === "undefined") return null;

  // 1. Check in-memory global first (instant, 0 disk I/O)
  const memItem = (window as unknown as Record<string, { file: File; timestamp: number } | undefined>).__SHARE2ME_TOOL_OUTPUT__;
  if (memItem) {
    delete (window as unknown as Record<string, unknown>).__SHARE2ME_TOOL_OUTPUT__;
    if (Date.now() - memItem.timestamp < 300000) {
      clearToolOutput().catch(() => {});
      return memItem.file;
    }
  }

  // 2. Check IndexedDB
  try {
    const db = await openDb();
    const record = await new Promise<StoredToolOutput | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(KEY);
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => reject(getReq.error);
    });

    if (record && Date.now() - record.timestamp < 300000) {
      await clearToolOutput();
      return new File([record.blob], record.filename, { type: record.mimeType });
    }
  } catch (e) {
    console.warn("Could not read from IndexedDB:", e);
  }

  // 3. Fallback to sessionStorage with safe manual base64 decoding (no fetch call)
  try {
    const raw = sessionStorage.getItem("share2me_tool_output");
    if (raw) {
      sessionStorage.removeItem("share2me_tool_output");
      const { dataUrl, filename, mimeType } = JSON.parse(raw);
      const commaIdx = dataUrl.indexOf(",");
      if (commaIdx !== -1) {
        const base64 = dataUrl.slice(commaIdx + 1);
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        return new File([bytes], filename, { type: mimeType });
      }
    }
  } catch {}

  return null;
}

export async function clearToolOutput(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const delReq = store.delete(KEY);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => reject(delReq.error);
    });
  } catch {}
}
