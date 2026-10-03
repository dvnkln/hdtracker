import { cached, remember } from '../cache';
import { serverMessages } from '../i18n';
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

// AniList descriptions contain some HTML (<br>, <i>) even in plain mode.
function stripHtml(text: string | null) {
	return text ? text.replace(/<[^>]*>/g, '').trim() : null;
}

export async function searchAnime(query: string): Promise<SearchResult[]> {
	const data = await fetchJson<{ data: { Page: { media: AniListMedia[] } } }>(
		'AniList',
		'https://graphql.anilist.co',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query: SEARCH_QUERY, variables: { search: query } })
		}
	);
	return data.data.Page.media.map(toSearchResult);
}

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
      duration
      siteUrl
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
	duration: number | null; // minutes per episode
	siteUrl: string;
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

const dayOf = (airing: Airing) => new Date(airing.airingAt * 1000).toLocaleDateString('sv-SE');

// ---- Anime details with episode list ----

export async function getAnimeDetails(id: string): Promise<ShowDetails> {
	const { m } = await loadAnime(id);

	// Episodes already aired: everything before the next scheduled one.
	const next = m.nextAiringEpisode;
	let aired: number;
	if (next) aired = next.episode - 1;
	else if (m.status === 'NOT_YET_RELEASED') aired = 0;
	else aired = m.episodes ?? 0;

	// Air date of every upcoming episode (YYYY-MM-DD in server timezone).
	const upcoming = new Map(m.airingSchedule.nodes.map((n) => [n.episode, dayOf(n)]));
	const total = Math.max(m.episodes ?? 0, next?.episode ?? 0, aired, ...upcoming.keys());

	return {
		item: toSearchResult(m),
		ended: m.status === 'FINISHED' || m.status === 'CANCELLED',
		externalUrl: m.siteUrl,
		episodeRuntime: m.duration,
		seasons: [
			{
				number: 1,
				name: serverMessages().detail.episodes,
				special: false,
				airDate: null,
				episodes: Array.from({ length: total }, (_, i) => ({
					number: i + 1,
					title: null,
					airDate: upcoming.get(i + 1) ?? null,
					aired: i + 1 <= aired,
					overview: null,
					stillUrl: null,
					runtime: m.duration
				}))
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
	const { m, airings } = await loadAnime(id);
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
	return { item: toSearchResult(m), events };
}

// ---- Detail page ----

export async function getAnimeInfo(id: string): Promise<Details> {
	const { m } = await loadAnime(id);
	const start = fullDate(m.startDate);
	const studio = m.studios.nodes.map((s) => s.name).join(', ');
	const facts: Fact[] = [];
	if (start) facts.push({ key: 'firstAired', value: start, isDate: true });
	if (studio) facts.push({ key: 'studio', value: studio });

	return {
		item: toSearchResult(m),
		externalUrl: m.siteUrl,
		sourceLabel: 'AniList',
		backdropUrl: m.bannerImage,
		genres: m.genres,
		rating: m.averageScore ? m.averageScore / 10 : null,
		runtime: null,
		seasonCount: null,
		episodeCount: m.episodes,
		episodeRuntime: m.duration,
		format: m.format,
		facts,
		watch: null,
		links: m.externalLinks
			.filter((l) => l.type === 'STREAMING')
			.map((l) => ({ name: l.site, url: l.url })),
		similar: m.recommendations.nodes
			.map((n) => n.mediaRecommendation)
			.filter((r): r is NonNullable<typeof r> => !!r && r.type === 'ANIME')
			.map(toSearchResult)
	};
}
