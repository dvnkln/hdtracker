// Starts the built app. ORIGIN in .env may list several addresses, comma-separated. adapter-node
// (since version 6) no longer reads ORIGIN at all – it would want the address written into the
// build, and the Docker image is the same for everybody. Our own checks in hooks.server.ts
// (origins.ts) read the list from HDTRACKER_ORIGINS: allowed form posts, https cookies.
const origins = (process.env.ORIGIN ?? '')
	.split(',')
	.map((o) => o.trim().replace(/\/+$/, ''))
	.filter(Boolean);

process.env.HDTRACKER_ORIGINS = origins.join(',');

// Uploads (Yamtrack import) may be larger than adapter-node's default of 512 KB.
process.env.BODY_SIZE_LIMIT ??= '20M';

await import('./build/index.js');
