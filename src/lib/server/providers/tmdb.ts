import { env } from '$env/dynamic/private';
import { cached } from '../cache';
import { getStreamingLinks, type StreamingLinks } from './wikidata';
import { serverMessages } from '../i18n';
import {
	fetchJson,
	missingKey,
	today,
	yearOf,
	type Details,
	type Fact,
	type ReleaseInfo,
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
		releaseDate: m.release_date || null,
		earlyAccess: false,
		malId: null,
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
		releaseDate: s.first_air_date || null,
		earlyAccess: false,
		malId: null,
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
	external_ids: { wikidata_id: string | null };
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

// Link for one provider logo: direct link (from Wikidata) > search on the service > TMDB page.
function providerUrl(name: string, title: string, links: StreamingLinks, fallback: string) {
	const n = name.toLowerCase();
	const q = encodeURIComponent(title);
	if (n.startsWith('netflix')) return links.netflix ?? `https://www.netflix.com/search?q=${q}`;
	if (n.includes('disney')) return links.disney ?? fallback; // Disney+ has no search URL
	if (n.includes('amazon') || n.includes('prime video')) {
		return links.prime ?? `https://www.primevideo.com/search?phrase=${q}`;
	}
	if (n.startsWith('apple tv')) return links.apple ?? `https://tv.apple.com/search?term=${q}`;
	if (n.includes('google play')) return `https://play.google.com/store/search?q=${q}&c=movies`;
	if (n === 'youtube') return `https://www.youtube.com/results?search_query=${q}`;
	if (n.includes('crunchyroll')) return `https://www.crunchyroll.com/search?q=${q}`;
	return fallback;
}

// Streaming offers for one region, sorted like on JustWatch.
async function watchFor(
	data: TmdbWatch,
	region: string,
	title: string,
	wikidataId: string | null
): Promise<Details['watch']> {
	const r = data.results[region] ?? {};
	const hasOffers = !!(r.flatrate?.length || r.rent?.length || r.buy?.length);
	const links = hasOffers ? await getStreamingLinks(wikidataId) : {};
	const fallback = r.link ?? 'https://www.justwatch.com';
	const list = (providers?: TmdbProvider[]) =>
		[...(providers ?? [])]
			.sort((a, b) => a.display_priority - b.display_priority)
			.map((p) => ({
				name: p.provider_name,
				logoUrl: LOGO + p.logo_path,
				url: providerUrl(p.provider_name, title, links, fallback)
			}));
	return { link: r.link ?? null, flatrate: list(r.flatrate), rent: list(r.rent), buy: list(r.buy) };
}

function common(data: TmdbCommon) {
	return {
		sourceLabel: 'TMDB' as const,
		backdropUrl: data.backdrop_path ? BACKDROP + data.backdrop_path : null,
		genres: data.genres.map((g) => g.name),
		rating: data.vote_count > 0 ? Math.round(data.vote_average * 10) / 10 : null,
		format: null,
		links: []
	};
}

type TmdbReleaseDates = TmdbMovieFull['release_dates'];

// Release types: 2/3 = cinema, 4 = digital, 5 = disc. Takes the earliest of each in the region.
function regionalDates(releaseDates: TmdbReleaseDates, region: string) {
	const dates = releaseDates.results.find((r) => r.iso_3166_1 === region)?.release_dates ?? [];
	const earliest = (types: number[]) =>
		dates
			.filter((d) => types.includes(d.type))
			.map((d) => d.release_date.slice(0, 10))
			.sort()[0] as string | undefined;
	return { cinema: earliest([2, 3]), home: earliest([4, 5]) };
}

// ---- One movie with everything the app needs ----

// Release dates and the detail page come from a single request per movie.
function loadMovie(id: string, language: string) {
	return cached(`tmdb:movie:${id}:${language}`, CACHE_MS, () =>
		tmdb<TmdbMovieFull>(`/movie/${id}`, {
			language,
			append_to_response: 'release_dates,watch/providers,recommendations,external_ids'
		})
	);
}

// Movie metadata and its release dates in the region (for the dashboard).
export async function getMovieReleases(id: string, language: string, region: string) {
	const m = await loadMovie(id, language);
	const { cinema, home } = regionalDates(m.release_dates, region);
	const info: ReleaseInfo = { item: movieToResult(m), events: [] };
	const event = (kind: 'cinema' | 'home' | 'release', date: string | null) =>
		info.events.push({ kind, date, season: null, episode: null });
	if (cinema) event('cinema', cinema);
	if (home) event('home', home);
	// No dates for the region: fall back to the general release date (or "no date yet").
	if (!cinema && !home) event('release', m.release_date || null);
	return info;
}

export async function getMovieInfo(id: string, language: string, region: string): Promise<Details> {
	const m = await loadMovie(id, language);
	const { cinema, home } = regionalDates(m.release_dates, region);
	const facts: Fact[] = [];
	if (cinema) facts.push({ key: 'cinema', value: cinema, isDate: true });
	if (home) facts.push({ key: 'home', value: home, isDate: true });

	return {
		...common(m),
		item: movieToResult(m),
		externalUrl: `https://www.themoviedb.org/movie/${m.id}`,
		runtime: m.runtime || null,
		seasonCount: null,
		episodeCount: null,
		episodeRuntime: null,
		facts,
		watch: await watchFor(m['watch/providers'], region, m.title, m.external_ids.wikidata_id),
		similar: m.recommendations.results.slice(0, 12).map(movieToResult)
	};
}

// ---- One series with everything the app needs ----

type TmdbEpisode = {
	episode_number: number;
	name: string;
	air_date: string | null;
	overview: string;
	still_path: string | null;
	runtime: number | null;
};
type TmdbSeason = {
	season_number: number;
	name: string;
	air_date: string | null;
	overview?: string;
	episodes: TmdbEpisode[];
};
type TmdbTvWithSeasons = TmdbTvFull & {
	seasons: { season_number: number }[];
	[key: `season/${number}`]: TmdbSeason | undefined;
};

// TMDB allows 20 extra parts per request (append_to_response).
const PARTS_PER_REQUEST = 20;
const TV_PARTS = ['watch/providers', 'recommendations', 'external_ids'];

// The detail page and all seasons with their episodes. The first request asks for the parts
// of the detail page plus seasons 0–16 (seasons that do not exist are simply left out), so
// almost every series needs a single request; longer ones get the rest in batches of 20.
function loadTv(id: string, language: string) {
	return cached(`tmdb:tv:${id}:${language}`, CACHE_MS, async () => {
		const seasonPart = (n: number) => `season/${n}`;
		const guessed = Array.from({ length: PARTS_PER_REQUEST - TV_PARTS.length }, (_, n) => n);
		const show = await tmdb<TmdbTvWithSeasons>(`/tv/${id}`, {
			language,
			append_to_response: [...TV_PARTS, ...guessed.map(seasonPart)].join(',')
		});
		const numbers = show.seasons.map((s) => s.season_number);
		const loaded = new Map<number, TmdbSeason>();
		for (const n of numbers) {
			const season = show[`season/${n}`];
			if (season) loaded.set(n, season);
		}

		const missing = numbers.filter((n) => !loaded.has(n) && !guessed.includes(n));
		for (let i = 0; i < missing.length; i += PARTS_PER_REQUEST) {
			const batch = missing.slice(i, i + PARTS_PER_REQUEST);
			const data = await tmdb<TmdbTvWithSeasons>(`/tv/${id}`, {
				language,
				append_to_response: batch.map(seasonPart).join(',')
			});
			for (const n of batch) {
				const season = data[`season/${n}`];
				if (season) loaded.set(n, season);
			}
		}
		// In the order TMDB lists the seasons
		const seasons = numbers.map((n) => loaded.get(n)).filter((s) => s !== undefined);
		return { show, seasons };
	});
}

export async function getTvInfo(id: string, language: string, region: string): Promise<Details> {
	const { show: s } = await loadTv(id, language);
	const facts: Fact[] = [];
	if (s.networks.length) {
		facts.push({ key: 'network', value: s.networks.map((n) => n.name).join(', ') });
	}
	facts.push({ key: 'episodes', value: String(s.number_of_episodes) });

	return {
		...common(s),
		item: tvToResult(s),
		externalUrl: `https://www.themoviedb.org/tv/${s.id}`,
		runtime: null,
		seasonCount: s.number_of_seasons,
		episodeCount: null,
		episodeRuntime: s.episode_run_time[0] ?? null,
		facts,
		watch: await watchFor(s['watch/providers'], region, s.name, s.external_ids.wikidata_id),
		similar: s.recommendations.results.slice(0, 12).map(tvToResult)
	};
}

// Series details with all seasons and episodes.
export async function getTvDetails(id: string, language: string): Promise<ShowDetails> {
	const { show: first, seasons } = await loadTv(id, language);
	const now = today();
	const regular = seasons.filter((s) => s.season_number > 0);
	const specials = seasons.filter((s) => s.season_number === 0);

	return {
		item: tvToResult(first),
		ended: first.status === 'Ended' || first.status === 'Canceled',
		externalUrl: `https://www.themoviedb.org/tv/${first.id}`,
		episodeRuntime: null,
		// Regular seasons first, specials at the bottom.
		seasons: [...regular, ...specials].map((s) => ({
			number: s.season_number,
			name:
				s.season_number === 0
					? serverMessages().episodes.specials
					: s.name || serverMessages().episodes.season(s.season_number),
			special: s.season_number === 0,
			airDate: s.air_date || null,
			overview: s.overview || null,
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
}

// ---- Choices for the settings page ----

const DAY_MS = 24 * 60 * 60 * 1000;

// Country codes TMDB has streaming offers for, e.g. ["DE", "US", ...].
export function getWatchRegions(): Promise<string[]> {
	return cached('tmdb:regions', DAY_MS, async () => {
		const data = await tmdb<{ results: { iso_3166_1: string }[] }>('/watch/providers/regions', {});
		return data.results.map((r) => r.iso_3166_1);
	});
}

// Languages TMDB has translations for, e.g. ["de-DE", "en-US", ...].
export function getContentLanguages(): Promise<string[]> {
	// async, so a missing token becomes a rejected promise instead of an exception
	return cached('tmdb:languages', DAY_MS, async () =>
		tmdb<string[]>('/configuration/primary_translations', {})
	);
}
