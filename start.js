// Starts the built app. ORIGIN in .env may list several addresses, comma-separated:
// adapter-node only supports one, so it gets the first; the full list is checked in hooks.server.ts.
const origins = (process.env.ORIGIN ?? '')
	.split(',')
	.map((o) => o.trim().replace(/\/+$/, ''))
	.filter(Boolean);

process.env.HDTRACKER_ORIGINS = origins.join(',');
if (origins.length) process.env.ORIGIN = origins[0];
else delete process.env.ORIGIN;

await import('./build/index.js');
