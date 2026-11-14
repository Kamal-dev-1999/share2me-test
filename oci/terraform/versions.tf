# ─── Terraform & Provider Requirements ─────────────────────────────────────────
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 5.0.0, < 7.0.0"
    }
  }
}

# ─── OCI Provider Configuration ───────────────────────────────────────────────
provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = abspath("${path.module}/oci_api_key.pem")
  region           = var.region
}

