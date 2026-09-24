import { cached } from '../cache';
import {
	ProviderError,
	fetchJson,
	type Details,
	type SearchResult,
	type ShowDetails
} from './types';

// AniList is a public GraphQL API, no key needed.
const SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 30) {
    media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
      id
      title { romaji english }
      startDate { year }
      coverImage { large }
      description(asHtml: false)
    }
  }
}`;

type AniListMedia = {
	id: number;
	title: { romaji: string; english: string | null };
	startDate: { year: number | null };
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

function toSearchResult(m: AniListMedia): SearchResult {
	const title = m.title.english ?? m.title.romaji;
	return {
		source: 'anilist',
		externalId: String(m.id),
		title,
		originalTitle: m.title.romaji !== title ? m.title.romaji : null,
		year: m.startDate.year,
		posterUrl: m.coverImage.large,
		overview: stripHtml(m.description)
	};
}

// ---- Anime details with episode list ----

const DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english }
    startDate { year }
    coverImage { large }
    description(asHtml: false)
    status
    episodes
    duration
    siteUrl
    nextAiringEpisode { episode airingAt }
    airingSchedule(notYetAired: true, perPage: 50) { nodes { episode airingAt } }
  }
}`;

type AniListDetails = AniListMedia & {
	status: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
	episodes: number | null;
	duration: number | null; // minutes per episode
	siteUrl: string;
	nextAiringEpisode: { episode: number; airingAt: number } | null;
	airingSchedule: { nodes: { episode: number; airingAt: number }[] };
};

const CACHE_MS = 10 * 60 * 1000;

export function getAnimeDetails(id: string): Promise<ShowDetails> {
	return cached(`anilist:${id}`, CACHE_MS, async () => {
		const data = await fetchJson<{ data: { Media: AniListDetails | null } }>(
			'AniList',
			'https://graphql.anilist.co',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ query: DETAILS_QUERY, variables: { id: Number(id) } })
			}
		);
		const m = data.data.Media;
		if (!m) throw new ProviderError('Anime nicht gefunden.', 404);

		// Episodes already aired: everything before the next scheduled one.
		const next = m.nextAiringEpisode;
		let aired: number;
		if (next) aired = next.episode - 1;
		else if (m.status === 'NOT_YET_RELEASED') aired = 0;
		else aired = m.episodes ?? 0;

		// Air date of every upcoming episode (YYYY-MM-DD in server timezone).
		const upcoming = new Map(
			m.airingSchedule.nodes.map((n) => [
				n.episode,
				new Date(n.airingAt * 1000).toLocaleDateString('sv-SE')
			])
		);
		const total = Math.max(m.episodes ?? 0, next?.episode ?? 0, aired, ...upcoming.keys());

		return {
			item: toSearchResult(m),
			ended: m.status === 'FINISHED' || m.status === 'CANCELLED',
			externalUrl: m.siteUrl,
			episodeRuntime: m.duration,
			seasons: [
				{
					number: 1,
					name: 'Folgen',
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
	});
}

// ---- Detail page ----

const INFO_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english }
    startDate { year month day }
    coverImage { large }
    bannerImage
    description(asHtml: false)
    genres
    averageScore
    format
    episodes
    duration
    siteUrl
    studios(isMain: true) { nodes { name } }
    externalLinks { site url type }
    recommendations(perPage: 12, sort: RATING_DESC) {
      nodes {
        mediaRecommendation {
          id
          type
          title { romaji english }
          startDate { year }
          coverImage { large }
          description(asHtml: false)
        }
      }
    }
  }
}`;

type AniListInfo = AniListMedia & {
	startDate: { year: number | null; month: number | null; day: number | null };
	bannerImage: string | null;
	genres: string[];
	averageScore: number | null; // 0–100
	format: string | null;
	episodes: number | null;
	duration: number | null;
	siteUrl: string;
	studios: { nodes: { name: string }[] };
	externalLinks: { site: string; url: string; type: string }[];
	recommendations: { nodes: { mediaRecommendation: (AniListMedia & { type: string }) | null }[] };
};

const FORMATS: Record<string, string> = {
	TV: 'TV-Serie',
	TV_SHORT: 'TV-Serie (kurz)',
	MOVIE: 'Film',
	SPECIAL: 'Special',
	OVA: 'OVA',
	ONA: 'ONA',
	MUSIC: 'Musikvideo'
};

export function getAnimeInfo(id: string): Promise<Details> {
	return cached(`anilist-info:${id}`, CACHE_MS, async () => {
		const data = await fetchJson<{ data: { Media: AniListInfo | null } }>(
			'AniList',
			'https://graphql.anilist.co',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ query: INFO_QUERY, variables: { id: Number(id) } })
			}
		);
		const m = data.data.Media;
		if (!m) throw new ProviderError('Anime nicht gefunden.', 404);

		const { year, month, day } = m.startDate;
		const start =
			year && month && day
				? `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
				: null;
		const studio = m.studios.nodes.map((s) => s.name).join(', ');

		return {
			item: toSearchResult(m),
			externalUrl: m.siteUrl,
			sourceLabel: 'AniList',
			backdropUrl: m.bannerImage,
			genres: m.genres,
			rating: m.averageScore ? m.averageScore / 10 : null,
			meta: [
				m.format ? (FORMATS[m.format] ?? m.format) : null,
				m.episodes ? `${m.episodes} Folgen` : null,
				m.duration ? `ca. ${m.duration} Min. pro Folge` : null
			].filter((x): x is string => !!x),
			facts: [
				...(start ? [{ label: 'Erstausstrahlung', value: start }] : []),
				...(studio ? [{ label: 'Studio', value: studio }] : [])
			],
			watch: null,
			links: m.externalLinks
				.filter((l) => l.type === 'STREAMING')
				.map((l) => ({ name: l.site, url: l.url })),
			similar: m.recommendations.nodes
				.map((n) => n.mediaRecommendation)
				.filter((r): r is NonNullable<typeof r> => !!r && r.type === 'ANIME')
				.map(toSearchResult)
		};
	});
}
