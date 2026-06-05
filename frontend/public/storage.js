// Simple storage for chunks: prefer OPFS (navigator.storage.getDirectory), fallback to IndexedDB.
const Storage = (() => {
  const DB_NAME = 'shareit-db';
  const STORE = 'chunks';
  let dbPromise = null;

  // OPFS (Origin Private File System) helpers
  let _opfsRoot = null;
  const OPFS_DIR_NAME = 'shareit_chunks';

  const hasOPFS = typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function';

  async function getOpfsDir(){
    if (!hasOPFS) return null;
    if (_opfsRoot) return _opfsRoot;
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle(OPFS_DIR_NAME, { create: true });
    _opfsRoot = dir;
    return dir;
  }

  async function opfsSaveChunk(transferId, side, seq, data, iv){
    const dir = await getOpfsDir();
    if (!dir) throw new Error('OPFS not available');
    const name = `${transferId}_${side}_${seq}.bin`;
    const fh = await dir.getFileHandle(name, { create: true });
    const writable = await fh.createWritable();
    let buf;
    if (typeof data === 'string'){
      // base64 string
      const binary = atob(data);
      const arr = new Uint8Array(binary.length);
      for (let i=0;i<binary.length;i++) arr[i] = binary.charCodeAt(i);
      buf = arr;
    } else if (data instanceof ArrayBuffer) buf = new Uint8Array(data);
    else buf = new Uint8Array(data);
    await writable.write(buf);
    await writable.close();
    // store iv as separate metadata file
    if (iv) {
      const ivName = `${transferId}_${side}_${seq}.iv`;
      const ifh = await dir.getFileHandle(ivName, { create: true });
      const iw = await ifh.createWritable();
      await iw.write(iv);
      await iw.close();
    }
    return { transferId, side, seq, data: buf, iv };
  }

  async function opfsGetChunks(transferId, side){
    const dir = await getOpfsDir();
    if (!dir) return [];
    const res = [];
    for await (const entry of dir){
      // entry can be [name, handle] or a handle depending on environment; normalize
      let name, handle;
      if (Array.isArray(entry)) { name = entry[0]; handle = entry[1]; }
      else { name = entry.name; handle = entry; }
      if (!name.endsWith('.bin')) continue;
      const parts = name.split('_');
      const [tId, s, seqPart] = parts;
      if (tId !== String(transferId) || s !== String(side)) continue;
      const seq = parseInt(seqPart.split('.bin')[0], 10);
      const file = await handle.getFile();
      const arrayBuf = await file.arrayBuffer();
      // read iv
      let iv = null;
      try{
        const ivName = `${transferId}_${side}_${seq}.iv`;
        const ivHandle = await dir.getFileHandle(ivName);
        const ivFile = await ivHandle.getFile();
        iv = await ivFile.arrayBuffer();
      }catch(e){ /* no iv */ }
      res.push({ key: `${transferId}:${side}:${seq}`, transferId, side, seq, data: arrayBuf, iv });
    }
    return res.sort((a,b)=>a.seq-b.seq);
  }

  async function opfsGetChunk(transferId, side, seq){
    const dir = await getOpfsDir();
    if (!dir) return null;
    const name = `${transferId}_${side}_${seq}.bin`;
    try{
      const fh = await dir.getFileHandle(name);
      const file = await fh.getFile();
      const ab = await file.arrayBuffer();
      return { key: `${transferId}:${side}:${seq}`, transferId, side, seq, data: ab };
    } catch(e){ return null; }
  }

  async function opfsClearTransfer(transferId, side){
    const dir = await getOpfsDir();
    if (!dir) return;
    for await (const entry of dir){
      let name, handle;
      if (Array.isArray(entry)) { name = entry[0]; handle = entry[1]; }
      else { name = entry.name; handle = entry; }
      if (!name) continue;
      if (name.startsWith(`${transferId}_${side}_`)) {
        await dir.removeEntry(name);
      }
    }
  }

  // IndexedDB fallback helpers
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

  async function idbSaveChunk(transferId, side, seq, data, iv){
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

  async function idbGetChunks(transferId, side){
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

  async function idbGetChunk(transferId, side, seq){
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

  async function idbClearTransfer(transferId, side){
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

  // Unified API: try OPFS first, fallback to IDB
  async function saveChunk(transferId, side, seq, data, iv){
    if (hasOPFS) {
      try { return await opfsSaveChunk(transferId, side, seq, data, iv); } catch(e){ console.warn('OPFS save failed, falling back to IDB', e); }
    }
    return idbSaveChunk(transferId, side, seq, data, iv);
  }

  async function getChunks(transferId, side){
    if (hasOPFS) {
      try { const res = await opfsGetChunks(transferId, side); if (res && res.length) return res; } catch(e){ console.warn('OPFS getChunks failed, falling back to IDB', e); }
    }
    return idbGetChunks(transferId, side);
  }

  async function getChunk(transferId, side, seq){
    if (hasOPFS) {
      try { const r = await opfsGetChunk(transferId, side, seq); if (r) return r; } catch(e){ console.warn('OPFS getChunk failed, falling back to IDB', e); }
    }
    return idbGetChunk(transferId, side, seq);
  }

  async function clearTransfer(transferId, side){
    if (hasOPFS) {
      try { await opfsClearTransfer(transferId, side); return; } catch(e){ console.warn('OPFS clear failed, falling back to IDB', e); }
    }
    return idbClearTransfer(transferId, side);
  }

  return { openDB, saveChunk, getChunks, getChunk, clearTransfer, hasOPFS };
})();

// expose globally
window.ShareItStorage = Storage;
