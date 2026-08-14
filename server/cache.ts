/**
 * Simple in-memory cache with TTL support
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class InMemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 3600000) { // Default 1 hour
    this.defaultTTL = defaultTTL;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Get a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 [CACHE] Cleaned up ${cleaned} expired entries`);
    }
  }
}
