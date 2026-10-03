import { env } from '$env/dynamic/private';
import { cached, remember } from '../cache';
import { serverMessages } from '../i18n';
import {
	ProviderError,
	fetchJson,
	missingKey,
	today,
	yearOf,
	type Details,
	type Fact,
	type ReleaseEvent,
	type ReleaseInfo,
	type SearchResult
} from './types';

const COVER = 'https://images.igdb.com/igdb/image/upload/t_cover_big/';

type IgdbGame = {
	id: number;
	name: string;
	first_release_date?: number; // unix seconds
	cover?: { image_id: string };
	summary?: string;
	// One entry per platform/region; status says what kind of release it is
	release_dates?: { date?: number; status?: { name: string } }[];
	game_status?: { status: string };
};

// Fields every game query needs (see gameToResult).
const GAME_FIELDS = [
	'name',
	'first_release_date',
	'cover.image_id',
	'summary',
	'release_dates.date',
	'release_dates.status.name',
	'game_status.status'
];

// Twitch app token (valid ~60 days), kept in memory until shortly before it expires.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken() {
	if (!env.IGDB_CLIENT_ID) throw missingKey('IGDB_CLIENT_ID');
	if (!env.IGDB_CLIENT_SECRET) throw missingKey('IGDB_CLIENT_SECRET');
	if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

	const url = new URL('https://id.twitch.tv/oauth2/token');
	url.searchParams.set('client_id', env.IGDB_CLIENT_ID);
	url.searchParams.set('client_secret', env.IGDB_CLIENT_SECRET);
	url.searchParams.set('grant_type', 'client_credentials');
	let data: { access_token: string; expires_in: number };
	try {
		data = await fetchJson('Twitch', url, { method: 'POST' });
	} catch (err) {
		// Twitch answers 400 for a wrong client ID/secret.
		if (err instanceof ProviderError && err.status === 400) {
			throw new ProviderError(serverMessages().errors.igdbBadClient);
		}
		throw err;
	}
	cachedToken = {
		value: data.access_token,
		expiresAt: Date.now() + (data.expires_in - 3600) * 1000
	};
	return cachedToken.value;
}

// IGDB uses its own query language ("Apicalypse") sent as the request body.
async function igdb<T>(endpoint: string, body: string, retry = true): Promise<T> {
	const token = await getToken();
	try {
		return await fetchJson<T>('IGDB', `https://api.igdb.com/v4/${endpoint}`, {
			method: 'POST',
			headers: {
				'Client-ID': env.IGDB_CLIENT_ID!,
				Authorization: `Bearer ${token}`,
				Accept: 'application/json'
			},
			body
		});
	} catch (err) {
		// Token may have been revoked: fetch a new one once and retry.
		if (retry && err instanceof ProviderError && err.status === 401) {
			cachedToken = null;
			return igdb<T>(endpoint, body, false);
		}
		throw err;
	}
}

const SEARCH_FIELDS = `fields ${GAME_FIELDS.join(',')},total_rating_count;`;
const SEARCH_LIMIT = 30;

// IGDB's full-text search ignores very common words, so a title made only of them
// ("We Were Here") finds nothing. Therefore a second query looks for names containing
// the text. Order: exact name, names starting with the text, full-text hits, other names.
export async function searchGames(query: string): Promise<SearchResult[]> {
	const safe = query.replace(/["\\]/g, ' ').trim();
	const [byText, byName] = await Promise.all([
		igdb<IgdbGame[]>(
			'games',
			`search "${safe}"; ${SEARCH_FIELDS} where version_parent = null; limit ${SEARCH_LIMIT};`
		),
		igdb<(IgdbGame & { total_rating_count?: number })[]>(
			'games',
			`${SEARCH_FIELDS} where name ~ *"${safe}"* & version_parent = null; sort total_rating_count desc; limit 20;`
		)
	]);

	const wanted = safe.toLowerCase();
	const rank = (name: string) => {
		const n = name.toLowerCase();
		return n === wanted ? 0 : n.startsWith(wanted) ? 1 : 2;
	};
	const top = byName.filter((g) => rank(g.name) < 2).sort((a, b) => rank(a.name) - rank(b.name));
	const rest = byName.filter((g) => rank(g.name) === 2);
	const seen = new Set<number>();
	return [...top, ...byText, ...rest]
		.filter((g) => !seen.has(g.id) && seen.add(g.id))
		.slice(0, SEARCH_LIMIT)
		.map(gameToResult);
}

// Unix seconds -> YYYY-MM-DD in the server timezone.
function dateOf(seconds: number | undefined) {
	return seconds ? new Date(seconds * 1000).toLocaleDateString('sv-SE') : null;
}

// Where a game stands, from its release dates. Only the current state counts: once the full
// version is out, an earlier early access no longer matters.
function releaseState(g: IgdbGame) {
	const dates = g.release_dates ?? [];
	const earliest = (list: typeof dates) =>
		list
			.map((d) => dateOf(d.date))
			.filter((d) => d !== null)
			.sort()[0] ?? null;
	const earlyDate = earliest(dates.filter((d) => d.status?.name === 'Early Access'));
	// Everything that is not a test phase or a cancellation counts as the full version.
	const NOT_FULL = ['Early Access', 'Alpha', 'Beta', 'Cancelled', 'Offline'];
	const fullDate = earliest(dates.filter((d) => !NOT_FULL.includes(d.status?.name ?? '')));
	const first = dateOf(g.first_release_date);

	const now = today();
	const fullyOut = fullDate !== null && fullDate <= now;
	// Early access is (or will be) the current release: it has a date and no full version is out.
	const viaEarlyAccess = earlyDate !== null && !fullyOut;
	return {
		// First day the game could be played at all
		playable: [earlyDate, fullDate, first].filter((d) => d !== null).sort()[0] ?? null,
		// The release that counts: start of early access, otherwise the full version
		current: viaEarlyAccess ? earlyDate : earlyDate && fullDate ? fullDate : (first ?? fullDate),
		viaEarlyAccess,
		fullDate: viaEarlyAccess ? fullDate : null,
		earlyAccess:
			!fullyOut &&
			((earlyDate !== null && earlyDate <= now) ||
				(g.game_status?.status === 'Early Access' && first !== null && first <= now))
	};
}

function gameToResult(g: IgdbGame): SearchResult {
	const state = releaseState(g);
	return {
		source: 'igdb',
		externalId: String(g.id),
		title: g.name,
		originalTitle: null,
		year: yearOf(state.current),
		releaseDate: state.playable,
		earlyAccess: state.earlyAccess,
		malId: null,
		posterUrl: g.cover ? `${COVER}${g.cover.image_id}.jpg` : null,
		overview: g.summary ?? null
	};
}

// ---- One game with everything the app needs ----

type IgdbGameFull = IgdbGame & {
	url: string;
	genres?: { name: string }[];
	platforms?: { name: string }[];
	total_rating?: number; // 0–100
	artworks?: { image_id: string }[];
	screenshots?: { image_id: string }[];
	involved_companies?: { developer: boolean; company: { name: string } }[];
	similar_games?: IgdbGame[];
};

const CACHE_MS = 10 * 60 * 1000;
const BACKDROP = 'https://images.igdb.com/igdb/image/upload/t_1080p/';

const FULL_FIELDS = [
	...GAME_FIELDS,
	'url',
	'genres.name',
	'platforms.name',
	'total_rating',
	'artworks.image_id',
	'screenshots.image_id',
	'involved_companies.developer',
	'involved_companies.company.name',
	...GAME_FIELDS.map((f) => `similar_games.${f}`)
];

// So many games are loaded with one request by the background refresh.
export const GAMES_PER_REQUEST = 50;

// Release dates and the detail page come from a single request – for one game or for many.
function fetchGames(ids: string[]) {
	return igdb<IgdbGameFull[]>(
		'games',
		`fields ${FULL_FIELDS.join(',')}; where id = (${ids.map(Number).join(',')}); limit ${ids.length};`
	);
}

function loadGame(id: string) {
	return cached(`igdb:${id}`, CACHE_MS, async () => {
		const [g] = await fetchGames([id]);
		if (!g) throw new ProviderError(serverMessages().errors.gameNotFound, 404);
		return g;
	});
}

// Background refresh: loads many games with one request and keeps the answers ready, so the
// following getGame…() calls for them need no request of their own.
export async function preloadGames(ids: string[]) {
	for (const g of await fetchGames(ids)) remember(`igdb:${g.id}`, CACHE_MS, g);
}

// ---- Release date (dashboard) ----

export async function getGameReleases(id: string): Promise<ReleaseInfo> {
	const g = await loadGame(id);
	const state = releaseState(g);
	const event = (kind: ReleaseEvent['kind'], date: string | null): ReleaseEvent => ({
		kind,
		date,
		season: null,
		episode: null
	});
	// Early access: its start and, once announced with a date, the full version.
	const events = state.viaEarlyAccess
		? [
				event('earlyAccess', state.current),
				...(state.fullDate ? [event('fullRelease', state.fullDate)] : [])
			]
		: [event('release', state.current)];
	return { item: gameToResult(g), events };
}

// ---- Detail page ----

export async function getGameInfo(id: string): Promise<Details> {
	const g = await loadGame(id);
	const backdrop = g.artworks?.[0] ?? g.screenshots?.[0];
	const developers = (g.involved_companies ?? [])
		.filter((c) => c.developer)
		.map((c) => c.company.name);
	const facts: Fact[] = [];
	const state = releaseState(g);
	if (state.viaEarlyAccess) {
		facts.push({ key: 'earlyAccess', value: state.current!, isDate: true });
		if (state.fullDate) facts.push({ key: 'fullRelease', value: state.fullDate, isDate: true });
	} else if (state.current) {
		facts.push({ key: 'fullRelease', value: state.current, isDate: true });
	}
	if (g.platforms?.length) {
		facts.push({ key: 'platforms', value: g.platforms.map((p) => p.name).join(', ') });
	}
	if (developers.length) facts.push({ key: 'developer', value: developers.join(', ') });

	return {
		item: gameToResult(g),
		externalUrl: g.url,
		sourceLabel: 'IGDB',
		backdropUrl: backdrop ? `${BACKDROP}${backdrop.image_id}.jpg` : null,
		genres: (g.genres ?? []).map((x) => x.name),
		rating: g.total_rating ? Math.round(g.total_rating) / 10 : null,
		runtime: null,
		seasonCount: null,
		episodeCount: null,
		episodeRuntime: null,
		format: null,
		facts,
		watch: null,
		links: [],
		similar: (g.similar_games ?? []).map(gameToResult)
	};
}
