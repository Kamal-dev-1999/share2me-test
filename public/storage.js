// Simple IndexedDB storage for chunks: stores encrypted/decrypted chunks for transfers.
const Storage = (() => {
  const DB_NAME = 'shareit-db';
  const STORE = 'chunks';
  let dbPromise = null;

  function openDB(){
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'key' });
          os.createIndex('transfer', ['transferId','side','seq'], { unique: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function saveChunk(transferId, side, seq, data, iv){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const key = `${transferId}:${side}:${seq}`;
      const obj = { key, transferId, side, seq, data, iv, ts: Date.now() };
      const req = store.put(obj);
      req.onsuccess = () => resolve(obj);
      req.onerror = () => reject(req.error);
    });
  }

  async function getChunks(transferId, side){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const idx = store.index('transfer');
      const range = IDBKeyRange.bound([transferId, side, -Infinity], [transferId, side, Infinity]);
      const res = [];
      idx.openCursor(range).onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { resolve(res.sort((a,b)=>a.seq-b.seq)); return; }
        res.push(cursor.value);
        cursor.continue();
      };
      tx.oncomplete = () => {};
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getChunk(transferId, side, seq){
    const key = `${transferId}:${side}:${seq}`;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearTransfer(transferId, side){
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const idx = store.index('transfer');
      const range = IDBKeyRange.bound([transferId, side, -Infinity], [transferId, side, Infinity]);
      const req = idx.openCursor(range);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { resolve(); return; }
        cursor.delete();
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  }

  return { openDB, saveChunk, getChunks, getChunk, clearTransfer };
})();

// expose globally
window.ShareItStorage = Storage;
