FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (libgomp for ONNX Runtime multi-threading, curl for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download and cache models during Docker build (baked into image for instant cold-starts)
COPY download_model.py setup_u2net_dir.py ./
RUN python download_model.py && python setup_u2net_dir.py

COPY bg_remover_service.py ./

ENV PORT=8080
ENV HOST=0.0.0.0
ENV U2NET_HOME=/root/.u2net
ENV PYTHONUNBUFFERED=1
ENV OMP_NUM_THREADS=4
ENV ONNXRUNTIME_NUM_THREADS=4

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://127.0.0.1:8080/health || exit 1

# Run with Gunicorn WSGI server (1 worker, 4 threads matching 4 vCPU, --preload to warm up model before opening port)
CMD ["gunicorn", "--preload", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "4", "--timeout", "300", "--access-logfile", "-", "--error-logfile", "-", "bg_remover_service:app"]
