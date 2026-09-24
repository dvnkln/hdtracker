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

export type Provider = { name: string; logoUrl: string };

// Everything shown on a detail page (besides the episode list).
export type Details = {
	item: SearchResult;
	externalUrl: string;
	sourceLabel: 'TMDB' | 'AniList' | 'IGDB';
	backdropUrl: string | null;
	genres: string[];
	rating: number | null; // 0–10
	meta: string[]; // short facts for the header line, e.g. "2 Std. 35 Min.", "5 Staffeln"
	facts: { label: string; value: string }[];
	// Streaming offers in the configured region (TMDB / JustWatch). null = not available for this source.
	watch: { link: string | null; flatrate: Provider[]; rent: Provider[]; buy: Provider[] } | null;
	links: { name: string; url: string }[]; // e.g. anime streaming sites (not region-checked)
	similar: SearchResult[];
};

// "2026-10-03" -> "03.10.2026"
export function germanDate(date: string | null | undefined) {
	if (!date) return null;
	const [y, m, d] = date.slice(0, 10).split('-');
	return d && m && y ? `${d}.${m}.${y}` : null;
}

export function formatRuntime(minutes: number | null | undefined) {
	if (!minutes) return null;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h ? `${h} Std.${m ? ` ${m} Min.` : ''}` : `${m} Min.`;
}
