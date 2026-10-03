// Tiny in-memory cache for API responses. Lost on restart, which is fine.
const entries = new Map<string, { expires: number; value: Promise<unknown> }>();

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
	const hit = entries.get(key);
	if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;

	const value = load();
	entries.set(key, { expires: Date.now() + ttlMs, value });
	// Do not keep failed requests in the cache.
	value.catch(() => entries.delete(key));
	return value;
}

// Stores a value that was loaded another way (e.g. many titles in one request).
export function remember<T>(key: string, ttlMs: number, value: T) {
	entries.set(key, { expires: Date.now() + ttlMs, value: Promise.resolve(value) });
}

// Removes expired entries. Returns how many were removed.
export function pruneCache() {
	let removed = 0;
	for (const [key, entry] of entries) {
		if (entry.expires <= Date.now()) {
			entries.delete(key);
			removed++;
		}
	}
	return removed;
}
