#!/usr/bin/env python3
"""
Share2Me — OCI Always Free ARM Ampere Instance Auto-Claimer
===========================================================
High-end, autonomous, multi-platform capacity grabber for Oracle Cloud Infrastructure.

Features:
  - 100% Autonomous: Once capacity is granted, automatically claims instance,
    allocates/binds permanent Reserved Static Public IP, and configures everything.
  - Zero-maintenance: Handles transient network drops, 429 rate-limiting, and rotates
    across all 3 Fault Domains in the availability domain.
  - Duplicate-safe: Checks if an instance is already created/running before looping.
  - Portable: Run on Linux, Mac, Windows, Raspberry Pi, or any cloud VM.
"""

import os
import sys
import time
import json
import base64
import datetime
import traceback

# ─── Ensure OCI SDK is installed ──────────────────────────────────────────────
try:
    import oci
except ImportError:
    print("\n[!] OCI Python SDK is not installed.")
    print("[*] Installing 'oci' package automatically via pip...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "oci"])
    import oci
    print("[+] OCI SDK installed successfully!\n")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")

def load_config():
    if not os.path.exists(CONFIG_PATH):
        print(f"[!] Error: Configuration file '{CONFIG_PATH}' not found!")
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    
    # Resolve key_file relative to script directory if relative
    if not os.path.isabs(cfg["key_file"]):
        cfg["key_file"] = os.path.normpath(os.path.join(SCRIPT_DIR, cfg["key_file"]))
    
    if not os.path.exists(cfg["key_file"]):
        print(f"[!] Error: Private key file '{cfg['key_file']}' not found!")
        sys.exit(1)
        
    return cfg

def get_cloud_init_script(ssh_key):
    """Production Cloud-Init bootstrap script matching Terraform configuration."""
    raw_script = f"""#!/bin/bash
set -euo pipefail
exec > /var/log/bootstrap.log 2>&1

echo "========================================================"
echo " Starting Share2Me Production Hardening & Provisioning"
echo " Time: $(date -u)"
echo "========================================================"

# 1. Hardening: Firewall & SSH
apt-get update
apt-get install -y ufw curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

sed -i 's/^#*PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd || true

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  comment 'SSH access'
ufw allow 80/tcp  comment 'HTTP ACME & Redirect'
ufw allow 443/tcp comment 'HTTPS Caddy Edge'
echo "y" | ufw enable

# 2. Kernel Tuning (WebSockets)
cat > /etc/sysctl.d/99-share2me.conf << 'EOF'
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
fs.file-max = 2097152
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_tw_reuse = 1
EOF
sysctl -p /etc/sysctl.d/99-share2me.conf

# 3. 4GB Swap Space
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 4. Install Docker & Caddy
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list

curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-list.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin caddy

systemctl enable --now docker
usermod -aG docker ubuntu

# 5. App Directory
mkdir -p /opt/share2me
chown -R ubuntu:ubuntu /opt/share2me

# 6. Keep-Alive Cron
echo "*/5 * * * * curl -sf http://127.0.0.1:80/health > /dev/null 2>&1" | crontab -u ubuntu -

systemctl daemon-reload
systemctl enable caddy
systemctl restart caddy

echo "========================================================"
echo " Share2Me Bootstrap Successfully Completed!"
echo " Time: $(date -u)"
echo "========================================================"
"""
    return base64.b64encode(raw_script.encode("utf-8")).decode("utf-8")

def check_existing_instance(compute_client, compartment_id, display_name):
    """Check if instance is already created and active."""
    try:
        instances = compute_client.list_instances(compartment_id).data
        for inst in instances:
            if inst.display_name == display_name and inst.lifecycle_state in ["RUNNING", "PROVISIONING", "STARTING"]:
                return inst
    except Exception as e:
        print(f"[!] Warning checking existing instances: {e}")
    return None

def bind_reserved_public_ip(compute_client, network_client, compartment_id, instance_id):
    """Attaches or creates a Reserved Public IP for the newly launched instance."""
    print("\n[*] Waiting for primary VNIC attachment...")
    vnic_id = None
    for _ in range(30):
        attachments = compute_client.list_vnic_attachments(
            compartment_id=compartment_id,
            instance_id=instance_id
        ).data
        if attachments and attachments[0].lifecycle_state == "ATTACHED":
            vnic_id = attachments[0].vnic_id
            break
        time.sleep(4)
        
    if not vnic_id:
        print("[!] Timed out waiting for VNIC attachment. You can attach IP manually in console.")
        return None

    # Get private IP of the VNIC
    vnic = network_client.get_vnic(vnic_id).data
    private_ips = network_client.list_private_ips(vnic_id=vnic_id).data
    if not private_ips:
        print("[!] Could not locate private IP for VNIC.")
        return None
        
    primary_private_ip_id = private_ips[0].id
    print(f"[+] Found VNIC Private IP ID: {primary_private_ip_id}")

    # Check if a Reserved IP named 'share2me-reserved-ip' already exists
    public_ips = network_client.list_public_ips(
        scope="REGION",
        compartment_id=compartment_id
    ).data
    
    target_ip = None
    for pip in public_ips:
        if pip.display_name == "share2me-reserved-ip" and pip.lifetime == "RESERVED":
            target_ip = pip
            break
            
    if target_ip:
        print(f"[*] Found existing Reserved Public IP ({target_ip.ip_address}). Binding to instance...")
        update_details = oci.core.models.UpdatePublicIpDetails(
            private_ip_id=primary_private_ip_id
        )
        res = network_client.update_public_ip(target_ip.id, update_details).data
        return res.ip_address
    else:
        print("[*] Allocating new permanent Reserved Static Public IP...")
        create_details = oci.core.models.CreatePublicIpDetails(
            compartment_id=compartment_id,
            lifetime="RESERVED",
            display_name="share2me-reserved-ip",
            private_ip_id=primary_private_ip_id
        )
        res = network_client.create_public_ip(create_details).data
        return res.ip_address

def main():
    cfg = load_config()

    print("==================================================================")
    print(" 🚀 Share2Me — OCI Always Free ARM Autonomous Claimer")
    print(f" Region:               {cfg['region']}")
    print(f" Availability Domain:  {cfg['availability_domain']}")
    print(f" Shape:                {cfg['shape']} ({cfg['ocpus']} OCPUs, {cfg['memory_in_gbs']} GB RAM)")
    print(f" Polling Interval:     {cfg['poll_interval_seconds']} seconds")
    print("==================================================================\n")

    # Initialize OCI Config Dict
    oci_config = {
        "user": cfg["user"],
        "key_file": cfg["key_file"],
        "fingerprint": cfg["fingerprint"],
        "tenancy": cfg["tenancy"],
        "region": cfg["region"]
    }
    oci.config.validate_config(oci_config)

    # Initialize Clients
    compute_client = oci.core.ComputeClient(oci_config)
    network_client = oci.core.VirtualNetworkClient(oci_config)

    # Pre-check: Is instance already running?
    print("[*] Verifying existing instances in tenancy...")
    existing = check_existing_instance(compute_client, cfg["tenancy"], cfg["display_name"])
    if existing:
        print(f"\n🎉 [INFO] Instance '{cfg['display_name']}' is already {existing.lifecycle_state}!")
        print(f"   Instance OCID: {existing.id}")
        sys.exit(0)

    # Prepare Cloud-Init & Launch Details
    user_data_b64 = get_cloud_init_script(cfg["ssh_public_key"])

    shape_config = oci.core.models.LaunchInstanceShapeConfigDetails(
        ocpus=float(cfg["ocpus"]),
        memory_in_gbs=float(cfg["memory_in_gbs"])
    )

    source_details = oci.core.models.InstanceSourceViaImageDetails(
        source_type="image",
        image_id=cfg["image_id"],
        boot_volume_size_in_gbs=int(cfg["boot_volume_size_in_gbs"])
    )

    create_vnic_details = oci.core.models.CreateVnicDetails(
        subnet_id=cfg["subnet_id"],
        assign_public_ip=False,  # Bound to static Reserved IP upon launch
        display_name="share2me-primary-vnic",
        hostname_label="share2me",
        nsg_ids=cfg["nsg_ids"]
    )

    metadata = {
        "ssh_authorized_keys": cfg["ssh_public_key"],
        "user_data": user_data_b64
    }

    fault_domains = ["FAULT-DOMAIN-1", "FAULT-DOMAIN-2", "FAULT-DOMAIN-3", None]
    attempt = 1
    poll_interval = cfg.get("poll_interval_seconds", 5)

    print("[*] Starting capacity claim loop. Press Ctrl+C to stop.\n")

    while True:
        fd = fault_domains[(attempt - 1) % len(fault_domains)]
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        fd_label = fd if fd else "Auto-Select"

        print(f"[{now}] [Attempt #{attempt}] Requesting capacity (Fault Domain: {fd_label})...", end="", flush=True)

        launch_details = oci.core.models.LaunchInstanceDetails(
            compartment_id=cfg["tenancy"],
            availability_domain=cfg["availability_domain"],
            display_name=cfg["display_name"],
            shape=cfg["shape"],
            shape_config=shape_config,
            source_details=source_details,
            create_vnic_details=create_vnic_details,
            metadata=metadata,
            fault_domain=fd
        )

        try:
            start_t = time.time()
            resp = compute_client.launch_instance(launch_details)
            duration = round(time.time() - start_t, 2)
            instance = resp.data

            print(f"\n\n==================================================================")
            print(f" 🎉🎉🎉 [SUCCESS] ARM CAPACITY CLAIMED AT {now}! ({duration}s) 🎉🎉🎉")
            print(f" Instance OCID:  {instance.id}")
            print(f" Lifecycle:     {instance.lifecycle_state}")
            print("==================================================================")

            # Automatically bind Reserved Static Public IP
            public_ip = bind_reserved_public_ip(compute_client, network_client, cfg["tenancy"], instance.id)
            
            # Save details file
            details = {
                "instance_id": instance.id,
                "display_name": instance.display_name,
                "public_ip": public_ip,
                "claimed_at": now,
                "ssh_command": f"ssh ubuntu@{public_ip}" if public_ip else "N/A"
            }
            with open(os.path.join(SCRIPT_DIR, "instance_details.json"), "w", encoding="utf-8") as out_f:
                json.dump(details, out_f, indent=2)

            print(f"\n✅ Server successfully provisioned and reserved!")
            if public_ip:
                print(f"   Permanent Public IP: {public_ip}")
                print(f"   Connect via SSH:     ssh ubuntu@{public_ip}")
            print(f"\nSaved summary to: {os.path.join(SCRIPT_DIR, 'instance_details.json')}\a\n")
            break

        except oci.exceptions.ServiceError as e:
            if e.status == 500 or "Out of host capacity" in str(e.message):
                print(" -> Pool full (retrying...)")
                time.sleep(poll_interval)
            elif e.status == 429 or "TooManyRequests" in str(e.message):
                print(" -> ⚠️ Rate limit (429). Pausing 25s...")
                time.sleep(25)
            else:
                print(f" -> ServiceError ({e.status}): {e.message}")
                time.sleep(poll_interval)

        except Exception as e:
            print(f" -> Network/Client error: {e}. Retrying in {poll_interval}s...")
            time.sleep(poll_interval)

        attempt += 1

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[!] Stopped by user. Exiting cleanly.")
        sys.exit(0)

