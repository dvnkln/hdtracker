import { zstdDecompressSync } from 'node:zlib';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { animeTmdbMap } from './db/schema';
import { enabledCategories, getSetting, setSettings } from './settings';

// Episode titles for anime come from TMDB, but AniList (our source for anime) has one entry per
// season while TMDB has one show with seasons. Which TMDB season and episodes belong to an
// AniList entry is taken from the community list "anibridge-mappings" (MIT licence,
// https://github.com/anibridge/anibridge-mappings). The whole list is downloaded once a week –
// the download says nothing about the library – and only its AniList → TMDB part is kept.
export const MAPPING_URL =
	'https://github.com/anibridge/anibridge-mappings/releases/download/v3/mappings.json.zst';

const DAY = 24 * 60 * 60 * 1000;
const KEEP_MS = 7 * DAY;
const RETRY_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 60_000;

export function animeTitlesEnabled() {
	return getSetting('animeEpisodeTitles') === 'on' && enabledCategories().includes('anime');
}

// ---- Episode ranges ----

export type MapRow = { tmdbId: number; season: number; sourceRange: string; targetRange: string };
type Range = { from: number; to: number | null };

// "1-23", "14-" (open end) or "7" (single episode). Lists with gaps ("1-6,8-13") and ratios
// ("14-|2") are not supported: null.
export function parseRange(text: string): Range | null {
	const match = /^(\d+)(-(\d*))?$/.exec(text.trim());
	if (!match) return null;
	const from = Number(match[1]);
	const to = match[2] === undefined ? from : match[3] ? Number(match[3]) : null;
	return from >= 1 && (to === null || to >= from) ? { from, to } : null;
}

// Where an episode of the AniList entry can be found at TMDB. The list sometimes offers several
// places for the same episode (not all of them exist at TMDB): all are returned, in the order
// of the list.
export function tmdbEpisodesFor(rows: MapRow[], episode: number) {
	const places: { tmdbId: number; season: number; episode: number }[] = [];
	for (const row of rows) {
		const source = parseRange(row.sourceRange);
		const target = parseRange(row.targetRange);
		if (!source || !target) continue;
		if (episode < source.from || (source.to !== null && episode > source.to)) continue;
		const mapped = target.from + (episode - source.from);
		if (target.to !== null && mapped > target.to) continue;
		places.push({ tmdbId: row.tmdbId, season: row.season, episode: mapped });
	}
	return places;
}

export function mappingFor(anilistId: string): MapRow[] {
	const id = Number(anilistId);
	if (!Number.isInteger(id)) return [];
	return getDb().select().from(animeTmdbMap).where(eq(animeTmdbMap.anilistId, id)).all();
}

// ---- Download ----

type MappingFile = Record<string, Record<string, Record<string, string>>>;

// The AniList → TMDB show rows of the list, e.g. "anilist:145064" → "tmdb_show:95479:s1".
export function rowsOf(file: MappingFile) {
	const rows: (MapRow & { anilistId: number })[] = [];
	for (const [source, targets] of Object.entries(file)) {
		const anilist = /^anilist:(\d+)$/.exec(source);
		if (!anilist || typeof targets !== 'object' || targets === null) continue;
		for (const [target, ranges] of Object.entries(targets)) {
			const show = /^tmdb_show:(\d+):s(\d+)$/.exec(target);
			if (!show || typeof ranges !== 'object' || ranges === null) continue;
			for (const [sourceRange, targetRange] of Object.entries(ranges)) {
				if (typeof targetRange !== 'string') continue;
				rows.push({
					anilistId: Number(anilist[1]),
					tmdbId: Number(show[1]),
					season: Number(show[2]),
					sourceRange,
					targetRange
				});
			}
		}
	}
	return rows;
}

// Downloads the list and replaces the stored copy. Throws if anything goes wrong – the old
// copy then stays as it is.
export async function updateAnimeMapping() {
	const res = await fetch(MAPPING_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	if (!res.ok) throw new Error(`anime mapping list: HTTP ${res.status}`);
	const text = zstdDecompressSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
	const rows = rowsOf(JSON.parse(text) as MappingFile);
	if (rows.length === 0) throw new Error('anime mapping list: no AniList → TMDB entries found');

	getDb().transaction((tx) => {
		tx.delete(animeTmdbMap).run();
		for (let i = 0; i < rows.length; i += 500) {
			tx.insert(animeTmdbMap)
				.values(rows.slice(i, i + 500))
				.run();
		}
	});
	setSettings({ animeMappingAt: new Date().toISOString() });
	return rows.length;
}

let lastAttempt = 0;

// Makes sure a list not older than a week is there – called before anime are refreshed. Never
// throws: without the list, anime simply have no episode titles. After a failed download the
// next try is an hour later.
export async function ensureAnimeMapping() {
	if (!animeTitlesEnabled()) return;
	const last = Date.parse(getSetting('animeMappingAt'));
	if (Number.isFinite(last) && Date.now() - last < KEEP_MS) return;
	if (Date.now() - lastAttempt < RETRY_MS) return;
	lastAttempt = Date.now();
	try {
		const count = await updateAnimeMapping();
		console.log(`Anime mapping list updated (${count} entries)`);
	} catch (err) {
		console.error('Updating the anime mapping list failed', err);
	}
}
