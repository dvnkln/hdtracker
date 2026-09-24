import { env } from '$env/dynamic/private';
import { fetchJson, missingKey, yearOf, type SearchResult } from './types';

const BASE = 'https://api.themoviedb.org/3';
const POSTER = 'https://image.tmdb.org/t/p/w342';

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
