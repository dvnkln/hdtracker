import type { Messages } from '$lib/i18n/de';
import type { ReleaseKind } from '../db/schema';
import { serverMessages } from '../i18n';

// Common shape of a search hit, no matter which API it came from.
export type SearchResult = {
	source: 'tmdb' | 'igdb' | 'anilist';
	externalId: string;
	title: string;
	originalTitle: string | null;
	year: number | null;
	posterUrl: string | null;
	overview: string | null;
};

// Errors with a message that can be shown to the user as-is (in German).
export class ProviderError extends Error {
	constructor(
		message: string,
		public status?: number
	) {
		super(message);
	}
}

export function missingKey(name: string) {
	return new ProviderError(serverMessages().errors.missingKey(name));
}

const TIMEOUT_MS = 10_000;

// fetch with timeout; network problems become a readable ProviderError.
export async function fetchJson<T>(source: string, url: string | URL, init: RequestInit = {}) {
	let res: Response;
	try {
		res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch (err) {
		console.error(`${source} request failed`, err);
		throw new ProviderError(serverMessages().errors.unreachable(source));
	}
	if (res.status === 401 || res.status === 403) {
		throw new ProviderError(serverMessages().errors.badCredentials(source), res.status);
	}
	if (!res.ok) {
		console.error(`${source} responded with HTTP ${res.status}`, await res.text());
		throw new ProviderError(serverMessages().errors.httpError(source, res.status), res.status);
	}
	return (await res.json()) as T;
}

export function yearOf(date: string | null | undefined) {
	const year = date ? Number.parseInt(date.slice(0, 4), 10) : NaN;
	return Number.isNaN(year) ? null : year;
}

// A release date for the dashboard (see the `releases` table).
export type ReleaseEvent = {
	kind: ReleaseKind;
	date: string | null; // YYYY-MM-DD, null = announced without date
	season: number | null;
	episode: number | null;
};

// Up-to-date metadata of a title plus its release dates.
export type ReleaseInfo = { item: SearchResult; events: ReleaseEvent[] };

// Series/anime with its episodes, as shown on the episodes page.
export type ShowDetails = {
	item: SearchResult;
	ended: boolean; // no new episodes expected
	externalUrl: string; // page on TMDB / AniList
	episodeRuntime: number | null; // typical minutes per episode (anime)
	seasons: Season[];
};

export type Season = {
	number: number;
	name: string;
	special: boolean; // TMDB "season 0": shown, but not counted in progress
	airDate: string | null; // start of the season (YYYY-MM-DD), if known
	episodes: Episode[];
};

export type Episode = {
	number: number;
	title: string | null;
	airDate: string | null; // YYYY-MM-DD
	aired: boolean;
	overview: string | null;
	stillUrl: string | null; // screenshot of the episode (TMDB only)
	runtime: number | null; // minutes
};

// Today as YYYY-MM-DD in the server timezone (TZ from .env).
export function today() {
	return new Date().toLocaleDateString('sv-SE');
}

export type Provider = { name: string; logoUrl: string; url: string };

// Everything shown on a detail page (besides the episode list).
export type Details = {
	item: SearchResult;
	externalUrl: string;
	sourceLabel: 'TMDB' | 'AniList' | 'IGDB';
	backdropUrl: string | null;
	genres: string[];
	rating: number | null; // 0–10
	// Short facts for the header line; the page words them in the interface language.
	runtime: number | null; // minutes (movies)
	seasonCount: number | null;
	episodeCount: number | null;
	episodeRuntime: number | null; // minutes per episode
	format: string | null; // AniList format, e.g. "TV"
	facts: Fact[];
	// Streaming offers in the configured region (TMDB / JustWatch). null = not available for this source.
	watch: { link: string | null; flatrate: Provider[]; rent: Provider[]; buy: Provider[] } | null;
	links: { name: string; url: string }[]; // e.g. anime streaming sites (not region-checked)
	similar: SearchResult[];
};

export type FactKey = keyof Messages['detail']['facts'];
// A labelled fact, e.g. { key: 'cinema', value: '2024-02-29', isDate: true }.
export type Fact = { key: FactKey; value: string; isDate?: boolean };
