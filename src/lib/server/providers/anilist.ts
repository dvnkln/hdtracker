import { groupAnime, LINKS, type AnimeFacts } from '#lib/animeSeries.js';
import { cached, recall, remember } from '../cache';
import { anilistTrailer } from './trailer';
import { contentMessages, serverMessages } from '../i18n';
import { animeTextsFor, warmUpAnimeTexts } from './animeEpisodes';
import { withDirectLinks } from './streamingServices';
import {
	ProviderError,
	fetchJson,
	type Details,
	type Fact,
	type ReleaseEvent,
	type ReleaseInfo,
	type SearchResult,
	type ShowDetails
} from './types';

// AniList is a public GraphQL API, no key needed.
const SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 30) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
      id
      idMal
      title { romaji english }
      startDate { year month day }
      status
      coverImage { large }
      description(asHtml: false)
      format
      episodes
      season
      relations { edges { relationType node { id type format } } }
    }
  }
}`;

type AniListDate = { year: number | null; month: number | null; day: number | null };
type AniListMedia = {
	id: number;
	idMal: number | null;
	title: { romaji: string; english: string | null };
	startDate: AniListDate;
	status: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS' | null;
	coverImage: { large: string | null };
	description: string | null;
};

// An anime also says what it is and which other entries it belongs with (src/lib/animeSeries.ts):
// a search hit the links to its neighbours, an anime of the library also their links (one step
// further, so that parts join across two missing ones).
type RelationNode = { id: number; type: string; format: string | null; relations?: Relations };
type Relations = { edges: { relationType: string; node: RelationNode }[] };
type SearchMedia = AniListMedia & {
	format: string | null;
	episodes: number | null;
	season: AnimeFacts['season'];
	relations: Relations | null;
};

const joining = (r: Relations | null | undefined) =>
	(r?.edges ?? []).filter((e) => e.node.type === 'ANIME' && LINKS.includes(e.relationType));

function factsOf(m: SearchMedia): AnimeFacts {
	const { year, month, day } = m.startDate;
	const pad = (n: number | null, max: number) => String(n ?? max).padStart(2, '0');
	return {
		format: m.format ?? null,
		episodes: m.episodes ?? null,
		season: m.season ?? null,
		start: `${year ?? 9999}-${pad(month, 12)}-${pad(day, 31)}`,
		links: joining(m.relations).map((e) => ({
			type: e.relationType,
			id: String(e.node.id),
			format: e.node.format ?? null
		})),
		...(m.relations?.edges.some((e) => e.node.relations) && {
			around: joining(m.relations).flatMap((e) =>
				joining(e.node.relations).map((f) => ({
					from: String(e.node.id),
					type: f.relationType,
					id: String(f.node.id),
					format: f.node.format ?? null
				}))
			)
		})
	};
}

// AniList descriptions contain some HTML (<br>, <i>) even in plain mode.
function stripHtml(text: string | null) {
	return text ? text.replace(/<[^>]*>/g, '').trim() : null;
}

export async function searchAnime(query: string): Promise<SearchResult[]> {
	return (await askHits(SEARCH_QUERY, { search: query })).map(toHit);
}

// Anime as search hits, asked with one of the queries that return them (search, chain); they are
// remembered for a while (see recentFacts, seriesSeasons).
async function askHits(query: string, variables: Record<string, unknown>) {
	const data = await fetchJson<{ data: { Page: { media: SearchMedia[] } } }>(
		'AniList',
		'https://graphql.anilist.co',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables })
		}
	);
	rememberHits(data.data.Page.media);
	return data.data.Page.media;
}

const toHit = (m: SearchMedia): SearchResult => ({ ...toSearchResult(m), anime: factsOf(m) });

// YYYY-MM-DD if the exact day is known.
function fullDate({ year, month, day }: AniListDate) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return year && month && day ? `${year}-${pad(month)}-${pad(day)}` : null;
}

// First air date, only used to tell whether the anime is out yet. Not started: the exact day
// or nothing. Already started: old entries sometimes lack the day (or everything), so the
// start of the year (or any day in the past) stands in.
function releaseDateOf(m: AniListMedia) {
	const date = fullDate(m.startDate);
	if (date || m.status === 'NOT_YET_RELEASED') return date;
	return `${m.startDate.year ?? 1900}-01-01`;
}

function toSearchResult(m: AniListMedia): SearchResult {
	const title = m.title.english ?? m.title.romaji;
	return {
		source: 'anilist',
		externalId: String(m.id),
		title,
		originalTitle: m.title.romaji !== title ? m.title.romaji : null,
		year: m.startDate.year,
		releaseDate: releaseDateOf(m),
		earlyAccess: false,
		malId: m.idMal,
		posterUrl: m.coverImage.large,
		overview: stripHtml(m.description)
	};
}

// ---- The seasons of a series ----

// The anime hits of the last half hour (in the app's cache, cleared by its maintenance task):
// the seasons of a series one just searched for are among them, so tracking it asks AniList
// only for what is missing (often nothing).
const RECENT_MS = 30 * 60_000;
const hitKey = (id: number) => `anilist:hit:${id}`;

function rememberHits(list: SearchMedia[]) {
	for (const m of list) remember(hitKey(m.id), RECENT_MS, m);
}

// What the recent hits say about some anime (what it is, what it belongs with) – for the library
// until their own details are loaded, so a series just added stands as one stack at once.
export async function recentFacts(ids: string[]) {
	const found = await Promise.all(ids.map((id) => recall<SearchMedia>(hitKey(Number(id)))));
	return new Map(
		ids.flatMap((id, i) => {
			const m = found[i];
			return m ? [[id, factsOf(m)] as const] : [];
		})
	);
}

// Prequels and sequels, followed two steps per request (the links of the linked entries too).
const CHAIN_QUERY = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      idMal
      title { romaji english }
      startDate { year month day }
      status
      coverImage { large }
      description(asHtml: false)
      format
      episodes
      season
      relations { edges { relationType node { id type format
        relations { edges { relationType node { id type format } } } } } }
    }
  }
}`;
const ONE_AFTER_ANOTHER = ['PREQUEL', 'SEQUEL'];
// A long series takes a few requests; this many at most (and never more than 60 entries)
const CHAIN_ROUNDS = 6;
const CHAIN_MAX = 60;

// The seasons of the series an anime belongs to, in order, the anime itself included – the
// same seasons the search and the library show (src/lib/animeSeries.ts). Empty if the anime is
// not a season (a film, an OVA) or has no others. `offline`: only from recent hits – null if
// that is not enough (then the caller asks AniList in the background).
export async function seriesSeasons(
	id: string,
	{ offline = false } = {}
): Promise<SearchResult[] | null> {
	const found = new Map<number, SearchMedia>();
	let wanted = [Number(id)];
	let requests = 0;
	while (wanted.length > 0) {
		// What a recent search found needs no request
		const recalled = await Promise.all(wanted.map((n) => recall<SearchMedia>(hitKey(n))));
		const known = recalled.filter((m): m is SearchMedia => !!m);
		const missing = wanted.filter((_, i) => !recalled[i]);
		if (missing.length > 0 && offline) return null;
		if (missing.length > 0 && requests >= CHAIN_ROUNDS) break;
		const asked = missing.length > 0 ? await askHits(CHAIN_QUERY, { ids: missing }) : [];
		if (missing.length > 0) requests++;
		const next = new Set<number>();
		const follow = (r: Relations | null | undefined) =>
			(r?.edges ?? []).filter(
				(e) => e.node.type === 'ANIME' && ONE_AFTER_ANOTHER.includes(e.relationType)
			);
		for (const m of [...known, ...asked]) {
			found.set(m.id, m);
			for (const e of follow(m.relations)) {
				next.add(e.node.id);
				for (const f of follow(e.node.relations)) next.add(f.node.id);
			}
		}
		wanted = [...next].filter((n) => !found.has(n)).slice(0, CHAIN_MAX - found.size);
	}
	const series = groupAnime([...found.values()].map(toHit)).find(
		(e) => e.kind === 'series' && e.seasons.some((h) => h.externalId === id)
	);
	return series?.kind === 'series' ? series.seasons : [];
}

// Some anime as search hits (e.g. a new season that became known), in one request.
export async function animeHits(ids: string[]): Promise<SearchResult[]> {
	if (ids.length === 0) return [];
	return (await askHits(CHAIN_QUERY, { ids: ids.map(Number) })).map(toHit);
}

// ---- One anime with everything the app needs ----

// Episodes, air dates and the detail page come from a single request – for one anime or for
// many at once (AniList allows only about 30 requests per minute). "past" holds the episodes
// aired since $since; the upcoming ones are part of each anime (at most 25).
const ANIME_QUERY = `
query ($ids: [Int], $since: Int, $now: Int, $page: Int) {
  Page(perPage: 50) {
    media(id_in: $ids, type: ANIME) {
      id
      idMal
      title { romaji english }
      startDate { year month day }
      status
      coverImage { large }
      bannerImage
      description(asHtml: false)
      genres
      averageScore
      format
      episodes
      season
      duration
      siteUrl
      trailer { id site }
      relations { edges { relationType node { id type format
        relations { edges { relationType node { id type format } } } } } }
      nextAiringEpisode { episode airingAt }
      airingSchedule(notYetAired: true, perPage: 25) { nodes { episode airingAt } }
      studios(isMain: true) { nodes { name } }
      externalLinks { site url type }
      recommendations(perPage: 12, sort: RATING_DESC) {
        nodes {
          mediaRecommendation {
            id
            idMal
            type
            title { romaji english }
            startDate { year month day }
            status
            coverImage { large }
            description(asHtml: false)
          }
        }
      }
    }
  }
  past: Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(mediaId_in: $ids, airingAt_greater: $since, airingAt_lesser: $now, sort: TIME) {
      mediaId
      episode
      airingAt
    }
  }
}`;

// Further pages of "past", needed when many of the anime are currently airing.
const PAST_QUERY = `
query ($ids: [Int], $since: Int, $now: Int, $page: Int) {
  past: Page(page: $page, perPage: 50) {
    pageInfo { hasNextPage }
    airingSchedules(mediaId_in: $ids, airingAt_greater: $since, airingAt_lesser: $now, sort: TIME) {
      mediaId
      episode
      airingAt
    }
  }
}`;

type Airing = { episode: number; airingAt: number };
type AniListAnime = AniListMedia & {
	bannerImage: string | null;
	genres: string[];
	averageScore: number | null; // 0–100
	format: string | null;
	episodes: number | null;
	season: AnimeFacts['season'];
	relations: Relations | null;
	duration: number | null; // minutes per episode
	siteUrl: string;
	trailer?: { id: string | null; site: string | null } | null;
	nextAiringEpisode: Airing | null;
	airingSchedule: { nodes: Airing[] };
	studios: { nodes: { name: string }[] };
	externalLinks: { site: string; url: string; type: string }[];
	recommendations: { nodes: { mediaRecommendation: (AniListMedia & { type: string }) | null }[] };
};
type PastPage = {
	pageInfo: { hasNextPage: boolean };
	airingSchedules: (Airing & { mediaId: number })[];
};
type LoadedAnime = { m: AniListAnime; airings: Airing[] };

const CACHE_MS = 10 * 60 * 1000;
// Air dates are loaded from this many days ago on (the dashboard shows the last 4 weeks).
const KEEP_DAYS = 60;
// So many anime fit into one request without the answer getting too large.
export const ANIME_PER_REQUEST = 25;

// Loads up to ANIME_PER_REQUEST anime with one request. Anime AniList does not know are
// missing in the result.
async function fetchAnime(ids: string[]) {
	const now = Math.floor(Date.now() / 1000);
	const variables = { ids: ids.map(Number), since: now - KEEP_DAYS * 24 * 60 * 60, now };
	const ask = <T>(query: string, page: number) =>
		fetchJson<{ data: T }>('AniList', 'https://graphql.anilist.co', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query, variables: { ...variables, page } })
		});

	const first = await ask<{ Page: { media: AniListAnime[] }; past: PastPage }>(ANIME_QUERY, 1);
	const past = first.data.past.airingSchedules;
	let more = first.data.past.pageInfo.hasNextPage;
	for (let page = 2; more; page++) {
		const next = (await ask<{ past: PastPage }>(PAST_QUERY, page)).data.past;
		past.push(...next.airingSchedules);
		more = next.pageInfo.hasNextPage;
	}

	const found = new Map<string, LoadedAnime>();
	for (const m of first.data.Page.media) {
		const airings = [...past.filter((a) => a.mediaId === m.id), ...m.airingSchedule.nodes];
		found.set(String(m.id), { m, airings });
	}
	return found;
}

function loadAnime(id: string) {
	return cached(`anilist:${id}`, CACHE_MS, async () => {
		const anime = (await fetchAnime([id])).get(id);
		if (!anime) throw new ProviderError(serverMessages().errors.animeNotFound, 404);
		return anime;
	});
}

// Background refresh: loads many anime with one request and keeps the answers ready, so the
// following getAnime…() calls for them need no request of their own.
export async function preloadAnime(ids: string[]) {
	for (const [id, anime] of await fetchAnime(ids)) remember(`anilist:${id}`, CACHE_MS, anime);
}

// How many episodes there are so far and how many of them have aired.
function episodeCounts(m: AniListAnime) {
	// Episodes already aired: everything before the next scheduled one.
	const next = m.nextAiringEpisode;
	let aired: number;
	if (next) aired = next.episode - 1;
	else if (m.status === 'NOT_YET_RELEASED') aired = 0;
	else aired = m.episodes ?? 0;
	const scheduled = m.airingSchedule.nodes.map((n) => n.episode);
	return { aired, total: Math.max(m.episodes ?? 0, next?.episode ?? 0, aired, ...scheduled) };
}

// The anime as AniList has it, plus what TMDB knows about its episodes (titles, texts, images)
// where they can be matched (see animeEpisodes.ts).
async function loadAnimeWithTexts(id: string) {
	warmUpAnimeTexts(id);
	const anime = await loadAnime(id);
	const { total } = episodeCounts(anime.m);
	const texts = await animeTextsFor(id, fullDate(anime.m.startDate), total);
	return { ...anime, texts, item: toSearchResult(anime.m) };
}

const dayOf = (airing: Airing) => new Date(airing.airingAt * 1000).toLocaleDateString('sv-SE');

// ---- Anime details with episode list ----

export async function getAnimeDetails(id: string): Promise<ShowDetails> {
	const { m, texts, item } = await loadAnimeWithTexts(id);
	const { aired, total } = episodeCounts(m);
	// Air date of every upcoming episode (YYYY-MM-DD in server timezone).
	const upcoming = new Map(m.airingSchedule.nodes.map((n) => [n.episode, dayOf(n)]));

	return {
		item,
		ended: m.status === 'FINISHED' || m.status === 'CANCELLED',
		externalUrl: m.siteUrl,
		episodeRuntime: m.duration,
		seasons: [
			{
				number: 1,
				name: contentMessages().detail.episodes,
				special: false,
				airDate: null,
				episodes: Array.from({ length: total }, (_, i) => {
					const known = texts?.episodes.get(i + 1);
					const hasAired = i + 1 <= aired;
					return {
						number: i + 1,
						title: known?.title ?? null,
						// Whether and when an episode airs is AniList's call: a date of TMDB is only
						// taken for episodes that have aired, never to announce one.
						airDate: upcoming.get(i + 1) ?? (hasAired ? known?.airDate : null) ?? null,
						aired: hasAired,
						overview: known?.overview ?? null,
						stillUrl: known?.stillUrl ?? null,
						runtime: known?.runtime ?? m.duration
					};
				})
			}
		]
	};
}

// ---- Import: MyAnimeList IDs -> AniList ----

const BY_MAL_QUERY = `
query ($ids: [Int]) {
  Page(perPage: 50) {
    media(idMal_in: $ids, type: ANIME) {
      id
      idMal
      title { romaji english }
      startDate { year month day }
      status
      coverImage { large }
      description(asHtml: false)
    }
  }
}`;

// Finds the AniList entries for MyAnimeList IDs (50 per request). Returns MAL ID -> anime.
export async function getAnimeByMalIds(malIds: number[]) {
	const found = new Map<number, SearchResult>();
	for (let i = 0; i < malIds.length; i += 50) {
		const data = await fetchJson<{
			data: { Page: { media: (AniListMedia & { idMal: number })[] } };
		}>('AniList', 'https://graphql.anilist.co', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query: BY_MAL_QUERY, variables: { ids: malIds.slice(i, i + 50) } })
		});
		for (const m of data.data.Page.media) found.set(m.idMal, toSearchResult(m));
	}
	return found;
}

// ---- Release dates (dashboard) ----

// Anime metadata and the air dates of its episodes from 60 days ago onwards.
export async function getAnimeReleases(id: string): Promise<ReleaseInfo> {
	const { m, airings, item } = await loadAnimeWithTexts(id);
	const episode = (number: number, date: string | null): ReleaseEvent => ({
		kind: 'episode',
		date,
		season: 1,
		episode: number
	});
	const events = airings.map((a) => episode(a.episode, dayOf(a)));
	// Not started and no schedule yet: the start date, if the exact day is known.
	if (events.length === 0 && m.status === 'NOT_YET_RELEASED') {
		events.push(episode(1, fullDate(m.startDate)));
	}
	return { item, events };
}

// ---- Detail page ----

export async function getAnimeInfo(id: string): Promise<Details> {
	const { m, item, texts } = await loadAnimeWithTexts(id);
	const start = fullDate(m.startDate);
	// Offers for the configured region (TMDB/JustWatch) replace the links of AniList, which
	// are not checked for any region; without a match or without offers the links stay.
	// A logo of a service AniList has a link for goes straight to the anime there.
	const streaming = m.externalLinks
		.filter((l) => l.type === 'STREAMING')
		.map((l) => ({ name: l.site, url: l.url }));
	const watch = texts?.watch ? withDirectLinks(texts.watch, streaming) : null;
	const studio = m.studios.nodes.map((s) => s.name).join(', ');
	const facts: Fact[] = [];
	if (start) facts.push({ key: 'firstAired', value: start, isDate: true });
	if (studio) facts.push({ key: 'studio', value: studio });

	return {
		item,
		externalUrl: m.siteUrl,
		sourceLabel: 'AniList',
		backdropUrl: m.bannerImage,
		trailerUrl: anilistTrailer(m.trailer ?? null),
		anime: factsOf(m),
		genres: m.genres,
		rating: m.averageScore ? m.averageScore / 10 : null,
		runtime: null,
		seasonCount: null,
		episodeCount: m.episodes,
		episodeRuntime: m.duration,
		format: m.format,
		facts,
		watch,
		links: watch ? [] : streaming,
		similar: m.recommendations.nodes
			.map((n) => n.mediaRecommendation)
			.filter((r): r is NonNullable<typeof r> => !!r && r.type === 'ANIME')
			.map(toSearchResult)
	};
}
