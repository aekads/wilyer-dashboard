// utils/rateLimitStores.js
const stores = new Map();

const getStore = (tier) => {
  if (!stores.has(tier)) {
    stores.set(tier, new Map());
  }
  return stores.get(tier);
};

const cleanupStores = () => {
  const now = Date.now();
  for (const [tier, store] of stores) {
    for (const [key, record] of store) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
    if (store.size === 0) {
      stores.delete(tier);
    }
  }
};

// Run cleanup every minute
setInterval(cleanupStores, 60000);

module.exports = { getStore, cleanupStores, stores };