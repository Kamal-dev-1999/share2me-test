import os
import urllib.request
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DownloadModel")

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
ISNET_PATH = os.path.join(MODEL_DIR, "isnet-general-use.onnx")
ISNET_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx"

U2NET_PATH = os.path.join(MODEL_DIR, "u2net.onnx")
U2NET_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"

def ensure_model_downloaded():
    os.makedirs(MODEL_DIR, exist_ok=True)
    # Prefer high-resolution IS-Net model (1024x1024 input tensor)
    if not os.path.exists(ISNET_PATH) or os.path.getsize(ISNET_PATH) < 10000:
        logger.info(f"Downloading high-precision IS-Net ONNX model (1024x1024) from {ISNET_URL}...")
        urllib.request.urlretrieve(ISNET_URL, ISNET_PATH)
        logger.info(f"isnet-general-use.onnx downloaded successfully ({os.path.getsize(ISNET_PATH)} bytes)!")
    else:
        logger.info(f"isnet-general-use.onnx already present at {ISNET_PATH}")

    if not os.path.exists(U2NET_PATH) or os.path.getsize(U2NET_PATH) < 10000:
        logger.info(f"Downloading fallback u2net.onnx model from {U2NET_URL}...")
        urllib.request.urlretrieve(U2NET_URL, U2NET_PATH)
        logger.info(f"u2net.onnx downloaded successfully ({os.path.getsize(U2NET_PATH)} bytes)!")

if __name__ == "__main__":
    ensure_model_downloaded()
