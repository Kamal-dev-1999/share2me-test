#!/bin/bash
set -euo pipefail
exec > /var/log/claimer-startup.log 2>&1

echo "=========================================================="
echo " Starting OCI Capacity Grabber Deployment on GCP VM"
echo " Time: $(date -u)"
echo "=========================================================="

apt-get update
apt-get install -y python3 python3-pip python3-venv curl

mkdir -p /opt/claimer
cd /opt/claimer

# Create virtual environment to avoid PEP 668 managed environment issues
python3 -m venv /opt/claimer/venv
/opt/claimer/venv/bin/pip install --upgrade pip
/opt/claimer/venv/bin/pip install oci

# Fetch files from GCP instance metadata or write them
cat > /opt/claimer/config.json << 'CONFIGEOF'
{
  "tenancy": "ocid1.tenancy.oc1..aaaaaaaa3apeakk5cat3uuzxp2xgbv3r5ux6cb2frdylillb7k3nl42ckc2a",
  "user": "ocid1.user.oc1..aaaaaaaabgmtwdnheozajrbr2waui4ghfwjunlvahfwl2dksqfazcjrshc2a",
  "fingerprint": "ea:9d:83:0f:86:79:80:6c:a6:ae:1f:c0:81:09:36:5e",
  "key_file": "./oci_api_key.pem",
  "region": "ap-mumbai-1",
  "availability_domain": "UVsX:AP-MUMBAI-1-AD-1",
  "subnet_id": "ocid1.subnet.oc1.ap-mumbai-1.aaaaaaaasexemjuf5h5w6hqmcybdnlmpp57rbew3rwirzwemqv3vqfqtffca",
  "nsg_ids": [
    "ocid1.networksecuritygroup.oc1.ap-mumbai-1.aaaaaaaadvjnlnj2wavdjbjvcmvcggx4hujzciulid5dh4srfilx3xsbwkua"
  ],
  "image_id": "ocid1.image.oc1.ap-mumbai-1.aaaaaaaa4sogqgbnshyvaejsymmzrq424rjlxzp2rdmmi3dftvd4tiqvoifq",
  "display_name": "share2me-server-prod",
  "shape": "VM.Standard.A1.Flex",
  "ocpus": 2,
  "memory_in_gbs": 12,
  "boot_volume_size_in_gbs": 100,
  "ssh_public_key": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH3mb+jySUIJdGhCZYflwtUxFn5RhKcQfJFYuQ+jPUnI kamal173",
  "poll_interval_seconds": 35
}
CONFIGEOF

cat > /opt/claimer/oci_api_key.pem << 'PEMEOF'
__OCI_PEM_KEY_CONTENT__
PEMEOF
chmod 600 /opt/claimer/oci_api_key.pem

# Copy claimer.py
cat > /opt/claimer/claimer.py << 'PYEOF'
__CLAIMER_PY_CONTENT__
PYEOF

# Create Systemd Service for persistent 24/7 autonomous execution
cat > /etc/systemd/system/oci-claimer.service << 'SVCEOF'
[Unit]
Description=OCI ARM Always Free Capacity Grabber
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/claimer
ExecStart=/opt/claimer/venv/bin/python /opt/claimer/claimer.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/claimer.log
StandardError=append:/var/log/claimer.log

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable --now oci-claimer.service

echo "Claimer service deployed and running!"
systemctl status oci-claimer.service --no-pager

