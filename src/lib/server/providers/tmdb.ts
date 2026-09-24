import { env } from '$env/dynamic/private';
import { cached } from '../cache';
import { fetchJson, missingKey, today, yearOf, type SearchResult, type ShowDetails } from './types';

const CACHE_MS = 10 * 60 * 1000;

const BASE = 'https://api.themoviedb.org/3';
const POSTER = 'https://image.tmdb.org/t/p/w342';
const STILL = 'https://image.tmdb.org/t/p/w300';

type TmdbMovie = {
	id: number;
	title: string;
	original_title: string;
	release_date?: string;
	poster_path: string | null;
	overview: string;
};
type TmdbTv = {
	id: number;
	name: string;
	original_name: string;
	first_air_date?: string;
	poster_path: string | null;
	overview: string;
};
type TmdbPage<T> = { results: T[] };

// Calls the TMDB API with the Read Access Token as Bearer header.
function tmdb<T>(path: string, params: Record<string, string>) {
	if (!env.TMDB_API_TOKEN) throw missingKey('TMDB_API_TOKEN');
	const url = new URL(BASE + path);
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	return fetchJson<T>('TMDB', url, {
		headers: { Authorization: `Bearer ${env.TMDB_API_TOKEN}`, Accept: 'application/json' }
	});
}

function poster(path: string | null) {
	return path ? POSTER + path : null;
}

export async function searchMovies(query: string, language: string): Promise<SearchResult[]> {
	const data = await tmdb<TmdbPage<TmdbMovie>>('/search/movie', {
		query,
		language,
		include_adult: 'false'
	});
	return data.results.map((m) => ({
		source: 'tmdb',
		externalId: String(m.id),
		title: m.title,
		originalTitle: m.original_title !== m.title ? m.original_title : null,
		year: yearOf(m.release_date),
		posterUrl: poster(m.poster_path),
		overview: m.overview || null
	}));
}

export async function searchTv(query: string, language: string): Promise<SearchResult[]> {
	const data = await tmdb<TmdbPage<TmdbTv>>('/search/tv', {
		query,
		language,
		include_adult: 'false'
	});
	return data.results.map((s) => ({
		source: 'tmdb',
		externalId: String(s.id),
		title: s.name,
		originalTitle: s.original_name !== s.name ? s.original_name : null,
		year: yearOf(s.first_air_date),
		posterUrl: poster(s.poster_path),
		overview: s.overview || null
	}));
}

// ---- Series details with all seasons and episodes ----

type TmdbEpisode = {
	episode_number: number;
	name: string;
	air_date: string | null;
	overview: string;
	still_path: string | null;
	runtime: number | null;
};
type TmdbSeason = { season_number: number; name: string; episodes: TmdbEpisode[] };
type TmdbTvDetails = TmdbTv & {
	status: string; // e.g. "Returning Series", "Ended", "Canceled"
	seasons: { season_number: number }[];
	[key: `season/${number}`]: TmdbSeason | undefined;
};

const SEASONS_PER_REQUEST = 20; // TMDB limit for append_to_response

export async function getTvDetails(id: string, language: string): Promise<ShowDetails> {
	return cached(`tmdb:tv:${id}:${language}`, CACHE_MS, async () => {
		const first = await tmdb<TmdbTvDetails>(`/tv/${id}`, { language });
		const numbers = first.seasons.map((s) => s.season_number);

		// Load seasons in batches of 20 via append_to_response.
		const seasons: TmdbSeason[] = [];
		for (let i = 0; i < numbers.length; i += SEASONS_PER_REQUEST) {
			const batch = numbers.slice(i, i + SEASONS_PER_REQUEST);
			const data = await tmdb<TmdbTvDetails>(`/tv/${id}`, {
				language,
				append_to_response: batch.map((n) => `season/${n}`).join(',')
			});
			for (const n of batch) {
				const season = data[`season/${n}`];
				if (season) seasons.push(season);
			}
		}

		const now = today();
		const regular = seasons.filter((s) => s.season_number > 0);
		const specials = seasons.filter((s) => s.season_number === 0);

		return {
			item: {
				source: 'tmdb',
				externalId: String(first.id),
				title: first.name,
				originalTitle: first.original_name !== first.name ? first.original_name : null,
				year: yearOf(first.first_air_date),
				posterUrl: poster(first.poster_path),
				overview: first.overview || null
			},
			ended: first.status === 'Ended' || first.status === 'Canceled',
			externalUrl: `https://www.themoviedb.org/tv/${first.id}`,
			episodeRuntime: null,
			// Regular seasons first, specials at the bottom.
			seasons: [...regular, ...specials].map((s) => ({
				number: s.season_number,
				name: s.season_number === 0 ? 'Specials' : s.name || `Staffel ${s.season_number}`,
				special: s.season_number === 0,
				episodes: s.episodes.map((e) => ({
					number: e.episode_number,
					title: e.name || null,
					airDate: e.air_date || null,
					aired: !!e.air_date && e.air_date <= now,
					overview: e.overview || null,
					stillUrl: e.still_path ? STILL + e.still_path : null,
					runtime: e.runtime || null
				}))
			}))
		};
	});
}
