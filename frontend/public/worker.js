// Worker: encrypts file into AES-GCM chunks, and performs ECDH-based key wrapping/unwrapping.
let senderFileKey = null;
let senderEcdhKeyPair = null;
let receiverEcdhKeyPair = null;
let receiverFileKey = null;

self.addEventListener('message', async (e) => {
  const msg = e.data;
  if (!msg || !msg.type) return;

  if (msg.type === 'prepareSenderTransfer') {
    const { fileName, file, fileBuffer, chunkSize = 64 * 1024, transferId } = msg;
    const fileSize = file ? file.size : (fileBuffer ? fileBuffer.byteLength : 0);
    const total = Math.ceil(fileSize / chunkSize);

    senderFileKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    senderEcdhKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    const senderPubKey = await crypto.subtle.exportKey('jwk', senderEcdhKeyPair.publicKey);
    
    // Hash computation: full buffer for text/small files, sample for huge files to avoid main-thread freeze
    let hashB64 = '';
    try {
      if (fileBuffer) {
        const hashBuf = await crypto.subtle.digest('SHA-256', fileBuffer);
        hashB64 = arrayBufferToBase64(hashBuf);
      } else if (file) {
        const sliceForHash = file.size <= 16 * 1024 * 1024 ? await file.arrayBuffer() : await file.slice(0, 1024 * 1024).arrayBuffer();
        const hashBuf = await crypto.subtle.digest('SHA-256', sliceForHash);
        hashB64 = arrayBufferToBase64(hashBuf);
      }
    } catch {
      hashB64 = '';
    }

    postMessage({
      type: 'senderMetadata',
      metadata: {
        f: fileName,
        s: fileSize,
        c: chunkSize,
        h: hashB64,
        total,
        otc: transferId || null,
        senderPubKey,
        transport: 'webrtc',
      },
    });

    for (let seq = 0; seq < total; seq++) {
      const start = seq * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);
      let slice;
      if (file) {
        slice = await file.slice(start, end).arrayBuffer();
      } else {
        slice = fileBuffer.slice(start, end);
      }
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, senderFileKey, slice);
      // Transfer encrypted ArrayBuffer & IV buffer directly without base64 inflation
      postMessage(
        { type: 'chunk', seq, total, data: encrypted, iv: iv.buffer },
        [encrypted, iv.buffer]
      );
    }

    postMessage({ type: 'done' });
  }

  if (msg.type === 'wrapFileKey') {
    if (!senderFileKey || !senderEcdhKeyPair) {
      postMessage({ type: 'wrapError', message: 'Sender transfer not prepared yet' });
      return;
    }
    const { receiverPubKey } = msg;
    const importedReceiverPub = await crypto.subtle.importKey(
      'jwk',
      receiverPubKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
    const wrapKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: importedReceiverPub },
      senderEcdhKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const rawFileKey = await crypto.subtle.exportKey('raw', senderFileKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedKey = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, rawFileKey);
    const senderPubKey = await crypto.subtle.exportKey('jwk', senderEcdhKeyPair.publicKey);
    postMessage({
      type: 'wrappedFileKey',
      wrappedKey: arrayBufferToBase64(wrappedKey),
      iv: arrayBufferToBase64(iv.buffer),
      senderPubKey,
    });
  }

  if (msg.type === 'generateReceiverKeyPair') {
    receiverEcdhKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    const publicKey = await crypto.subtle.exportKey('jwk', receiverEcdhKeyPair.publicKey);
    postMessage({ type: 'receiverPubKey', publicKey });
  }

  if (msg.type === 'unwrapFileKey') {
    if (!receiverEcdhKeyPair) {
      postMessage({ type: 'decryptError', message: 'Receiver key pair not ready' });
      return;
    }
    const { senderPubKey, wrappedKey, iv } = msg;
    const importedSenderPub = await crypto.subtle.importKey(
      'jwk',
      senderPubKey,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
    const unwrapKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: importedSenderPub },
      receiverEcdhKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(base64ToArrayBuffer(iv)) },
      unwrapKey,
      base64ToArrayBuffer(wrappedKey)
    );
    receiverFileKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    postMessage({ type: 'fileKeyReady' });
  }

  if (msg.type === 'decryptChunk') {
    const { seq, data, iv, dataB64, ivB64 } = msg;
    if (!receiverFileKey) {
      postMessage({ type: 'decryptError', seq, message: 'File key not ready' });
      return;
    }
    const encrypted = data instanceof ArrayBuffer ? data : (dataB64 ? base64ToArrayBuffer(dataB64) : null);
    const ivBuf = iv instanceof ArrayBuffer ? iv : (ivB64 ? base64ToArrayBuffer(ivB64) : null);
    if (!encrypted || !ivBuf) {
      postMessage({ type: 'decryptError', seq, message: 'Invalid chunk data' });
      return;
    }
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(ivBuf) }, receiverFileKey, encrypted);
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
