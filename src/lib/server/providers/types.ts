import { AsyncLocalStorage } from 'node:async_hooks';
import type { Messages } from '#lib/i18n/de.js';
import type { AnimeFacts } from '#lib/animeSeries.js';
import type { Store } from '#lib/stores.js';
import type { ReleaseKind } from '../db/schema';
import { serverMessages } from '../i18n';

// Common shape of a search hit, no matter which API it came from.
export type SearchResult = {
	source: 'tmdb' | 'igdb' | 'anilist';
	externalId: string;
	title: string;
	originalTitle: string | null;
	year: number | null;
	// First release anywhere (YYYY-MM-DD), null = not announced. Not shown anywhere; only decides
	// whether the title is out yet (see isReleased in $lib/status).
	releaseDate: string | null;
	// Games: currently only available in early access (no full release yet)
	earlyAccess: boolean;
	// Anime: ID of the same title at MyAnimeList, if there is one (needed for the export)
	malId: number | null;
	posterUrl: string | null;
	overview: string | null;
	// Anime search: what the hit is and what it belongs with (to show a series as one)
	anime?: AnimeFacts;
};

// Errors with a message that can be shown to the user as-is (in German).
export class ProviderError extends Error {
	constructor(
		message: string,
		public status?: number,
		// "Too many requests": when the service takes requests again (ms since 1970)
		public retryAt?: number
	) {
		super(message);
	}
}

export function missingKey(name: string) {
	return new ProviderError(serverMessages().errors.missingKey(name));
}

const TIMEOUT_MS = 10_000;

// ---- Rate limits for background work ----

// Requests made inside runInBackground() (loading details after an import, nightly refresh)
// are spaced out per service, so a large library never runs into the APIs' rate limits.
// Requests for the user (search, detail pages) are not slowed down.
const background = new AsyncLocalStorage<true>();

export function runInBackground<T>(work: () => Promise<T>) {
	return background.run(true, work);
}

// Minimum pause between two background requests per service. AniList allows ~30 requests
// per minute; 3 s leaves room for the user's own anime pages in the meantime. Wikidata has no
// fixed limit but asks for considerate, serial use.
const PAUSE_MS: Record<string, number> = { TMDB: 100, IGDB: 300, AniList: 3000, Wikidata: 1000 };
const lastRequest: Record<string, number> = {};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle(source: string) {
	const pause = PAUSE_MS[source] ?? 0;
	const wait = (lastRequest[source] ?? 0) + pause - Date.now();
	lastRequest[source] = Date.now() + Math.max(wait, 0);
	if (wait > 0) await sleep(wait);
}

// ---- "Too many requests" ----

// A service that answered "too many requests" (HTTP 429) is left alone until it takes requests
// again: AniList times out for a minute, and every request in that minute only gets another 429
// (its docs, read 27.10.2026). Nothing goes out in the meantime – a search says how long it
// takes, background work waits. Time from Retry-After (seconds) or X-RateLimit-Reset (Unix
// time); without either a minute for AniList, a few seconds for the others (IGDB, TMDB limit
// per second and are free again at once).
const blockedUntil: Record<string, number> = {};
const DEFAULT_BLOCK_MS: Record<string, number> = { AniList: 60_000 };
const SHORT_BLOCK_MS = 3_000;
const MAX_BLOCK_MS = 120_000;

function blockFor(source: string, res: Response) {
	const now = Date.now();
	const after = Number(res.headers.get('retry-after'));
	const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
	const until =
		Number.isFinite(after) && after > 0
			? now + after * 1000
			: Number.isFinite(reset) && reset > now
				? reset
				: now + (DEFAULT_BLOCK_MS[source] ?? SHORT_BLOCK_MS);
	blockedUntil[source] = Math.min(until, now + MAX_BLOCK_MS);
}

function tooMany(source: string) {
	const until = blockedUntil[source];
	const seconds = Math.max(1, Math.ceil((until - Date.now()) / 1000));
	return new ProviderError(serverMessages().errors.tooManyWait(source, seconds), 429, until);
}

// Room for the user: services that say how many requests are left this minute (AniList:
// X-RateLimit-Remaining) keep the last few for searches and pages. Background work that would
// take them waits for the next minute instead.
const RESERVE = 8;
const WINDOW_MS = 60_000;
const lowSince: Record<string, number> = {};

function noteRemaining(source: string, res: Response) {
	const left = res.headers.get('x-ratelimit-remaining');
	if (left === null) return;
	const now = Date.now();
	if (Number(left) > RESERVE) delete lowSince[source];
	// Still low a minute later: the next minute starts now
	else if (!(now - (lowSince[source] ?? -Infinity) < WINDOW_MS)) lowSince[source] = now;
}

// When background work may send its next request to this service (0 = now).
function backgroundWait(source: string) {
	const blocked = (blockedUntil[source] ?? 0) - Date.now();
	const low = lowSince[source] !== undefined ? lowSince[source] + WINDOW_MS - Date.now() : 0;
	return Math.max(blocked, low, 0);
}

// Only for tests
export function forgetRateLimits() {
	for (const source of Object.keys(blockedUntil)) delete blockedUntil[source];
	for (const source of Object.keys(lowSince)) delete lowSince[source];
	for (const source of Object.keys(lastRequest)) delete lastRequest[source];
}

// Background requests that hit "too many requests" wait the time and try again (3 times).
const RETRIES = 3;

// fetch with timeout; network problems become a readable ProviderError.
export async function fetchJson<T>(source: string, url: string | URL, init: RequestInit = {}) {
	const inBackground = background.getStore() === true;
	let res!: Response;
	for (let attempt = 0; ; attempt++) {
		if (inBackground) {
			const wait = backgroundWait(source);
			if (wait > 0) {
				console.warn(
					`${source}: leaving requests for the user, waiting ${Math.round(wait / 1000)} s`
				);
				await sleep(wait);
			}
			await throttle(source);
		} else if ((blockedUntil[source] ?? 0) > Date.now()) {
			throw tooMany(source);
		}
		try {
			res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
		} catch (err) {
			console.error(`${source} request failed`, err);
			throw new ProviderError(serverMessages().errors.unreachable(source));
		}
		noteRemaining(source, res);
		if (res.status !== 429) break;
		blockFor(source, res);
		console.warn(
			`${source}: too many requests until ${new Date(blockedUntil[source]).toISOString()}`
		);
		if (!inBackground || attempt >= RETRIES) throw tooMany(source);
	}
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		console.error(`${source} responded with HTTP ${res.status}`, body);
		throw new ProviderError(failureMessage(source, res.status, reasonOf(body)), res.status);
	}
	// A service can answer "ok" with something that is not data (e.g. a maintenance page).
	const body = await res.text();
	try {
		return JSON.parse(body) as T;
	} catch {
		console.error(`${source} answered with something that is not JSON`, body.slice(0, 500));
		throw new ProviderError(serverMessages().errors.garbled(source), res.status);
	}
}

// Services that need a key from .env. Only for these can a refusal mean a wrong key –
// AniList and Wikidata work without one, so ".env" would send the user the wrong way.
const KEYED = new Set(['TMDB', 'IGDB', 'Twitch']);

// What the user reads when a service answers with an error: what happened, plus the
// service's own reason if it sent one (e.g. "The AniList API has been temporarily disabled").
export function failureMessage(source: string, status: number, reason: string | null) {
	const m = serverMessages().errors;
	const refused = status === 401 || status === 403;
	const what =
		refused && KEYED.has(source)
			? m.badCredentials(source)
			: refused
				? m.refused(source)
				: status === 429
					? m.tooMany(source)
					: m.httpError(source, status);
	return reason ? `${what} ${m.reason(source, reason)}` : what;
}

const REASON_MAX = 200;

// The reason in an error answer, in the shapes the services use: GraphQL `errors` (AniList),
// `status_message` (TMDB), `message` (Twitch), a list with `title`/`cause` (IGDB).
// Anything else (an HTML page, empty) gives no reason rather than a page of markup.
export function reasonOf(body: string): string | null {
	let data: unknown;
	try {
		data = JSON.parse(body);
	} catch {
		return null;
	}
	const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
	const obj = first(data) as Record<string, unknown> | null;
	if (!obj || typeof obj !== 'object') return null;
	const graphql = first(obj.errors) as Record<string, unknown> | undefined;
	const text = [graphql?.message, obj.status_message, obj.message, obj.cause, obj.title].find(
		(v): v is string => typeof v === 'string' && v.trim() !== ''
	);
	if (!text) return null;
	const clean = text.replace(/\s+/g, ' ').trim();
	return clean.length > REASON_MAX ? `${clean.slice(0, REASON_MAX - 1)}…` : clean;
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
	// A trailer at a video site (see trailer.ts). Missing in details stored before it existed
	trailerUrl?: string | null;
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
	// Games: the stores that sell it, and the platforms it runs on. Missing in details stored
	// before they existed.
	stores?: Store[];
	platforms?: string[];
	// Anime: what it is and which other anime it belongs with (to show a series as one in the
	// library). Missing in details stored before it existed.
	anime?: AnimeFacts;
	links: { name: string; url: string }[]; // e.g. anime streaming sites (not region-checked)
	similar: SearchResult[];
};

export type FactKey = keyof Messages['detail']['facts'];
// A labelled fact, e.g. { key: 'cinema', value: '2024-02-29', isDate: true }.
export type Fact = { key: FactKey; value: string; isDate?: boolean };
