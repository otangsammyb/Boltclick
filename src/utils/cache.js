const { LRUCache } = require('lru-cache');

// Store up to 500 images (approx ~50MB RAM assuming 100KB per image)
const fileCache = new LRUCache({
  max: 500,
  maxSize: 50 * 1024 * 1024, // 50MB
  sizeCalculation: (value, key) => value.buffer.length,
  ttl: 1000 * 60 * 60 * 24 // 24 hour TTL
});

module.exports = fileCache;
