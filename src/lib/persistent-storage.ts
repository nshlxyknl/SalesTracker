export type StoragePersistenceState = {
  supported: boolean;
  persisted: boolean;
  quotaBytes: number | null;
  usageBytes: number | null;
};

/**
 * Request persistent storage so IndexedDB / cache data is less likely to be evicted.
 * Must run from a user gesture on some browsers; we also try on first app load.
 */
export async function requestPersistentStorage(): Promise<StoragePersistenceState> {
  if (typeof navigator === "undefined") {
    return { supported: false, persisted: false, quotaBytes: null, usageBytes: null };
  }

  let persisted = false;
  const storage = navigator.storage;

  if (storage?.persist) {
    try {
      persisted = await storage.persist();
    } catch (err) {
      console.warn("[Storage] persist() failed:", err);
    }
  }

  let quotaBytes: number | null = null;
  let usageBytes: number | null = null;

  if (storage?.estimate) {
    try {
      const estimate = await storage.estimate();
      quotaBytes = estimate.quota ?? null;
      usageBytes = estimate.usage ?? null;
    } catch (err) {
      console.warn("[Storage] estimate() failed:", err);
    }
  }

  return {
    supported: Boolean(storage?.persist),
    persisted,
    quotaBytes,
    usageBytes,
  };
}

export function formatStorageBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
