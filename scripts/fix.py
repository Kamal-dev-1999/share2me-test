import codecs

with codecs.open('frontend/src/hooks/useTransfer.ts', 'r', 'utf-8') as f:
    content = f.read()

# 1. Add isResending
target1 = '    streamPaused:         false, // true when DC buffer is over HIGH_WATER'
replace1 = '    streamPaused:         false, // true when DC buffer is over HIGH_WATER\n    isResending:          false, // lock for NACK resends to prevent concurrent backpressure clobbering'
content = content.replace(target1, replace1)

# 2. Update resendMissingChunks
target2 = '''  const resendMissingChunks = useCallback(async (missingSeqs: number[]) => {
    const s = snd.current;
    if (!s.dc || s.dc.readyState !== "open") return;

    // Pause main stream so NACKs get priority and we don't clobber the event handler
    s.streamPaused = true;
    s.dc.onbufferedamountlow = null;'''
replace2 = '''  const resendMissingChunks = useCallback(async (missingSeqs: number[]) => {
    const s = snd.current;
    if (!s.dc || s.dc.readyState !== "open" || s.isResending) return;

    // Acquire lock and pause main stream
    s.isResending = true;
    s.streamPaused = true;
    s.dc.onbufferedamountlow = null;'''
content = content.replace(target2, replace2)

target3 = '''    // Restore the main stream pipeline
    if (s.streamingIndex < s.frames.length) {
      s.streamPaused = false;
      resumeStream();
    }
  }, [resumeStream]);'''
replace3 = '''    // Release lock and restore the main stream pipeline
    s.isResending = false;
    s.streamPaused = false;
    if (s.streamingIndex < s.frames.length) {
      resumeStream();
    }
  }, [resumeStream]);'''
content = content.replace(target3, replace3)

# 3. Add resetTransfer
import_idx = content.find("  importMetadataRef.current = importMetadata;")
content = content[:import_idx] + '''  importMetadataRef.current = importMetadata;

  // -----------------------------------------------------------------------------
  // Reset / Cancel functionality
  // -----------------------------------------------------------------------------

  const resetTransfer = useCallback(() => {
    const s = snd.current;
    const r = rcv.current;
    
    // Stop workers
    if (s.worker) { s.worker.terminate(); s.worker = null; }
    if (r.worker) { r.worker.terminate(); r.worker = null; }
    
    // Close WebRTC
    if (s.pc) { s.pc.close(); s.pc = null; }
    if (s.dc) { s.dc.close(); s.dc = null; }
    if (r.pc) { r.pc.close(); r.pc = null; }

    // Clear timers
    if (r.nackTimer) { clearTimeout(r.nackTimer); r.nackTimer = null; }

    // Notify backend to clean up if we had an OTC
    if (s.otc && role.current === "sender") {
      socket.emit("cancel_room", { otc: s.otc });
    }

    // Reset refs
    s.otc = null;
    s.metadata = null;
    s.frames = [];
    s.chunks = [];
    s.streamingIndex = 0;
    s.streamPaused = false;
    s.isResending = false;
    
    r.otc = null;
    r.metadata = null;
    r.expectedTotal = 0;
    r.receivedSeqs.clear();
    r.processingSeqs.clear();
    r.decryptQueue = [];
    r.doneReceived = false;
    r.downloadTriggered = false;

    // Reset UI state
    role.current = null;
    setSenderPhase("idle");
    setSenderStatus("");
    setSenderOtc(null);
    setSenderProgress(0);
    setSenderBytes(0);

    setReceiverPhase("idle");
    setReceiverStatus("");
    setReceiverProgress(0);
    setReceiverBytes(0);
    setReceivedText("");
  }, [socket]);

  return {
    // Sender state & methods
    senderPhase,
    senderStatus,
    senderOtc,
    senderProgress,
    senderBytes,
    createRoom,
    createTextRoom,
    startWebRtcSend,
    
    // Receiver state & methods
    receiverPhase,
    receiverStatus,
    receiverKeyStatus,
    receiverProgress,
    receiverBytes,
    receivedText,
    joinRoom,

    // Shared methods
    resetTransfer
  };
}
'''

with codecs.open('frontend/src/hooks/useTransfer.ts', 'w', 'utf-8') as f:
    f.write(content)

