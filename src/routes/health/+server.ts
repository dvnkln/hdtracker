import { sql } from 'drizzle-orm';
import { getDb } from '#lib/server/db/index.js';
import type { RequestHandler } from './$types';

// Used by the Docker healthcheck. Returns 503 if the database is not reachable.
export const GET: RequestHandler = () => {
	try {
		getDb().get(sql`select 1`);
		return Response.json({ status: 'ok' });
	} catch (err) {
		console.error('Health check failed', err);
		return Response.json({ status: 'error' }, { status: 503 });
	}
};
