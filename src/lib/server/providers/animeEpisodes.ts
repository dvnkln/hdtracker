import { animeTitlesEnabled, mappingFor, parseRange, type MapRow } from '../animeMapping';
import { getSetting } from '../settings';
import { getTvSeasons, hasOffers, preloadTvSeasons, watchFor } from './tmdb';
import { preloadStreamingLinks } from './wikidata';
import type { Details, Episode } from './types';

// AniList knows no episode titles. TMDB has titles, texts and images per episode – but as one
// show with seasons, where AniList has one entry per season. The list in animeMapping.ts says
// which TMDB episodes belong to an AniList entry. It is a community list and sometimes names several or wrong places, so every
// mapping is checked here before it is used; in doubt the anime stays as AniList has it.

export type AnimeTexts = {
	// AniList episode number → what TMDB knows about it
	episodes: Map<number, Pick<Episode, 'title' | 'overview' | 'stillUrl' | 'airDate' | 'runtime'>>;
	// Where the matched TMDB season can be streamed in the configured region (JustWatch);
	// null = no offers there
	watch: Details['watch'];
};

// Everything else about an anime (title, description, genres) comes from AniList and is in
// English, so the episodes are asked for in English as well – whatever the content language.
// German episode titles under an English description looked like a mix-up (the user's call).
const LANGUAGE = 'en-US';

// The first mapped episode must have aired within this many days of the AniList start date.
const MAX_DAYS_APART = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
// The list rarely names more than one TMDB show for an entry; more are not asked for.
const MAX_SHOWS = 2;

const daysApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;

type Show = Awaited<ReturnType<typeof getTvSeasons>>;
type Part = { row: MapRow; from: number; to: number | null; target: number };

// What the list says about an anime: the ranges it understands, those naming a place for
// episode 1 (only there the start date can be compared) and the TMDB shows to ask for them.
function planFor(anilistId: string) {
	const parts = mappingFor(anilistId).flatMap((row): Part[] => {
		const source = parseRange(row.sourceRange);
		const target = parseRange(row.targetRange);
		return source && target ? [{ row, from: source.from, to: source.to, target: target.from }] : [];
	});
	const anchors = parts.filter((p) => p.from === 1);
	const load = [...new Set(anchors.map((p) => p.row.tmdbId))].slice(0, MAX_SHOWS).map((tmdbId) => {
		// Only the seasons the list names for this anime, in one request. Streaming offers are
		// needed for the season the anime starts in – one of those named for episode 1.
		const seasonsOf = (list: Part[]) =>
			list.filter((p) => p.row.tmdbId === tmdbId).map((p) => p.row.season);
		const request = { seasons: seasonsOf(parts), offersFor: seasonsOf(anchors) };
		const show = () => getTvSeasons(String(tmdbId), request.seasons, request.offersFor, LANGUAGE);
		return { tmdbId, request, show };
	});
	return { parts, anchors, load };
}

// Asks TMDB already while AniList is still answering: which show to ask only depends on the
// list, not on what AniList says. animeTextsFor() then finds the answer in the cache.
export function warmUpAnimeTexts(anilistId: string) {
	if (!animeTitlesEnabled()) return;
	for (const { show } of planFor(anilistId).load) show().catch(() => {});
}

// Background refresh: asks TMDB once per show for all the given anime (several of them are
// often seasons of the same show) and looks up the direct links to streaming services for all
// of them with one request to Wikidata. animeTextsFor() then needs no request. Never throws.
export async function preloadAnimeTexts(anilistIds: string[]) {
	if (!animeTitlesEnabled()) return;
	const perShow = new Map<number, { seasons: number[]; offersFor: number[] }[]>();
	for (const id of anilistIds) {
		for (const { tmdbId, request } of planFor(id).load) {
			perShow.set(tmdbId, [...(perShow.get(tmdbId) ?? []), request]);
		}
	}
	const region = getSetting('region');
	const wikidataIds: (string | null)[] = [];
	for (const [tmdbId, requests] of perShow) {
		try {
			const show = await preloadTvSeasons(String(tmdbId), requests, LANGUAGE);
			const offered = [...show.seasons.values()].some((s) => hasOffers(s.watch, region));
			if (offered) wikidataIds.push(show.wikidataId);
		} catch {
			// The anime of this show ask for themselves later (and go on without, if that fails).
		}
	}
	await preloadStreamingLinks(wikidataIds).catch((err) =>
		console.error('Looking up streaming links at once failed', err)
	);
}

// TMDB texts for an anime, or null if there is no mapping that passes the check. Never throws:
// without TMDB the anime simply has no episode titles.
export async function animeTextsFor(
	anilistId: string,
	startDate: string | null,
	episodeCount: number
): Promise<AnimeTexts | null> {
	if (!animeTitlesEnabled()) return null;
	const { parts, anchors, load } = planFor(anilistId);
	if (anchors.length === 0) return null;

	const shows = new Map<number, Show>();
	for (const { tmdbId, show } of load) {
		try {
			shows.set(tmdbId, await show());
		} catch {
			// Not reachable, no key, unknown show: fetchJson has logged it; go on without.
		}
	}
	const episodeAt = (tmdbId: number, season: number, number: number) =>
		shows
			.get(tmdbId)
			?.seasons.get(season)
			?.episodes.find((e) => e.number === number);

	// The check: the first mapped episode exists and aired when the anime started.
	const anchor = anchors.find(({ row, target }) => {
		const first = episodeAt(row.tmdbId, row.season, target);
		if (!first) return false;
		if (!startDate || !first.airDate) return true;
		return daysApart(startDate, first.airDate) <= MAX_DAYS_APART;
	});
	if (!anchor) return null;

	// Further parts (an entry spread over several TMDB seasons) count for the same show only.
	const usable = [anchor, ...parts.filter((p) => p.from > 1 && p.row.tmdbId === anchor.row.tmdbId)];
	const episodes: AnimeTexts['episodes'] = new Map();
	for (let number = 1; number <= episodeCount; number++) {
		for (const part of usable) {
			if (number < part.from || (part.to !== null && number > part.to)) continue;
			const found = episodeAt(part.row.tmdbId, part.row.season, part.target + number - part.from);
			if (!found) continue;
			const { title, overview, stillUrl, airDate, runtime } = found;
			episodes.set(number, { title, overview, stillUrl, airDate, runtime });
			break;
		}
	}

	// Streaming offers of the season the anime starts in. (An anime that is only a part of a
	// TMDB season gets the offers of that whole season – TMDB knows nothing finer.)
	const show = shows.get(anchor.row.tmdbId)!;
	const offers = show.seasons.get(anchor.row.season)?.watch;
	const watch = offers
		? await watchFor(offers, getSetting('region'), show.name, show.wikidataId)
		: null;
	const hasOffers = !!watch && watch.flatrate.length + watch.rent.length + watch.buy.length > 0;
	return { episodes, watch: hasOffers ? watch : null };
}
