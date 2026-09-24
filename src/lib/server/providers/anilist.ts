import { fetchJson, type SearchResult } from './types';

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
	return data.data.Page.media.map((m) => {
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
	});
}
