#!/usr/bin/env bash
# Share2Me OCI Auto-Claimer Launcher for Linux / macOS / Raspberry Pi
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

chmod 600 oci_api_key.pem 2>/dev/null || true

echo "==================================================="
echo " Starting Share2Me OCI Capacity Claimer"
echo "==================================================="

python3 claimer.py