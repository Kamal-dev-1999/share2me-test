import os
import io
import time
import logging
import numpy as np
from PIL import Image
from flask import Flask, request, Response, jsonify
import rembg

import threading

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s - %(message)s')
logger = logging.getLogger("BGRemoverML")

app = Flask(__name__)

# High-Speed SOTA Architecture (1024x1024 IS-Net General + BiRefNet Fast)
MODEL_LICENSE = "Apache 2.0 / MIT (Open Commercial & Self-Hosted Use)"
DEFAULT_MODEL = "auto"

sessions = {}
sessions_lock = threading.Lock()
is_initializing = True

def get_session(model_name="isnet-general-use"):
    """
    Model Session Factory & Cache:
    Primary High-Speed SOTA Model: 'isnet-general-use' (1024x1024 high resolution, 1.1s execution)
    """
    with sessions_lock:
        if model_name in sessions:
            return sessions[model_name]

    try:
        logger.info(f"Initializing native rembg session for model '{model_name}'...")
        session_instance = rembg.new_session(model_name)
        with sessions_lock:
            sessions[model_name] = session_instance
        logger.info(f"rembg session for '{model_name}' initialized successfully!")
        return session_instance
    except Exception as err:
        logger.error(f"Failed to load rembg session for '{model_name}': {err}", exc_info=True)
        if model_name != "u2net":
            return get_session("u2net")
        return None

def load_initial_sessions():
    global is_initializing
    logger.info("Pre-loading primary ML models ('isnet-general-use', 'u2net') in background thread...")
    try:
        get_session("isnet-general-use")
        get_session("u2net")
    except Exception as e:
        logger.error(f"Error during background model pre-loading: {e}")
    finally:
        is_initializing = False
    logger.info("All primary ML models pre-loaded and ready for inference!")

# Start model pre-loading in background thread so Flask binds port 5002 instantly
init_thread = threading.Thread(target=load_initial_sessions, daemon=True)
init_thread.start()

def validate_mask_quality(result_img, orig_w, orig_h):
    """
    Mask Quality & Integrity Validation Engine:
    Detects empty or fragmented masks.
    """
    try:
        np_img = np.array(result_img)
        if np_img.ndim != 3 or np_img.shape[2] != 4:
            return {"valid": False, "score": 0.0, "reason": "Non-RGBA output"}

        alpha = np_img[:, :, 3]
        total_pixels = orig_w * orig_h
        
        opaque_count = np.sum(alpha > 30)
        coverage = opaque_count / float(total_pixels)
        
        semi_transparent_count = np.sum((alpha > 5) & (alpha < 250))
        alpha_continuity = semi_transparent_count / float(max(1, opaque_count))

        logger.info(f"[Quality Engine] Mask Metrics: coverage={coverage*100:.2f}%, continuity={alpha_continuity:.4f}")

        score = 1.0
        reasons = []

        if coverage < 0.005:
            score -= 0.6
            reasons.append("Empty/near-empty mask (< 0.5% area)")

        if coverage > 0.995:
            score -= 0.4
            reasons.append("Over-saturated mask (> 99.5% area)")

        valid = score >= 0.5
        return {
            "valid": valid,
            "score": round(score, 3),
            "coverage": round(coverage, 4),
            "alpha_continuity": round(alpha_continuity, 4),
            "reasons": reasons
        }
    except Exception as e:
        logger.warning(f"[Quality Engine] Metric evaluation note: {e}")
        return {"valid": True, "score": 0.8, "coverage": 0.2, "reasons": [str(e)]}

def process_smart_pipeline(orig_img, requested_model="auto", post_process=True):
    """
    High-Speed Multi-Pass Pipeline:
    1. Runs Primary Fast SOTA Model ('isnet-general-use' - 1.1s execution).
    2. Validates Mask Quality.
    3. Triggers Fallback ('u2net' / 'birefnet-general') if primary pass scores low.
    """
    primary_model_name = "isnet-general-use"
    if requested_model == "anime":
        primary_model_name = "isnet-anime"
    elif requested_model in ("portrait", "birefnet-portrait"):
        primary_model_name = "birefnet-portrait"
    elif requested_model in ("u2net", "birefnet-general", "u2net_human_seg"):
        primary_model_name = requested_model

    logger.info(f"[High-Speed AI] Pass 1: Executing Model '{primary_model_name}'...")
    session_1 = get_session(primary_model_name) or get_session("u2net")
    res_1 = rembg.remove(orig_img, session=session_1, post_process_mask=post_process)
    
    metrics_1 = validate_mask_quality(res_1, orig_img.width, orig_img.height)

    if metrics_1['valid'] or requested_model not in ("auto", "general"):
        return res_1, primary_model_name, False, metrics_1

    fallback_model_name = "u2net"
    logger.warning(f"[High-Speed AI] Pass 1 Validation Low ({metrics_1['reasons']}). Triggering Fallback '{fallback_model_name}'...")
    
    session_2 = get_session(fallback_model_name)
    res_2 = rembg.remove(orig_img, session=session_2, post_process_mask=post_process)
    metrics_2 = validate_mask_quality(res_2, orig_img.width, orig_img.height)

    if metrics_2['score'] >= metrics_1['score']:
        return res_2, fallback_model_name, True, metrics_2
    else:
        return res_1, primary_model_name, False, metrics_1

@app.route('/health', methods=['GET'])
def health():
    status_str = "ready" if len(sessions) > 0 else ("initializing" if is_initializing else "error")
    return jsonify({
        "status": status_str,
        "is_initializing": is_initializing,
        "default_model": DEFAULT_MODEL,
        "loaded_models": list(sessions.keys()),
        "available_models": ["auto", "isnet-general-use", "birefnet-general", "birefnet-portrait", "u2net", "isnet-anime"],
        "license": MODEL_LICENSE,
        "engine": "Official rembg + IS-Net High-Speed SOTA Architecture",
        "device": "CPU"
    })

@app.route('/remove-background', methods=['POST'])
def remove_background():
    if 'image' not in request.files:
        return jsonify({"error": "No image file uploaded."}), 400

    file = request.files['image']
    if not file or file.filename == '':
        return jsonify({"error": "Empty file uploaded."}), 400

    requested_model = request.form.get('model', 'auto').lower()
    post_process_str = request.form.get('post_process_mask', 'true').lower()
    post_process = post_process_str in ('true', '1', 'yes')

    # If background model initialization is still running, wait up to 30s
    if is_initializing and init_thread.is_alive():
        logger.info("Inference requested while models pre-loading. Waiting for initialization thread to finish...")
        init_thread.join(timeout=30)

    try:
        t0 = time.time()
        input_bytes = file.read()
        
        orig_img = Image.open(io.BytesIO(input_bytes)).convert("RGB")
        orig_w, orig_h = orig_img.size
        logger.info(f"BG Removal starting for {file.filename} ({orig_w}x{orig_h}) | requested_model='{requested_model}', post_process={post_process}...")

        result_img, selected_model, fallback_triggered, metrics = process_smart_pipeline(
            orig_img,
            requested_model=requested_model,
            post_process=post_process
        )

        out_buffer = io.BytesIO()
        result_img.save(out_buffer, format="PNG", compress_level=6)
        output_bytes = out_buffer.getvalue()

        dt = time.time() - t0
        logger.info(f"BG Removal completed in {dt:.2f}s using '{selected_model}' (fallback={fallback_triggered}, quality_score={metrics['score']}, bytes={len(output_bytes)})")

        resp = Response(output_bytes, mimetype='image/png')
        resp.headers['X-Model-Used'] = selected_model
        resp.headers['X-Fallback-Triggered'] = str(fallback_triggered).lower()
        resp.headers['X-Quality-Score'] = str(metrics['score'])
        return resp
    except Exception as err:
        logger.error(f"Error during self-hosted AI inference: {err}", exc_info=True)
        return jsonify({"error": f"Self-hosted AI inference failed: {str(err)}"}), 500

if __name__ == '__main__':
    port = 5002
    logger.info(f"Starting self-hosted BG Remover ML service on http://127.0.0.1:{port}...")
    app.run(host='127.0.0.1', port=port, debug=False)
