import os
import io
import time
import logging
from PIL import Image
from flask import Flask, request, Response, jsonify
import rembg

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s - %(message)s')
logger = logging.getLogger("BGRemoverML")

app = Flask(__name__)

MODEL_NAME = "isnet-general-use"
MODEL_LICENSE = "Apache 2.0 (Open Commercial & Self-Hosted Use)"

session = None

def init_rembg_session():
    global session
    try:
        logger.info(f"Initializing native rembg session with '{MODEL_NAME}'...")
        session = rembg.new_session(MODEL_NAME)
        logger.info(f"rembg session for '{MODEL_NAME}' initialized successfully!")
    except Exception as err:
        logger.error(f"Failed to load rembg session: {err}", exc_info=True)
        session = None

init_rembg_session()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ready" if session is not None else "error",
        "model": MODEL_NAME,
        "license": MODEL_LICENSE,
        "engine": "Official rembg (Remove.bg Architecture)",
        "device": "CPU"
    })

@app.route('/remove-background', methods=['POST'])
def remove_background():
    global session
    if session is None:
        init_rembg_session()
        if session is None:
            return jsonify({"error": "ML inference model is not initialized."}), 500

    if 'image' not in request.files:
        return jsonify({"error": "No image file uploaded."}), 400

    file = request.files['image']
    if not file or file.filename == '':
        return jsonify({"error": "Empty file uploaded."}), 400

    try:
        t0 = time.time()
        input_bytes = file.read()
        
        orig_img = Image.open(io.BytesIO(input_bytes)).convert("RGB")
        orig_w, orig_h = orig_img.size
        logger.info(f"Remove.bg engine processing starting for {file.filename} ({orig_w}x{orig_h})...")

        # Process natively via official rembg pipeline
        result_img = rembg.remove(orig_img, session=session)

        # Save transparent RGBA PNG
        out_buffer = io.BytesIO()
        result_img.save(out_buffer, format="PNG", compress_level=6)
        output_bytes = out_buffer.getvalue()

        dt = time.time() - t0
        logger.info(f"Remove.bg engine processing succeeded in {dt:.2f}s! ({len(output_bytes)} bytes returned)")

        return Response(output_bytes, mimetype='image/png')
    except Exception as err:
        logger.error(f"Error during self-hosted AI inference: {err}", exc_info=True)
        return jsonify({"error": f"Self-hosted AI inference failed: {str(err)}"}), 500

if __name__ == '__main__':
    port = 5002
    logger.info(f"Starting self-hosted BG Remover ML service on http://127.0.0.1:{port}...")
    app.run(host='127.0.0.1', port=port, debug=False)
