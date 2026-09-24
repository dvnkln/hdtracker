import { env } from '$env/dynamic/private';
import { cached } from '../cache';
import {
	fetchJson,
	formatRuntime,
	germanDate,
	missingKey,
	today,
	yearOf,
	type Details,
	type SearchResult,
	type ShowDetails
} from './types';

const CACHE_MS = 10 * 60 * 1000;

const BASE = 'https://api.themoviedb.org/3';
const POSTER = 'https://image.tmdb.org/t/p/w342';
const STILL = 'https://image.tmdb.org/t/p/w300';
const BACKDROP = 'https://image.tmdb.org/t/p/w1280';
const LOGO = 'https://image.tmdb.org/t/p/w92';

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

function movieToResult(m: TmdbMovie): SearchResult {
	return {
		source: 'tmdb',
		externalId: String(m.id),
		title: m.title,
		originalTitle: m.original_title !== m.title ? m.original_title : null,
		year: yearOf(m.release_date),
		posterUrl: poster(m.poster_path),
		overview: m.overview || null
	};
}

function tvToResult(s: TmdbTv): SearchResult {
	return {
		source: 'tmdb',
		externalId: String(s.id),
		title: s.name,
		originalTitle: s.original_name !== s.name ? s.original_name : null,
		year: yearOf(s.first_air_date),
		posterUrl: poster(s.poster_path),
		overview: s.overview || null
	};
}

export async function searchMovies(query: string, language: string): Promise<SearchResult[]> {
	const data = await tmdb<TmdbPage<TmdbMovie>>('/search/movie', {
		query,
		language,
		include_adult: 'false'
	});
	return data.results.map(movieToResult);
}

export async function searchTv(query: string, language: string): Promise<SearchResult[]> {
	const data = await tmdb<TmdbPage<TmdbTv>>('/search/tv', {
		query,
		language,
		include_adult: 'false'
	});
	return data.results.map(tvToResult);
}

// ---- Detail pages (movies and series) ----

type TmdbProvider = { provider_name: string; logo_path: string; display_priority: number };
type TmdbWatch = {
	results: Record<
		string,
		{ link?: string; flatrate?: TmdbProvider[]; rent?: TmdbProvider[]; buy?: TmdbProvider[] }
	>;
};
type TmdbCommon = {
	genres: { name: string }[];
	vote_average: number;
	vote_count: number;
	backdrop_path: string | null;
	'watch/providers': TmdbWatch;
};
type TmdbMovieFull = TmdbMovie &
	TmdbCommon & {
		runtime: number | null;
		release_dates: {
			results: { iso_3166_1: string; release_dates: { type: number; release_date: string }[] }[];
		};
		recommendations: TmdbPage<TmdbMovie>;
	};
type TmdbTvFull = TmdbTv &
	TmdbCommon & {
		status: string;
		number_of_seasons: number;
		number_of_episodes: number;
		episode_run_time: number[];
		networks: { name: string }[];
		recommendations: TmdbPage<TmdbTv>;
	};

// Streaming offers for one region, sorted like on JustWatch.
function watchFor(data: TmdbWatch, region: string): Details['watch'] {
	const r = data.results[region] ?? {};
	const list = (providers?: TmdbProvider[]) =>
		[...(providers ?? [])]
			.sort((a, b) => a.display_priority - b.display_priority)
			.map((p) => ({ name: p.provider_name, logoUrl: LOGO + p.logo_path }));
	return { link: r.link ?? null, flatrate: list(r.flatrate), rent: list(r.rent), buy: list(r.buy) };
}

function common(data: TmdbCommon) {
	return {
		sourceLabel: 'TMDB' as const,
		backdropUrl: data.backdrop_path ? BACKDROP + data.backdrop_path : null,
		genres: data.genres.map((g) => g.name),
		rating: data.vote_count > 0 ? Math.round(data.vote_average * 10) / 10 : null,
		links: []
	};
}

export function getMovieInfo(id: string, language: string, region: string): Promise<Details> {
	return cached(`tmdb:movie-info:${id}:${language}:${region}`, CACHE_MS, async () => {
		const m = await tmdb<TmdbMovieFull>(`/movie/${id}`, {
			language,
			append_to_response: 'release_dates,watch/providers,recommendations'
		});

		// Release types: 2/3 = cinema, 4 = digital, 5 = disc. Take the earliest of each.
		const dates = m.release_dates.results.find((r) => r.iso_3166_1 === region)?.release_dates ?? [];
		const earliest = (types: number[]) =>
			dates
				.filter((d) => types.includes(d.type))
				.map((d) => d.release_date.slice(0, 10))
				.sort()[0];
		const cinema = germanDate(earliest([2, 3]));
		const home = germanDate(earliest([4, 5]));

		return {
			...common(m),
			item: movieToResult(m),
			externalUrl: `https://www.themoviedb.org/movie/${m.id}`,
			meta: [formatRuntime(m.runtime)].filter((x): x is string => !!x),
			facts: [
				...(cinema ? [{ label: `Kinostart ${region}`, value: cinema }] : []),
				...(home ? [{ label: `Heimkino ${region} (digital/Disc)`, value: home }] : [])
			],
			watch: watchFor(m['watch/providers'], region),
			similar: m.recommendations.results.slice(0, 12).map(movieToResult)
		};
	});
}

export function getTvInfo(id: string, language: string, region: string): Promise<Details> {
	return cached(`tmdb:tv-info:${id}:${language}:${region}`, CACHE_MS, async () => {
		const s = await tmdb<TmdbTvFull>(`/tv/${id}`, {
			language,
			append_to_response: 'watch/providers,recommendations'
		});
		const seasons = s.number_of_seasons;
		return {
			...common(s),
			item: tvToResult(s),
			externalUrl: `https://www.themoviedb.org/tv/${s.id}`,
			meta: [
				`${seasons} ${seasons === 1 ? 'Staffel' : 'Staffeln'}`,
				s.episode_run_time[0] ? `ca. ${s.episode_run_time[0]} Min. pro Folge` : null
			].filter((x): x is string => !!x),
			facts: [
				...(s.networks.length
					? [{ label: 'Sender', value: s.networks.map((n) => n.name).join(', ') }]
					: []),
				{ label: 'Folgen', value: String(s.number_of_episodes) }
			],
			watch: watchFor(s['watch/providers'], region),
			similar: s.recommendations.results.slice(0, 12).map(tvToResult)
		};
	});
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
