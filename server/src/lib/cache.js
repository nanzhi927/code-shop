function createCache(ttlMs, maxEntries = 200) {
  const store = new Map();

  function pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
  }

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key, val) {
      store.set(key, { value: val, expiresAt: Date.now() + ttlMs });
      if (store.size > maxEntries) {
        pruneExpired();
        while (store.size > maxEntries) {
          const first = store.keys().next().value;
          if (first === undefined) break;
          store.delete(first);
        }
      }
    },
    has(key) {
      return this.get(key) !== null;
    },
    del(key) {
      store.delete(key);
    }
  };
}

module.exports = { createCache };
