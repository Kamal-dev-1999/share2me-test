# ─── VPC Network ──────────────────────────────────────────────────────────────
# Cloud Run is serverless, but Memorystore Redis requires a VPC.
# The Serverless VPC Access connector bridges Cloud Run → private VPC.

resource "google_compute_network" "main" {
  name                    = "${var.project_name}-vpc"
  auto_create_subnetworks = false
  project                 = var.gcp_project_id

  depends_on = [google_project_service.required_apis]
}

# ─── Subnet for Redis & Internal Services ─────────────────────────────────────
resource "google_compute_subnetwork" "private" {
  name          = "${var.project_name}-private-subnet"
  ip_cidr_range = var.vpc_cidr
  region        = var.gcp_region
  network       = google_compute_network.main.id
  project       = var.gcp_project_id

  private_ip_google_access = true # Allow private access to Google APIs
}

# ─── Serverless VPC Access Connector ──────────────────────────────────────────
# Bridges Cloud Run containers into the VPC so they can reach Redis.
# Uses a /28 CIDR range (16 IPs). Scales e2-micro instances automatically.
#
# ⚠️ This connector has a minimum throughput of 200 Mbps and max of 1000 Mbps.
# Cost: ~$6/month for the connector instances (2× e2-micro).

resource "google_vpc_access_connector" "main" {
  name    = "${var.project_name}-vpc-conn"
  region  = var.gcp_region
  project = var.gcp_project_id

  subnet {
    name       = google_compute_subnetwork.private.name
    project_id = var.gcp_project_id
  }

  # Minimum throughput — saves cost. Scale up if WebSocket traffic grows.
  min_throughput = 200
  max_throughput = 300

  depends_on = [google_project_service.required_apis]
}

# ─── Firewall: Allow Cloud Run → Redis ────────────────────────────────────────
# The VPC connector's IP range needs access to Redis port 6379.

resource "google_compute_firewall" "allow_redis" {
  name    = "${var.project_name}-allow-redis"
  network = google_compute_network.main.name
  project = var.gcp_project_id

  allow {
    protocol = "tcp"
    ports    = ["6379"]
  }

  # Source: VPC connector subnet IP range
  source_ranges = [var.vpc_connector_cidr]

  # Target: all instances in the network (Redis is Memorystore, but the rule
  # ensures no other firewall blocks the connector)
  target_tags = ["redis"]

  direction = "INGRESS"
}

# ─── Firewall: Deny all other ingress ─────────────────────────────────────────
# Defense-in-depth: block everything except what's explicitly allowed.

resource "google_compute_firewall" "deny_all_ingress" {
  name     = "${var.project_name}-deny-all-ingress"
  network  = google_compute_network.main.name
  project  = var.gcp_project_id
  priority = 65534 # Low priority — allows higher-priority rules to take precedence

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
  direction     = "INGRESS"
}

# ─── Cloud Router + NAT ──────────────────────────────────────────────────────
# Cloud NAT allows VPC connector instances (which are private) to reach the
# internet for outbound requests (e.g., Stripe API, Metered TURN, npm).

resource "google_compute_router" "main" {
  name    = "${var.project_name}-router"
  region  = var.gcp_region
  network = google_compute_network.main.id
  project = var.gcp_project_id
}

resource "google_compute_router_nat" "main" {
  name                               = "${var.project_name}-nat"
  router                             = google_compute_router.main.name
  region                             = var.gcp_region
  project                            = var.gcp_project_id
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
