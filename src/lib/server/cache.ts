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
