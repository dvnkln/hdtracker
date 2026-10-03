import type { RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { connectionOf } from './auth';
import { imageStats } from './images';
import { countByCategory } from './library';
import { isHttps } from './origins';
import { pendingStatus } from './releases';
import { listBackups } from './tasks/backups';
import { databaseSize, listTasks } from './tasks/scheduler';

// The overview on Settings → Server: a few checks that tell the admin whether everything is
// fine. 'ok' = fine, 'hint' = worth knowing, 'action' = something should be done.
export type Level = 'ok' | 'hint' | 'action';
export type CheckKey = 'https' | 'proxy' | 'sources' | 'tasks' | 'library';
// `count`/`names` fill in the text of a check (e.g. how many tasks failed, which keys are missing).
export type Check = { key: CheckKey; level: Level; count?: number; names?: string[] };

export type Facts = {
	https: boolean;
	connection: { forwarded: string | null; via: 'address' | 'key' | null; hidden: boolean };
	missingKeys: string[];
	failedTasks: number;
	pendingItems: number;
};

// The rules, separate from where the facts come from (so they can be tested).
export function evaluate(facts: Facts): Check[] {
	const { connection: c } = facts;
	const viaProxy = c.forwarded !== null;
	return [
		{ key: 'https', level: facts.https ? 'ok' : 'hint' },
		{
			key: 'proxy',
			// Unconfirmed proxy: can be fixed. Direct visitors sharing one address: just a note.
			level: viaProxy ? (c.via ? 'ok' : 'action') : c.hidden ? 'hint' : 'ok'
		},
		{
			key: 'sources',
			level: facts.missingKeys.length ? 'action' : 'ok',
			names: facts.missingKeys
		},
		{ key: 'tasks', level: facts.failedTasks ? 'action' : 'ok', count: facts.failedTasks },
		{ key: 'library', level: facts.pendingItems ? 'hint' : 'ok', count: facts.pendingItems }
	];
}

export async function serverOverview(event: RequestEvent) {
	const missingKeys = [
		!env.TMDB_API_TOKEN && 'TMDB',
		(!env.IGDB_CLIENT_ID || !env.IGDB_CLIENT_SECRET) && 'IGDB'
	].filter((name) => typeof name === 'string');
	const checks = evaluate({
		https: isHttps(event.request, event.url),
		connection: connectionOf(event),
		missingKeys,
		failedTasks: listTasks().filter((t) => t.enabled && t.lastError).length,
		pendingItems: pendingStatus().pending
	});
	const images = await imageStats();
	const backups = listBackups().reduce((sum, b) => sum + b.size, 0);
	return {
		checks,
		info: {
			startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
			titles: Object.values(countByCategory()).reduce((sum, n) => sum + n, 0),
			bytes: databaseSize() + images.bytes + backups
		}
	};
}
