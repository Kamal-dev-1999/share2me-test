class RateLimiter {
  constructor(windowMs, maxRequests) {
    this.windowMs    = windowMs;
    this.maxRequests = maxRequests;
    this.buckets     = new Map();
  }
  isRateLimited(key) {
    const now = Date.now();
    const b   = this.buckets.get(key);
    if (!b || now >= b.resetAt) { this.buckets.set(key, { count: 1, resetAt: now + this.windowMs }); return false; }
    if (b.count >= this.maxRequests) return true;
    b.count++;
    return false;
  }
  prune() {
    const now = Date.now();
    for (const [k, b] of this.buckets.entries()) if (now >= b.resetAt) this.buckets.delete(k);
  }
}

module.exports = RateLimiter;
