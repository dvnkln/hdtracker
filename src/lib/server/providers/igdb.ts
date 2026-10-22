import { IGDB_CLIENT_ID, IGDB_CLIENT_SECRET } from '$app/env/private';
import { cached, remember } from '../cache';
import { igdbTrailer } from './trailer';
import { STORE_KEYS, type Store, type StoreKey } from '#lib/stores.js';
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
	if (!IGDB_CLIENT_ID) throw missingKey('IGDB_CLIENT_ID');
	if (!IGDB_CLIENT_SECRET) throw missingKey('IGDB_CLIENT_SECRET');
	if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

	const url = new URL('https://id.twitch.tv/oauth2/token');
	url.searchParams.set('client_id', IGDB_CLIENT_ID);
	url.searchParams.set('client_secret', IGDB_CLIENT_SECRET);
	url.searchParams.set('grant_type', 'client_credentials');
	let data: { access_token: string; expires_in: number };
	try {
		data = await fetchJson('Twitch', url, { method: 'POST' });
	} catch (err) {
		// Twitch answers 400 for a wrong client ID, 403 for a wrong secret.
		if (err instanceof ProviderError && [400, 401, 403].includes(err.status ?? 0)) {
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
				'Client-ID': IGDB_CLIENT_ID!,
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

const SEARCH_FIELDS = `fields ${GAME_FIELDS.join(',')},total_rating_count,version_parent,game_type;`;
const SEARCH_LIMIT = 30;

// IGDB's full-text search ignores very common words, so a title made only of them
// ("We Were Here") finds nothing. Therefore a second query looks for names containing
// the text.
export async function searchGames(query: string): Promise<SearchResult[]> {
	const safe = query.replace(/["\\]/g, ' ').trim();
	const [byText, byName] = await Promise.all([
		igdb<SearchHit[]>('games', `search "${safe}"; ${SEARCH_FIELDS} limit ${SEARCH_LIMIT};`),
		igdb<SearchHit[]>(
			'games',
			`${SEARCH_FIELDS} where name ~ *"${safe}"*; sort total_rating_count desc; limit ${SEARCH_LIMIT};`
		)
	]);
	return orderGames(safe, byName, byText).slice(0, SEARCH_LIMIT).map(gameToResult);
}

type SearchHit = IgdbGame & {
	total_rating_count?: number;
	version_parent?: number;
	game_type?: number;
};

// Kinds of entries (IGDB `game_types`) that are no titles one tracks: 5 = mod, 13 = pack or
// add-on, 14 = update ("Spiritfarer: Lily Update"). Everything else stays – games, expansions,
// remakes, bundles, ports, DLC.
const NOT_A_TITLE = [5, 13, 14];

// The order of the results: the exact name, names starting with the text, full-text hits,
// other names. Within each of these the games themselves come before their editions
// ("Farewell Edition", "Digital Deluxe Edition" – entries with a `version_parent`): editions
// used to be left out altogether, but some are what people own and track, and then they could
// not be found (reported 13.10.2026: "Spiritfarer: Farewell Edition").
export function orderGames<
	G extends { id: number; name: string; version_parent?: number; game_type?: number }
>(text: string, byName: G[], byText: G[]): G[] {
	const wanted = text.toLowerCase();
	const rank = (name: string) => {
		const n = name.toLowerCase();
		return n === wanted ? 0 : n.startsWith(wanted) ? 1 : 2;
	};
	const edition = (game: G) => (game.version_parent ? 1 : 0);
	// (sort() keeps the given order among equals)
	const gamesFirst = (list: G[]) => [...list].sort((a, b) => edition(a) - edition(b));
	const groups = [
		byName.filter((g) => rank(g.name) === 0),
		byName.filter((g) => rank(g.name) === 1),
		byText,
		byName.filter((g) => rank(g.name) === 2)
	];
	const seen = new Set<number>();
	return groups
		.flatMap(gamesFirst)
		.filter((g) => !NOT_A_TITLE.includes(g.game_type ?? 0))
		.filter((g) => !seen.has(g.id) && seen.add(g.id));
}

// Unix seconds -> YYYY-MM-DD in the server timezone.
function dateOf(seconds: number | undefined) {
	return seconds ? new Date(seconds * 1000).toLocaleDateString('sv-SE') : null;
}

// Where a game stands, from its release dates. Only the current state counts: once the full
// version is out, an earlier early access no longer matters.
export function releaseState(g: IgdbGame) {
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
	videos?: { id: number; video_id: string; name?: string }[];
	websites?: { type?: number; url?: string }[];
	external_games?: { external_game_source?: number; url?: string }[];
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
	'videos.video_id',
	'videos.name',
	'involved_companies.developer',
	'involved_companies.company.name',
	'websites.type',
	'websites.url',
	'external_games.external_game_source',
	'external_games.url',
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

// ---- Stores ----

// IGDB names a game's stores in two lists: `websites` (by `website_types`) and `external_games`
// (by `external_game_sources`). Most links are in the first; the second fills gaps. Amazon is
// left out (dozens of entries per country, mostly without a link), as is Game Pass (IGDB only
// knows the cloud catalogue, and whether it is current cannot be told).
const WEBSITE_STORES: Partial<Record<number, StoreKey>> = {
	13: 'steam',
	16: 'epic',
	17: 'gog',
	22: 'xbox',
	23: 'playstation',
	24: 'nintendo',
	15: 'itch',
	10: 'appstore', // iPhone
	11: 'appstore', // iPad
	12: 'googleplay',
	25: 'meta',
	26: 'gamejolt'
};
const EXTERNAL_STORES: Partial<Record<number, StoreKey>> = {
	1: 'steam',
	26: 'epic',
	5: 'gog',
	11: 'xbox',
	36: 'playstation',
	30: 'itch',
	13: 'appstore',
	28: 'meta',
	55: 'gamejolt'
};

// The hosts each store lives at: a link goes into the page only if it really leads there.
const STORE_HOSTS: Record<StoreKey, string[]> = {
	steam: ['store.steampowered.com'],
	epic: ['epicgames.com', 'store.epicgames.com', 'www.epicgames.com'],
	gog: ['gog.com', 'www.gog.com'],
	xbox: ['www.xbox.com', 'www.microsoft.com'],
	playstation: ['store.playstation.com'],
	nintendo: ['www.nintendo.com'],
	itch: ['itch.io'],
	appstore: ['apps.apple.com', 'itunes.apple.com'],
	googleplay: ['play.google.com'],
	meta: ['www.meta.com', 'www.oculus.com'],
	gamejolt: ['gamejolt.com']
};

function storeLink(key: StoreKey, raw: string | undefined) {
	let url: URL;
	try {
		url = new URL(raw ?? '');
	} catch {
		return null;
	}
	const hosts = STORE_HOSTS[key];
	const fits =
		hosts.includes(url.hostname) || (key === 'itch' && url.hostname.endsWith('.itch.io'));
	if (url.protocol !== 'https:' || !fits) return null;
	// IGDB links the US store of PlayStation and Xbox. Without the country part both forward to
	// the store of the visitor's country (tried out); Steam, Epic and GOG do so by themselves.
	// Nintendo has no such address – its European store is a different site.
	if (key === 'playstation' || (key === 'xbox' && url.hostname === 'www.xbox.com')) {
		url.pathname = url.pathname.replace(/^\/[a-z]{2}-[a-z]{2}(?=\/)/i, '');
	}
	return url.toString();
}

// The stores of a game, one link each, in a fixed order.
export function storesOf(g: Pick<IgdbGameFull, 'websites' | 'external_games'>): Store[] {
	const found = new Map<StoreKey, string>();
	const add = (key: StoreKey | undefined, raw: string | undefined) => {
		if (!key || found.has(key)) return;
		const url = storeLink(key, raw);
		if (url) found.set(key, url);
	};
	for (const site of g.websites ?? []) add(WEBSITE_STORES[site.type ?? -1], site.url);
	for (const ext of g.external_games ?? []) {
		add(EXTERNAL_STORES[ext.external_game_source ?? -1], ext.url);
	}
	return STORE_KEYS.filter((key) => found.has(key)).map((key) => ({ key, url: found.get(key)! }));
}

// ---- Detail page ----

// IGDB's name of a platform, shorter where it is long for no use. "PC (Microsoft Windows)" is
// "Windows", not "PC": Mac and Linux run on PCs too.
export const platformName = (name: string) =>
	name === 'PC (Microsoft Windows)' ? 'Windows' : name;

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
	const platforms = (g.platforms ?? []).map((p) => platformName(p.name));
	if (platforms.length) facts.push({ key: 'platforms', value: platforms.join(', ') });
	if (developers.length) facts.push({ key: 'developer', value: developers.join(', ') });

	return {
		item: gameToResult(g),
		externalUrl: g.url,
		sourceLabel: 'IGDB',
		backdropUrl: backdrop ? `${BACKDROP}${backdrop.image_id}.jpg` : null,
		trailerUrl: igdbTrailer(g.videos),
		genres: (g.genres ?? []).map((x) => x.name),
		rating: g.total_rating ? Math.round(g.total_rating) / 10 : null,
		runtime: null,
		seasonCount: null,
		episodeCount: null,
		episodeRuntime: null,
		format: null,
		facts,
		watch: null,
		stores: storesOf(g),
		platforms,
		links: [],
		similar: (g.similar_games ?? []).map(gameToResult)
	};
}
