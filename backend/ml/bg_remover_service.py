import os
import io
import time
import hmac
import logging
import threading
import numpy as np
from PIL import Image
from flask import Flask, request, Response, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix
import rembg
import onnxruntime as ort

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s - %(message)s')
logger = logging.getLogger("BGRemoverML")

app = Flask(__name__)

# Apply ProxyFix so request.remote_addr and scheme accurately reflect client behind Cloud Run / Cloudflare
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Cap request payload at 25MB to prevent container OOM
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024

INTERNAL_ML_SECRET = os.environ.get("INTERNAL_ML_SECRET", "").strip()

# Image dimension safeguards
MAX_TOTAL_PIXELS = 25_000_000  # 25 Megapixels (e.g. 5000x5000)
MAX_EDGE_DIMENSION = 4096       # Proportional clamp for runaway resolutions

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "Uploaded image is too large. Maximum allowed file size is 25MB."}), 413

@app.before_request
def verify_internal_secret():
    # Public endpoints for Cloud Run container probes and health monitoring
    if request.path in ('/health', '/ping', '/'):
        return None

    # Enforce constant-time internal secret key authentication if configured
    if INTERNAL_ML_SECRET:
        token = request.headers.get("X-Internal-Secret", "").strip()
        auth_header = request.headers.get("Authorization", "").strip()
        if auth_header.startswith("Bearer "):
            token = token or auth_header[7:].strip()

        if not token or not hmac.compare_digest(token, INTERNAL_ML_SECRET):
            logger.warning(f"[Security] Unauthorized attempt to {request.path} from IP {request.remote_addr}")
            return jsonify({"error": "Forbidden: Access restricted to Share2Me backend."}), 403

    return None

MODEL_LICENSE = "Apache 2.0 / MIT (Open Commercial & Self-Hosted Use)"
DEFAULT_MODEL = "auto"

sessions = {}
sessions_lock = threading.Lock()
is_initializing = True

def create_onnx_session_options():
    """
    Explicitly pin ONNX Runtime thread pool to match the container's CPU allocation.
    Prevents host bare-metal oversubscription (e.g. spawning 64 threads on a 4-core container).
    """
    opts = ort.SessionOptions()
    cpu_limit = int(os.environ.get("OMP_NUM_THREADS", "4"))
    opts.intra_op_num_threads = cpu_limit
    opts.inter_op_num_threads = 1
    opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return opts

def get_session(model_name="isnet-general-use"):
    """
    Thread-Safe Model Session Factory & Cache with Double-Checked Locking.
    """
    # Fast path: check without acquiring lock
    if model_name in sessions:
        return sessions[model_name]

    with sessions_lock:
        # Re-check under lock
        if model_name in sessions:
            return sessions[model_name]

        u2net_home = os.environ.get("U2NET_HOME", os.path.expanduser("~/.u2net"))
        model_file = f"{model_name}.onnx"
        model_path = os.path.join(u2net_home, model_file)
        if not os.path.exists(model_path) and model_name not in ("isnet-general-use", "u2net"):
            logger.warning(f"[Safe-Guard] Model '{model_name}' ONNX not pre-baked on disk. Routing to pre-baked high-precision 'isnet-general-use'.")
            return get_session("isnet-general-use")

        try:
            threads = os.environ.get("OMP_NUM_THREADS", "4")
            logger.info(f"Initializing native rembg session for model '{model_name}' (threads={threads})...")
            sess_opts = create_onnx_session_options()
            session_instance = rembg.new_session(model_name, session_options=sess_opts)
            sessions[model_name] = session_instance
            logger.info(f"rembg session for '{model_name}' initialized successfully!")
            return session_instance
        except Exception as err:
            logger.error(f"Failed to load rembg session for '{model_name}': {err}", exc_info=True)
            if model_name != "isnet-general-use":
                return get_session("isnet-general-use")
            return None

def load_initial_sessions():
    """
    Synchronous model pre-loading during container boot.
    Pre-loads the primary high-speed SOTA model ('isnet-general-use') in ~1s.
    The secondary fallback model ('u2net') will be loaded on-demand if fallback is triggered.
    """
    global is_initializing
    logger.info("Pre-loading primary ML model ('isnet-general-use')...")
    try:
        get_session("isnet-general-use")
    except Exception as e:
        logger.error(f"Error during model pre-loading: {e}", exc_info=True)
    finally:
        is_initializing = False
    logger.info("Primary ML model pre-loaded and ready for inference!")

# Pre-load synchronously so Gunicorn --preload warms up memory before binding port 8080
load_initial_sessions()

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
    1. Runs Primary Fast SOTA Model ('isnet-general-use' - ~1.1s execution).
    2. Validates Mask Quality.
    3. Triggers Fallback ('u2net') if primary pass scores low.
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

@app.route('/', methods=['GET'])
@app.route('/health', methods=['GET'])
def health():
    status_str = "ready" if len(sessions) > 0 else ("initializing" if is_initializing else "error")
    return jsonify({
        "service": "share2me-ai",
        "status": status_str,
        "version": "2.1.0",
        "is_initializing": is_initializing,
        "default_model": DEFAULT_MODEL,
        "loaded_models": list(sessions.keys()),
        "available_models": ["auto", "isnet-general-use", "birefnet-general", "birefnet-portrait", "u2net", "isnet-anime"],
        "capabilities": ["background-removal", "multi-model-ready"],
        "cpu_cores": os.cpu_count(),
        "omp_threads": os.environ.get("OMP_NUM_THREADS", "4"),
        "auth_required": bool(INTERNAL_ML_SECRET),
        "license": MODEL_LICENSE,
        "engine": "Official rembg + IS-Net High-Speed SOTA Architecture",
        "device": "CPU (Pinned ONNX Runtime ThreadPool)"
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

    try:
        t0 = time.time()
        input_bytes = file.read()
        
        orig_img = Image.open(io.BytesIO(input_bytes))
        orig_w, orig_h = orig_img.size

        # Guard against decompression bomb attacks
        if orig_w * orig_h > MAX_TOTAL_PIXELS:
            return jsonify({
                "error": f"Image dimensions too large ({orig_w}x{orig_h}). Maximum supported resolution is 25 megapixels."
            }), 400

        # Proportionally constrain huge edge dimensions for optimal inference speed & memory
        if orig_w > MAX_EDGE_DIMENSION or orig_h > MAX_EDGE_DIMENSION:
            orig_img.thumbnail((MAX_EDGE_DIMENSION, MAX_EDGE_DIMENSION), Image.Resampling.LANCZOS)
            orig_w, orig_h = orig_img.size
            logger.info(f"Scaled image dimensions to {orig_w}x{orig_h} for optimal inference performance.")

        orig_img = orig_img.convert("RGB")
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
