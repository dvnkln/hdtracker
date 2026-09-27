import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BACKUP_DIR, isBackupName } from '$lib/server/tasks/backups';
import type { RequestHandler } from './$types';

// Download of a backup file (only for the logged-in user, see hooks.server.ts).
export const GET: RequestHandler = async ({ params }) => {
	if (!isBackupName(params.name)) error(404);
	let file: Buffer;
	try {
		file = await readFile(join(BACKUP_DIR, params.name));
	} catch {
		error(404);
	}
	return new Response(new Uint8Array(file), {
		headers: {
			'Content-Type': 'application/vnd.sqlite3',
			'Content-Disposition': `attachment; filename="${params.name}"`,
			'Content-Length': String(file.length)
		}
	});
};
