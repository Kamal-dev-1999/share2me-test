# Share2Me — OCI Always Free ARM Instance Fleet

> **Status:** Active & Claimed (100% Always Free Capacity Utilized)  
> **Region:** `ap-mumbai-1` (AD-1: `UVsX:AP-MUMBAI-1-AD-1`)  
> **Tenancy Limit:** 4 OCPUs, 24 GB RAM, 200 GB Storage (Lifetime Free)

---

## Instance Overview

| Property | Instance 1 (Edge & Frontend) | Instance 2 (Core Backend & Signaling) |
|---|---|---|
| **Display Name** | `share2me-server-prod` | `share2me-server-prod-2` |
| **Hostname** | `share2me` | `share2me-2` |
| **Static Reserved Public IP** | **`130.210.22.28`** | **`137.23.62.66`** (Secured; Port 8000 blocked) |
| **Private VCN IP** | **`10.0.1.107`** | **`10.0.1.218`** |
| **Reserved IP Name** | `share2me-reserved-ip` | `share2me-server-prod-2-ip` |
| **OCID** | `ocid1.instance.oc1.ap-mumbai-1.anrg6ljr3o37s6qcrjyudfhrz7v7isyxi42x5x3mgyb2upkwb7cfxgh6cbna` | `ocid1.instance.oc1.ap-mumbai-1.anrg6ljr3o37s6qcys6mcwfvlw2hp5d6t7wdfy2femazt2n3vxfdv54ypgcq` |
| **Shape** | `VM.Standard.A1.Flex` | `VM.Standard.A1.Flex` |
| **OCPUs** | 2 OCPUs (4 vCPUs Neoverse-N1) | 2 OCPUs (4 vCPUs Neoverse-N1) |
| **Memory** | 12 GB RAM | 12 GB RAM |
| **Boot Volume** | 100 GB (Balanced performance) | 100 GB (Balanced performance) |
| **OS** | Ubuntu 24.04 LTS (aarch64) | Ubuntu 24.04 LTS (aarch64) |
| **Claimed At** | 2026-11-13 19:42 UTC | 2026-11-14 20:00:21 UTC |
| **Active Workload** | Caddy Edge Reverse Proxy + Next.js Frontend | Express REST API + WebRTC Socket.io + Redis 7 |
| **SSH Command** | `ssh -i ~/.ssh/id_ed25519 ubuntu@130.210.22.28` | `ssh -i ~/.ssh/id_ed25519 ubuntu@137.23.62.66` |

---

## Tenancy Resource Utilization

- **Total OCPUs:** 4 / 4 (100% Always Free quota)
- **Total RAM:** 24 GB / 24 GB (100% Always Free quota)
- **Total Boot Volume:** 200 GB / 200 GB (100% Always Free quota)
- **Autonomous Claimer:** Stopped and disabled on GCP VM (`oci-claimer-vm`).
