import { exportYamtrack } from '#lib/server/export/yamtrack.js';
import { today } from '#lib/server/providers/types.js';
import type { RequestHandler } from './$types';

// Download of the user's whole library as a Yamtrack-compatible CSV file (only for logged-in users,
// see hooks.server.ts).
export const GET: RequestHandler = ({ locals }) =>
	new Response(exportYamtrack(locals.user!.id), {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="hdtracker-${today()}.csv"`,
			'Cache-Control': 'no-store'
		}
	});
