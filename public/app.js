(function () {
  const socket = io();
  window.socket = socket;

  const els = {
    globalStatus: document.getElementById('global-status'),
    senderCard: document.getElementById('sender-card'),
    senderFile: document.getElementById('sender-file'),
    senderCreate: document.getElementById('sender-create'),
    senderStart: document.getElementById('sender-start'),
    senderOtc: document.getElementById('sender-otc'),
    senderMeta: document.getElementById('sender-meta'),
    senderQr: document.getElementById('sender-qr'),
    senderStatus: document.getElementById('sender-status'),
    receiverCard: document.getElementById('receiver-card'),
    receiverOtc: document.getElementById('receiver-otc'),
    receiverJoin: document.getElementById('receiver-join'),
    receiverImport: document.getElementById('receiver-import'),
    receiverMeta: document.getElementById('receiver-meta'),
    receiverStatus: document.getElementById('receiver-status'),
    receiverKeyStatus: document.getElementById('receiver-key-status'),
  };

  const state = {
    sender: {
      worker: null,
      otc: null,
      transferId: null,
      pc: null,
      dc: null,
      metadata: null,
      receiverPubKey: null,
      pendingReceiverPubKey: null,
      keyWrapped: false,
      chunksReady: false,
      chunks: [],       // in-memory chunk cache; avoids async-storage timing races
    },
    receiver: {
      worker: null,
      otc: null,
      transferId: null,
      pc: null,
      expectedTotal: 0,
      metadata: null,
      keyReady: false,
      receiverPubKey: null,
      pendingEncrypted: [],
      receivedSeqs: new Set(),
      nackTimer: null,
      doneReceived: false,  // latched true when sender sends {done:true}; survives timer resets
    },
  };

  function setGlobalStatus(message) {
    els.globalStatus.textContent = message;
  }
  function setSenderStatus(message) {
    els.senderStatus.textContent = message;
  }
  function setReceiverStatus(message) {
    els.receiverStatus.textContent = message;
  }
  function setReceiverKeyStatus(message) {
    els.receiverKeyStatus.textContent = message;
  }
  function setSenderOtc(message) {
    els.senderOtc.textContent = message;
  }

  function toBase64(input) {
    if (typeof input === 'string') return input;
    const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function makeWorker() {
    const worker = new Worker('/worker.js');
    return worker;
  }

  function ensureSenderWorker() {
    if (state.sender.worker) return state.sender.worker;
    const worker = makeWorker();
    worker.addEventListener('message', handleSenderWorkerMessage);
    state.sender.worker = worker;
    processPendingReceiverPubKey();
    return worker;
  }

  function ensureReceiverWorker() {
    if (state.receiver.worker) return state.receiver.worker;
    const worker = makeWorker();
    worker.addEventListener('message', handleReceiverWorkerMessage);
    state.receiver.worker = worker;
    return worker;
  }

  function renderQr(metadataJson) {
    els.senderQr.innerHTML = '';
    const textarea = document.createElement('textarea');
    textarea.readOnly = true;
    textarea.value = metadataJson;
    textarea.style.minHeight = '110px';
    textarea.style.width = '100%';
    textarea.style.marginBottom = '12px';
    els.senderQr.appendChild(textarea);
    QRCode.toCanvas(metadataJson, { width: 250, margin: 1 }, (err, canvas) => {
      if (!err) els.senderQr.appendChild(canvas);
    });
  }

  function clearTransferStorage(transferId) {
    ShareItStorage.clearTransfer(transferId, 'sender').catch(() => {});
    ShareItStorage.clearTransfer(transferId, 'receiver').catch(() => {});
  }

  async function prepareSenderTransfer(file) {
    if (!state.sender.otc) throw new Error('Create an OTC first');
    clearTransferStorage(state.sender.otc);
    const worker = ensureSenderWorker();
    const buffer = await file.arrayBuffer();
    setGlobalStatus('Preparing sender worker…');
    worker.postMessage({
      type: 'prepareSenderTransfer',
      fileName: file.name,
      fileBuffer: buffer,
      chunkSize: file.size >= 5 * 1024 * 1024 ? 64 * 1024 : 1024,
      transferId: state.sender.otc,
    });
  }

  function processPendingReceiverPubKey() {
    if (!state.sender.pendingReceiverPubKey || !state.sender.worker || !state.sender.otc || !state.sender.metadata) return;
    state.sender.worker.postMessage({ type: 'wrapFileKey', receiverPubKey: state.sender.pendingReceiverPubKey });
    setSenderStatus('Receiver public key received. Wrapping AES key…');
    state.sender.pendingReceiverPubKey = null;
  }

  function createSenderRoom() {
    const file = els.senderFile.files[0];
    if (!file) {
      alert('Pick a file first');
      return;
    }
    socket.emit('create_room', (res) => {
      state.sender.otc = res.otc;
      state.sender.transferId = res.otc;
      setSenderOtc(`OTC: ${res.otc}`);
      setGlobalStatus('Room created. Waiting for metadata and receiver key exchange.');
      prepareSenderTransfer(file).catch((err) => {
        console.error(err);
        setSenderStatus(`Sender prep failed: ${err.message}`);
      });
    });
  }

  async function startWebRtcSend() {
    if (!state.sender.otc) {
      alert('Create an OTC first');
      return;
    }
    if (!els.senderFile.files[0]) {
      alert('Pick a file first');
      return;
    }
    state.sender.pc = new RTCPeerConnection();
    state.sender.dc = state.sender.pc.createDataChannel('file');
    state.sender.dc.binaryType = 'arraybuffer';

    state.sender.dc.onopen = () => {
      setSenderStatus('DataChannel open. Sending stored chunks.');
      if (state.sender.chunksReady) {
        sendAllStoredChunks();
      } else {
        setSenderStatus('DataChannel open. Waiting for chunk preparation to complete…');
      }
    };
    state.sender.dc.onclose = () => setSenderStatus('DataChannel closed');

    state.sender.pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', { otc: state.sender.otc, type: 'ice', data: event.candidate });
        // Local dispatch: deliver sender ICE directly to receiver PC.
        if (state.receiver.pc) {
          state.receiver.pc.addIceCandidate(event.candidate).catch(() => {});
        }
      }
    };

    const offer = await state.sender.pc.createOffer();
    await state.sender.pc.setLocalDescription(offer);
    const offerMsg = { otc: state.sender.otc, type: 'offer', data: offer };
    socket.emit('signal', offerMsg);
    // Local dispatch: deliver offer directly to receiver on this same page.
    await handleSignal(offerMsg);
    setSenderStatus('Offer sent. Waiting for answer…');
  }

  async function sendAllStoredChunks() {
    if (!state.sender.dc || state.sender.dc.readyState !== 'open') return;
    // Prefer in-memory chunks (always current); fall back to storage for resume after reload.
    let chunks = state.sender.chunks;
    if (!chunks.length) {
      chunks = await ShareItStorage.getChunks(state.sender.transferId || state.sender.otc, 'sender').catch(() => []);
    }
    if (!chunks.length) {
      setSenderStatus('No chunks found to send.');
      return;
    }
    const sorted = [...chunks].sort((a, b) => a.seq - b.seq);
    for (const chunk of sorted) {
      state.sender.dc.send(JSON.stringify({
        seq: chunk.seq,
        total: sorted.length,
        data: toBase64(chunk.data),
        iv: toBase64(chunk.iv),
      }));
      setSenderStatus(`Sent chunk ${chunk.seq + 1}/${sorted.length}`);
    }
    state.sender.dc.send(JSON.stringify({ done: true, transferId: state.sender.transferId || state.sender.otc, total: sorted.length }));
  }

  async function resendMissingChunks(missingSeqs) {
    if (!state.sender.dc || state.sender.dc.readyState !== 'open') return;
    const transferId = state.sender.transferId || state.sender.otc;
    const seqSet = new Set(missingSeqs);
    // Prefer in-memory cache for resends.
    const inMemory = state.sender.chunks.filter(c => seqSet.has(c.seq));
    const toSend = inMemory.length === missingSeqs.length
      ? inMemory
      : await (async () => {
          const results = [];
          for (const seq of [...seqSet].sort((a, b) => a - b)) {
            const chunk = await ShareItStorage.getChunk(transferId, 'sender', seq).catch(() => null);
            if (chunk) results.push(chunk);
          }
          return results;
        })();
    for (const chunk of toSend.sort((a, b) => a.seq - b.seq)) {
      state.sender.dc.send(JSON.stringify({
        seq: chunk.seq,
        total: toSend.length,
        data: toBase64(chunk.data),
        iv: toBase64(chunk.iv),
        resend: true,
      }));
      setSenderStatus(`Resent missing chunk ${chunk.seq + 1}`);
    }
    state.sender.dc.send(JSON.stringify({ done: true, transferId, resend: true }));
  }

  function handleSenderWorkerMessage(event) {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'senderMetadata') {
      state.sender.metadata = msg.metadata;
      const payload = JSON.stringify(msg.metadata);
      els.senderMeta.value = payload;
      renderQr(payload);
      setSenderStatus('Metadata ready. Share the QR or JSON with the receiver.');
      setGlobalStatus('Sender metadata generated without exposing the raw AES key.');
      processPendingReceiverPubKey();
      return;
    }

    if (msg.type === 'chunk') {
      const transferId = state.sender.transferId || state.sender.otc;
      // Keep in memory for immediate use; also persist for NACK-resend resume.
      state.sender.chunks.push({ seq: msg.seq, total: msg.total, data: msg.data, iv: msg.iv });
      ShareItStorage.saveChunk(transferId, 'sender', msg.seq, msg.data, msg.iv).catch(console.error);
      return;
    }

    if (msg.type === 'done') {
      state.sender.chunksReady = true;
      setSenderStatus('All chunks encrypted and stored. Ready to send.');
      if (state.sender.dc && state.sender.dc.readyState === 'open') {
        sendAllStoredChunks().catch(console.error);
      }
      return;
    }

    if (msg.type === 'senderPubKey') {
      if (state.sender.metadata) {
        state.sender.metadata.senderPubKey = msg.publicKey;
        els.senderMeta.value = JSON.stringify(state.sender.metadata, null, 2);
        renderQr(els.senderMeta.value);
      }
      return;
    }

    if (msg.type === 'wrappedFileKey') {
      const wkPayload = {
        otc: state.sender.otc,
        transferId: state.sender.transferId || state.sender.otc,
        wrappedKey: msg.wrappedKey,
        iv: msg.iv,
        senderPubKey: msg.senderPubKey,
      };
      socket.emit('wrapped_key', wkPayload);
      // Local dispatch: receiver is on the same socket, server won't relay back.
      handleWrappedKey(wkPayload);
      setSenderStatus('AES key wrapped and sent over signaling.');
      state.sender.keyWrapped = true;
      return;
    }
  }

  function handleReceiverWorkerMessage(event) {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'receiverPubKey') {
      state.receiver.receiverPubKey = msg.publicKey;
      setReceiverKeyStatus('Key: generated');
      if (state.receiver.otc) {
        const rpPayload = {
          otc: state.receiver.otc,
          transferId: state.receiver.transferId || state.receiver.otc,
          receiverPubKey: msg.publicKey,
        };
        socket.emit('receiver_pub', rpPayload);
        // Local dispatch: sender is on the same socket, server won't relay back to us.
        handleReceiverPub(rpPayload);
        setReceiverStatus('Receiver public key sent. Waiting for wrapped AES key…');
      }
      return;
    }

    if (msg.type === 'fileKeyReady') {
      state.receiver.keyReady = true;
      setReceiverKeyStatus('Key: ready');
      setReceiverStatus('AES key unwrapped. Processing buffered chunks…');
      flushReceiverQueue();
      return;
    }

    if (msg.type === 'decrypted') {
      const transferId = state.receiver.transferId || state.receiver.otc;
      ShareItStorage.saveChunk(transferId, 'receiver', msg.seq, msg.data, null).catch(console.error);
      if (!window._received) window._received = [];
      window._received[msg.seq] = new Uint8Array(msg.data);
      state.receiver.receivedSeqs.add(msg.seq);
      setReceiverStatus(`Decrypted chunk ${msg.seq + 1}/${state.receiver.expectedTotal || '?'}`);
      scheduleReceiverNackCheck();
      return;
    }
  }

  function ensureReceiverKeyPair() {
    const worker = ensureReceiverWorker();
    worker.postMessage({ type: 'generateReceiverKeyPair' });
  }

  function importReceiverMetadata() {
    const raw = els.receiverMeta.value.trim();
    if (!raw) {
      alert('Paste metadata JSON');
      return;
    }
    try {
      const meta = JSON.parse(raw);
      state.receiver.metadata = meta;
      state.receiver.transferId = meta.otc || state.receiver.otc;
      state.receiver.expectedTotal = meta.total || Math.ceil(meta.s / (meta.c || 1024));
      setReceiverStatus('Metadata imported. Starting key exchange…');
      ensureReceiverKeyPair();
      clearTransferStorage(state.receiver.transferId);
      return;
    } catch (err) {
      alert('Invalid metadata JSON');
    }
  }

  function joinReceiverRoom() {
    const otc = els.receiverOtc.value.trim();
    if (!otc) {
      alert('Enter OTC');
      return;
    }
    state.receiver.otc = otc;
    socket.emit('join_room', { otc }, (res) => {
      if (res && res.error) {
        setReceiverStatus(`Join error: ${res.error}`);
        return;
      }
      setReceiverStatus('Joined room. Waiting for sender offer and wrapped key.');
      setGlobalStatus(`Receiver joined room ${otc}.`);
      if (state.receiver.receiverPubKey && state.receiver.metadata) {
        socket.emit('receiver_pub', {
          otc,
          transferId: state.receiver.transferId || otc,
          receiverPubKey: state.receiver.receiverPubKey,
        });
      }
    });
  }

  function setupReceiverPeer() {
    state.receiver.pc = new RTCPeerConnection();
    state.receiver.pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer';
      dc.onmessage = (ev) => handleDataChannelMessage(ev.data);
      dc.onopen = () => setReceiverStatus('DataChannel open.');
    };
    state.receiver.pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', { otc: state.receiver.otc, type: 'ice', data: event.candidate });
        // Local dispatch: deliver receiver ICE directly to sender PC.
        if (state.sender.pc) {
          state.sender.pc.addIceCandidate(event.candidate).catch(() => {});
        }
      }
    };
  }

  function handleDataChannelMessage(raw) {
    try {
      const obj = JSON.parse(raw);
      if (obj.done) {
        state.receiver.expectedTotal = obj.total || state.receiver.expectedTotal;
        scheduleReceiverNackCheck(true);
        return;
      }
      state.receiver.pendingEncrypted.push(obj);
      flushReceiverQueue();
    } catch (err) {
      console.error(err);
    }
  }

  function flushReceiverQueue() {
    if (!state.receiver.keyReady || !state.receiver.worker) return;
    while (state.receiver.pendingEncrypted.length) {
      const obj = state.receiver.pendingEncrypted.shift();
      state.receiver.worker.postMessage({
        type: 'decryptChunk',
        seq: obj.seq,
        dataB64: obj.data,
        ivB64: obj.iv,
      });
      state.receiver.expectedTotal = obj.total || state.receiver.expectedTotal;
    }
  }

  function scheduleReceiverNackCheck(finalCheck = false) {
    if (finalCheck) state.receiver.doneReceived = true;  // latch — survives timer resets
    if (state.receiver.nackTimer) clearTimeout(state.receiver.nackTimer);
    state.receiver.nackTimer = setTimeout(async () => {
      const total = state.receiver.expectedTotal || (state.receiver.metadata ? state.receiver.metadata.total : 0);
      if (!total) return;
      const missing = [];
      for (let i = 0; i < total; i++) {
        if (!state.receiver.receivedSeqs.has(i)) missing.push(i);
      }
      if (missing.length) {
        socket.emit('nack', {
          otc: state.receiver.otc,
          transferId: state.receiver.transferId || state.receiver.otc,
          total,
          missingSeqs: missing,
        });
        setReceiverStatus(`Requested ${missing.length} missing chunk(s).`);
        return;
      }
      if (state.receiver.doneReceived) {
        await assembleReceiverDownload();
        setReceiverStatus('File received.');
      }
    }, 300);
  }

  async function assembleReceiverDownload() {
    const transferId = state.receiver.transferId || state.receiver.otc;
    const chunks = await ShareItStorage.getChunks(transferId, 'receiver').catch(() => []);
    const parts = [];
    if (chunks.length) {
      for (const chunk of chunks.sort((a, b) => a.seq - b.seq)) {
        if (chunk.data instanceof ArrayBuffer) parts.push(new Uint8Array(chunk.data));
        else if (typeof chunk.data === 'string') parts.push(new Uint8Array(fromBase64(chunk.data)));
      }
    } else {
      for (let i = 0; i < state.receiver.expectedTotal; i++) {
        if (window._received && window._received[i]) parts.push(window._received[i]);
      }
    }
    if (!parts.length) return;
    const size = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      buffer.set(part, offset);
      offset += part.byteLength;
    }
    const fileName = (state.receiver.metadata && state.receiver.metadata.f) ? state.receiver.metadata.f : 'received.bin';
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // Named handlers — called from both socket.on() and local dispatch.
  // This is required because sender + receiver share one socket on the unified page;
  // socket.to(otc) excludes the emitting socket, so messages never arrive via the
  // network path. Calling these directly bridges the gap.

  async function handleSignal(msg) {
    if (!msg || !msg.otc) return;
    // Sender side: receives answer and ICE from receiver.
    if (state.sender.otc && msg.otc === state.sender.otc) {
      if (msg.type === 'answer' && state.sender.pc) {
        await state.sender.pc.setRemoteDescription(msg.data);
        setSenderStatus('Received answer. WebRTC handshake complete.');
      } else if (msg.type === 'ice' && state.sender.pc) {
        try { await state.sender.pc.addIceCandidate(msg.data); } catch (e) { console.warn(e); }
      }
    }
    // Receiver side: receives offer and ICE from sender.
    if (state.receiver.otc && msg.otc === state.receiver.otc) {
      if (msg.type === 'offer' && state.receiver.pc) {
        await state.receiver.pc.setRemoteDescription(msg.data);
        const answer = await state.receiver.pc.createAnswer();
        await state.receiver.pc.setLocalDescription(answer);
        const answerMsg = { otc: state.receiver.otc, type: 'answer', data: answer };
        socket.emit('signal', answerMsg);
        // Local dispatch: deliver answer directly to sender on this page.
        await handleSignal(answerMsg);
        setReceiverStatus('Answer sent. Waiting for DataChannel…');
      } else if (msg.type === 'ice' && state.receiver.pc) {
        try { await state.receiver.pc.addIceCandidate(msg.data); } catch (e) { console.warn(e); }
      }
    }
  }

  function handleReceiverPub(msg) {
    if (!state.sender.otc || !msg || msg.otc !== state.sender.otc) return;
    if (!state.sender.worker || !state.sender.metadata) {
      state.sender.pendingReceiverPubKey = msg.receiverPubKey;
      setSenderStatus('Receiver public key received. Waiting for sender prep…');
      return;
    }
    state.sender.worker.postMessage({ type: 'wrapFileKey', receiverPubKey: msg.receiverPubKey });
    setSenderStatus('Receiver public key received. Wrapping AES key…');
  }

  function handleWrappedKey(msg) {
    if (!msg) return;
    if (state.receiver.otc && msg.otc === state.receiver.otc && state.receiver.worker) {
      state.receiver.worker.postMessage({
        type: 'unwrapFileKey',
        senderPubKey: msg.senderPubKey,
        wrappedKey: msg.wrappedKey,
        iv: msg.iv,
      });
      setReceiverStatus('Wrapped key received. Unwrapping…');
    }
  }

  function bootstrapSocketHandlers() {
    // Socket path: used when sender/receiver are on different devices/tabs.
    socket.on('signal', (msg) => handleSignal(msg).catch(console.error));
    socket.on('receiver_pub', handleReceiverPub);
    socket.on('wrapped_key', handleWrappedKey);
    socket.on('nack', async (msg) => {
      if (!msg || !msg.otc) return;
      if (state.sender.otc && msg.otc === state.sender.otc) {
        const missingSeqs = Array.isArray(msg.missingSeqs) ? msg.missingSeqs : [];
        if (missingSeqs.length) await resendMissingChunks(missingSeqs);
      }
    });
  }

  function selectInitialView() {
    const hash = (location.hash || '').toLowerCase();
    if (hash.includes('sender')) els.senderCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (hash.includes('receiver')) els.receiverCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  els.senderCreate.addEventListener('click', createSenderRoom);
  els.senderStart.addEventListener('click', () => startWebRtcSend().catch((err) => setSenderStatus(`WebRTC start failed: ${err.message}`)));
  els.receiverJoin.addEventListener('click', joinReceiverRoom);
  els.receiverImport.addEventListener('click', () => {
    importReceiverMetadata();
  });

  socket.on('connect', () => {
    setGlobalStatus('Connected to signaling server.');
  });

  socket.on('disconnect', () => {
    setGlobalStatus('Disconnected from signaling server.');
  });

  bootstrapSocketHandlers();
  setupReceiverPeer();
  selectInitialView();

  // If the receiver imports metadata before joining, a receiver pubkey still gets generated.
  // If join happens first, receiver_pub is emitted immediately after key generation.
})();
