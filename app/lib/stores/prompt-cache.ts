import { map, type MapStore } from 'nanostores';

interface CacheEntry {
  enhancedPrompt: string;
  timestamp: number;
}

type PromptCache = MapStore<Record<string, CacheEntry>>;

class PromptCacheStore {
  // Cache entries expire after 24 hours
  private static CACHE_TTL = 24 * 60 * 60 * 1000;
  
  cache: PromptCache = map({});

  getEnhancedPrompt(originalPrompt: string): string | null {
    const entry = this.cache.get()[originalPrompt];
    if (!entry) return null;

    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > PromptCacheStore.CACHE_TTL) {
      this.removeFromCache(originalPrompt);
      return null;
    }

    return entry.enhancedPrompt;
  }

  addToCache(originalPrompt: string, enhancedPrompt: string) {
    this.cache.setKey(originalPrompt, {
      enhancedPrompt,
      timestamp: Date.now(),
    });
  }

  removeFromCache(originalPrompt: string) {
    const entries = this.cache.get();
    delete entries[originalPrompt];
    this.cache.set(entries);
  }

  clearExpiredEntries() {
    const entries = this.cache.get();
    const now = Date.now();

    Object.entries(entries).forEach(([prompt, entry]) => {
      if (now - entry.timestamp > PromptCacheStore.CACHE_TTL) {
        this.removeFromCache(prompt);
      }
    });
  }
}

export const promptCacheStore = new PromptCacheStore();
