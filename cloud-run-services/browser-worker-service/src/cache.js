export class TtlCache {
  constructor(defaultTtlMs = 120000) {
    this.defaultTtlMs = defaultTtlMs;
    this.data = new Map();
  }

  get(key) {
    const item = this.data.get(key);
    if (!item) return null;
    if (item.expiresAt <= Date.now()) {
      this.data.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    this.data.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.data.entries()) {
      if (value.expiresAt <= now) {
        this.data.delete(key);
      }
    }
  }
}
