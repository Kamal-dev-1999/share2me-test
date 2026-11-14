# ─── Virtual Cloud Network (VCN) ───────────────────────────────────────────────
resource "oci_core_vcn" "main" {
  compartment_id = var.tenancy_ocid
  cidr_blocks    = [var.vcn_cidr]
  display_name   = "${var.project_name}-vcn-${var.environment}"
  dns_label      = "share2me"

  freeform_tags = {
    "Project"     = var.project_name
    "Environment" = var.environment
    "ManagedBy"   = "Terraform"
  }
}

# ─── Internet Gateway ────────────────────────────────────────────────────────
resource "oci_core_internet_gateway" "igw" {
  compartment_id = var.tenancy_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.project_name}-igw"
  enabled        = true

  freeform_tags = {
    "Project"     = var.project_name
    "Environment" = var.environment
    "ManagedBy"   = "Terraform"
  }
}

# ─── Route Table (Route all internet egress to IGW) ───────────────────────────
resource "oci_core_route_table" "public" {
  compartment_id = var.tenancy_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.project_name}-public-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.igw.id
    description       = "Default internet gateway route for public subnet"
  }

  freeform_tags = {
    "Project"     = var.project_name
    "Environment" = var.environment
    "ManagedBy"   = "Terraform"
  }
}

# ─── Default Security List (Baseline Lockdown) ────────────────────────────────
# Deny all inbound traffic by default except explicit egress.
# All ingress rules are handled granularly by the Network Security Group (NSG) below.
resource "oci_core_default_security_list" "default" {
  manage_default_resource_id = oci_core_vcn.main.default_security_list_id
  display_name               = "${var.project_name}-default-sec-list-locked"

  # Outbound: Allow all outbound connections (required for package updates, external APIs: Supabase, Stripe, Gemini)
  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
    stateless   = false
    description = "Allow all outbound internet egress"
  }

  freeform_tags = {
    "Project"     = var.project_name
    "Environment" = var.environment
    "ManagedBy"   = "Terraform"
  }
}

# ─── Network Security Group (NSG) — Strict Ingress Defense ───────────────────
# OCI Best Practice: Network Security Groups apply directly to the VNIC,
# isolating security enforcement from subnet topology.
resource "oci_core_network_security_group" "edge_proxy" {
  compartment_id = var.tenancy_ocid
  vcn_id         = oci_core_vcn.main.id
  display_name   = "${var.project_name}-edge-nsg"

  freeform_tags = {
    "Project"     = var.project_name
    "Environment" = var.environment
    "ManagedBy"   = "Terraform"
  }
}

# 1. Allow HTTP (Port 80) — Required for ACME Let's Encrypt TLS verification & HTTP->HTTPS redirect
resource "oci_core_network_security_group_security_rule" "allow_http" {
  network_security_group_id = oci_core_network_security_group.edge_proxy.id
  direction                 = "INGRESS"
  protocol                  = "6" # TCP
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  stateless                 = false
  description               = "Allow HTTP for ACME challenge & HTTPS redirect"

  tcp_options {
    destination_port_range {
      min = 80
      max = 80
    }
  }
}

# 2. Allow HTTPS (Port 443) — Public Web, WebRTC signaling, WebSocket & APIs
resource "oci_core_network_security_group_security_rule" "allow_https" {
  network_security_group_id = oci_core_network_security_group.edge_proxy.id
  direction                 = "INGRESS"
  protocol                  = "6" # TCP
  source                    = "0.0.0.0/0"
  source_type               = "CIDR_BLOCK"
  stateless                 = false
  description               = "Allow HTTPS public traffic & WebSocket"

  tcp_options {
    destination_port_range {
      min = 443
      max = 443
    }
  }
}

# 3. Allow SSH (Port 22) — Restricted to authorized CIDRs (Key-based only)
resource "oci_core_network_security_group_security_rule" "allow_ssh" {
  for_each = toset(var.ssh_allowed_cidrs)

  network_security_group_id = oci_core_network_security_group.edge_proxy.id
  direction                 = "INGRESS"
  protocol                  = "6" # TCP
  source                    = each.value
  source_type               = "CIDR_BLOCK"
  stateless                 = false
  description               = "Allow SSH from authorized CIDR: ${each.value}"

  tcp_options {
    destination_port_range {
      min = 22
      max = 22
    }
  }
}

# NOTE ON SECURITY:
# Ports 3000 (Next.js), 8000 (Express/Socket.io), 5000 (AI microservice),
# and 6379 (Redis) have NO INGRESS RULES in this NSG or anywhere in OCI.
# They are strictly isolated to localhost and the private Docker bridge network.

# ─── Public Subnet ───────────────────────────────────────────────────────────
resource "oci_core_subnet" "public" {
  compartment_id             = var.tenancy_ocid
  vcn_id                     = oci_core_vcn.main.id
  cidr_block                 = var.public_subnet_cidr
  display_name               = "${var.project_name}-public-subnet"
  dns_label                  = "public"
  route_table_id             = oci_core_route_table.public.id
  security_list_ids          = [oci_core_default_security_list.default.id]
  prohibit_public_ip_on_vnic = false # Allows attaching the Reserved Public IP to the edge instance

  freeform_tags = {
    "Project"     = var.project_name
    "Environment" = var.environment
    "ManagedBy"   = "Terraform"
  }
}

