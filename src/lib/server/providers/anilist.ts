import { cached } from '../cache';
import { ProviderError, fetchJson, type SearchResult, type ShowDetails } from './types';

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
  }
}`;

type AniListDetails = AniListMedia & {
	status: 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';
	episodes: number | null;
	duration: number | null; // minutes per episode
	siteUrl: string;
	nextAiringEpisode: { episode: number; airingAt: number } | null;
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

		const total = Math.max(m.episodes ?? 0, next?.episode ?? 0, aired);
		const nextDate = next ? new Date(next.airingAt * 1000).toLocaleDateString('sv-SE') : null;

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
					episodes: Array.from({ length: total }, (_, i) => ({
						number: i + 1,
						title: null,
						airDate: next && i + 1 === next.episode ? nextDate : null,
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
