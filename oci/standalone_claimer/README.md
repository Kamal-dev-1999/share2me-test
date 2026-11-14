# Share2Me — OCI Standalone Autonomous Instance Claimer

A self-contained Python script to automatically claim and reserve the **Always Free Ampere ARM instance** (`VM.Standard.A1.Flex` with 2 OCPUs, 12 GB RAM, 100 GB Boot Volume) in Oracle Cloud Infrastructure (Mumbai / `ap-mumbai-1`).

---

## What it Does Autonomously

1. **Continuous Polling:** Makes direct OCI API calls every 5 seconds to claim an ARM instance slot.
2. **Fault Domain Cycling:** Rotates across all 3 Fault Domains in Mumbai to grab any slot freed up by other users.
3. **Automatic Static IP Allocation:** The exact second the VM is created, it allocates and binds your **permanent Reserved Static Public IP** (`share2me-reserved-ip`).
4. **Automated Server Configuration:** Injects the full production cloud-init payload so Docker, Caddy, 4GB swap, UFW firewall, and `.env` files are configured immediately on first boot.
5. **Saves Connection Info:** Outputs the Public IP and generates `instance_details.json`.

---

## How to Run on Another Device (Linux / Mac / Windows / Raspberry Pi)

This folder is **100% self-contained**:
* `claimer.py` — The core Python script
* `config.json` — Pre-filled with your OCI Tenancy, User OCID, Subnet OCID, and SSH Key
* `oci_api_key.pem` — Your OCI API Private Key
* `run.sh` / `run.bat` — One-click launcher scripts

### Option A: On Another Windows Laptop / PC
1. Copy the `standalone_claimer` folder to the other machine.
2. Double-click `run.bat` (or open cmd/PowerShell in this folder and run `python claimer.py`).

### Option B: On a Linux Server, VPS, or Raspberry Pi
1. Copy the `standalone_claimer` folder to the Linux device:
   ```bash
   scp -r standalone_claimer user@remote-ip:~/
   ```
2. SSH into the device and enter the folder:
   ```bash
   cd standalone_claimer
   chmod +x run.sh
   chmod 600 oci_api_key.pem
   ```
3. Run in the background using `screen` or `nohup` so it keeps running even if you close your terminal:
   ```bash
   # Using screen:
   screen -S oci-claim
   ./run.sh

   # Detach with: Ctrl + A then D
   # Re-attach anytime with: screen -r oci-claim
   ```
   *Or with nohup:*
   ```bash
   nohup python3 claimer.py > claimer.log 2>&1 &
   tail -f claimer.log
   ```

### Option C: On a Mac
1. Open Terminal in the `standalone_claimer` folder.
2. Run:
   ```bash
   chmod +x run.sh
   chmod 600 oci_api_key.pem
   ./run.sh
   ```

---

## Once Claimed

When capacity is granted, the script will output:
```
==================================================================
 🎉🎉🎉 [SUCCESS] ARM CAPACITY CLAIMED AT 2026-11-13 23:15:00! 🎉🎉🎉
 Instance OCID:  ocid1.instance.oc1.ap-mumbai-1...
 Lifecycle:     PROVISIONING
==================================================================
[*] Found VNIC Private IP ID: ocid1.privateip...
[*] Allocating permanent Reserved Static Public IP...
✅ Server successfully provisioned and reserved!
   Permanent Public IP: 129.154.xx.xx
   Connect via SSH:     ssh ubuntu@129.154.xx.xx
```

And it writes `instance_details.json` so you can connect from your main laptop immediately!

