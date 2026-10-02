import { exportYamtrack } from '$lib/server/export/yamtrack';
import { today } from '$lib/server/providers/types';
import type { RequestHandler } from './$types';

// Download of the whole library as a Yamtrack-compatible CSV file (only for logged-in users,
// see hooks.server.ts).
export const GET: RequestHandler = () =>
	new Response(exportYamtrack(), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="hdtracker-${today()}.csv"`,
			'Cache-Control': 'no-store'
		}
	});
