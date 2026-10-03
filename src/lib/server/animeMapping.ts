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

// Raised whenever the way the list is read changes: a stored list of an older version is
// downloaded again at once, and the anime of the library are loaded again (see
// prepareAnimeTitles in releases.ts).
export const MAPPING_VERSION = '4';

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

const text = (range: Range) =>
	range.to === range.from ? String(range.from) : `${range.from}-${range.to ?? ''}`;

// Two steps in one: episodes `first` of A are episodes `via` of B, and episodes `from` of B
// are episodes `to` of C – which episodes of A are which of C? Null if the two do not meet or
// a range is not supported.
export function composeRanges(first: string, via: string, from: string, to: string) {
	const [a, b1, b2, c] = [first, via, from, to].map(parseRange);
	if (!a || !b1 || !b2 || !c) return null;
	// Everything in the numbering of B. A range is as long as the shorter of its two sides.
	const end = (x: Range, y: Range, start: number) =>
		Math.min(x.to ?? Infinity, y.to === null ? Infinity : start + (y.to - y.from));
	const low = Math.max(b1.from, b2.from);
	const high = Math.min(end(b1, a, b1.from), end(b2, c, b2.from));
	if (low > high) return null;
	const shifted = (by: number): Range => ({
		from: low + by,
		to: high === Infinity ? null : high + by
	});
	return {
		sourceRange: text(shifted(a.from - b1.from)),
		targetRange: text(shifted(c.from - b2.from))
	};
}

const TMDB_SHOW = /^tmdb_show:(\d+):s(\d+)$/;
const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

// The AniList → TMDB show rows of the list, e.g. "anilist:145064" → "tmdb_show:95479:s1".
// Many entries only name the season at TVDB, and the list knows the TMDB season of that one
// ("anilist:171018" → "tvdb_show:432832:s1" → "tmdb_show:240411:s1"): for anime without a
// direct TMDB entry, the two steps are put together.
export function rowsOf(file: MappingFile) {
	const rows: (MapRow & { anilistId: number })[] = [];
	for (const [source, targets] of Object.entries(file)) {
		const anilist = /^anilist:(\d+)$/.exec(source);
		if (!anilist || !isObject(targets)) continue;
		const anilistId = Number(anilist[1]);
		const add = (target: string, sourceRange: string, targetRange: unknown) => {
			const show = TMDB_SHOW.exec(target);
			if (!show || typeof targetRange !== 'string') return;
			const [tmdbId, season] = [Number(show[1]), Number(show[2])];
			rows.push({ anilistId, tmdbId, season, sourceRange, targetRange });
		};

		const direct = Object.entries(targets).filter(([t, r]) => TMDB_SHOW.test(t) && isObject(r));
		for (const [target, ranges] of direct) {
			for (const [from, to] of Object.entries(ranges)) add(target, from, to);
		}
		if (direct.length) continue;

		for (const [tvdb, ranges] of Object.entries(targets)) {
			const onward = file[tvdb];
			if (!tvdb.startsWith('tvdb_show:') || !isObject(ranges) || !isObject(onward)) continue;
			for (const [target, further] of Object.entries(onward)) {
				if (!TMDB_SHOW.test(target) || !isObject(further)) continue;
				for (const [first, via] of Object.entries(ranges)) {
					for (const [from, to] of Object.entries(further)) {
						if (typeof via !== 'string' || typeof to !== 'string') continue;
						const both = composeRanges(first, via, from, to);
						if (both) add(target, both.sourceRange, both.targetRange);
					}
				}
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
	setSettings({ animeMappingAt: new Date().toISOString(), animeMappingVersion: MAPPING_VERSION });
	return rows.length;
}

let lastAttempt = 0;

// Makes sure a list not older than a week is there – called before anime are refreshed. Never
// throws: without the list, anime simply have no episode titles. After a failed download the
// next try is an hour later.
export async function ensureAnimeMapping() {
	if (!animeTitlesEnabled()) return;
	const last = Date.parse(getSetting('animeMappingAt'));
	const current = getSetting('animeMappingVersion') === MAPPING_VERSION;
	if (current && Number.isFinite(last) && Date.now() - last < KEEP_MS) return;
	if (Date.now() - lastAttempt < RETRY_MS) return;
	lastAttempt = Date.now();
	try {
		const count = await updateAnimeMapping();
		console.log(`Anime mapping list updated (${count} entries)`);
	} catch (err) {
		console.error('Updating the anime mapping list failed', err);
	}
}
