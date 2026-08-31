import os
import urllib.request
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DownloadBiRefNet")

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
BIREFNET_PATH = os.path.join(MODEL_DIR, "birefnet-general.onnx")
BIREFNET_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/birefnet-general.onnx"

def ensure_birefnet_downloaded():
    os.makedirs(MODEL_DIR, exist_ok=True)
    if not os.path.exists(BIREFNET_PATH) or os.path.getsize(BIREFNET_PATH) < 10000:
        logger.info(f"Downloading BiRefNet ONNX model (State of the Art) from {BIREFNET_URL}...")
        urllib.request.urlretrieve(BIREFNET_URL, BIREFNET_PATH)
        logger.info(f"birefnet-general.onnx downloaded successfully ({os.path.getsize(BIREFNET_PATH)} bytes)!")
    else:
        logger.info(f"birefnet-general.onnx already present at {BIREFNET_PATH}")

if __name__ == "__main__":
    ensure_birefnet_downloaded()
