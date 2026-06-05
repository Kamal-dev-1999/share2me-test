// Worker: encrypts file into AES-GCM chunks and decrypts received chunks.
self.addEventListener('message', async (e) => {
  const msg = e.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'encrypt') {
    const { fileName, fileBuffer, chunkSize = 64 * 1024 } = msg;
    const total = Math.ceil(fileBuffer.byteLength / chunkSize);
    // generate key
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const rawKey = await crypto.subtle.exportKey('raw', key);
    const keyB64 = arrayBufferToBase64(rawKey);
    const hashBuf = await crypto.subtle.digest('SHA-256', fileBuffer);
    const hashB64 = arrayBufferToBase64(hashBuf);

    // send metadata
    postMessage({ type: 'metadata', metadata: { f: fileName, s: fileBuffer.byteLength, c: chunkSize, h: hashB64, key: keyB64, total } });

    // encrypt chunks
    for (let seq = 0; seq < total; seq++) {
      const start = seq * chunkSize;
      const end = Math.min(start + chunkSize, fileBuffer.byteLength);
      const slice = fileBuffer.slice(start, end);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, slice);
      postMessage({ type: 'chunk', seq, total, data: arrayBufferToBase64(encrypted), iv: arrayBufferToBase64(iv.buffer) });
    }
    postMessage({ type: 'done' });
  }

  if (msg.type === 'importKey') {
    const { keyB64 } = msg;
    const raw = base64ToArrayBuffer(keyB64);
    const importedKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['decrypt']);
    // store key on worker global
    self._decKey = importedKey;
    postMessage({ type: 'keyImported' });
  }

  if (msg.type === 'decryptChunk') {
    const { seq, dataB64, ivB64 } = msg;
    const encrypted = base64ToArrayBuffer(dataB64);
    const iv = base64ToArrayBuffer(ivB64);
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, self._decKey, encrypted);
      postMessage({ type: 'decrypted', seq, data: plain }, [plain]);
    } catch (err) {
      postMessage({ type: 'decryptError', seq, message: err && err.message });
    }
  }
});

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
