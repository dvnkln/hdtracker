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
	return new ProviderError(`${name} fehlt in der .env – siehe .env.example.`);
}

const TIMEOUT_MS = 10_000;

// fetch with timeout; network problems become a readable ProviderError.
export async function fetchJson<T>(source: string, url: string | URL, init: RequestInit = {}) {
	let res: Response;
	try {
		res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch (err) {
		console.error(`${source} request failed`, err);
		throw new ProviderError(`${source} ist gerade nicht erreichbar.`);
	}
	if (res.status === 401 || res.status === 403) {
		throw new ProviderError(`${source}: Zugangsdaten ungültig – bitte .env prüfen.`, res.status);
	}
	if (!res.ok) {
		console.error(`${source} responded with HTTP ${res.status}`, await res.text());
		throw new ProviderError(`${source} antwortet mit Fehler ${res.status}.`, res.status);
	}
	return (await res.json()) as T;
}

export function yearOf(date: string | null | undefined) {
	const year = date ? Number.parseInt(date.slice(0, 4), 10) : NaN;
	return Number.isNaN(year) ? null : year;
}

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
