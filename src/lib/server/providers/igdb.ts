import { env } from '$env/dynamic/private';
import { cached } from '../cache';
import { serverMessages } from '../i18n';
import {
	ProviderError,
	fetchJson,
	missingKey,
	type Details,
	type Fact,
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
};

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

const SEARCH_FIELDS = 'fields name,first_release_date,cover.image_id,summary,total_rating_count;';
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

function gameToResult(g: IgdbGame): SearchResult {
	return {
		source: 'igdb',
		externalId: String(g.id),
		title: g.name,
		originalTitle: null,
		year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
		posterUrl: g.cover ? `${COVER}${g.cover.image_id}.jpg` : null,
		overview: g.summary ?? null
	};
}

// ---- Release date (dashboard) ----

export async function getGameReleases(id: string): Promise<ReleaseInfo> {
	const [g] = await igdb<IgdbGame[]>(
		'games',
		`fields name,first_release_date,cover.image_id,summary; where id = ${Number(id)};`
	);
	if (!g) throw new ProviderError(serverMessages().errors.gameNotFound, 404);
	const date = g.first_release_date
		? new Date(g.first_release_date * 1000).toLocaleDateString('sv-SE')
		: null;
	return {
		item: gameToResult(g),
		events: [{ kind: 'release', date, season: null, episode: null }]
	};
}

// ---- Detail page ----

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

export function getGameInfo(id: string): Promise<Details> {
	return cached(`igdb-info:${id}`, CACHE_MS, async () => {
		const [g] = await igdb<IgdbGameFull[]>(
			'games',
			`fields name,url,first_release_date,cover.image_id,summary,genres.name,platforms.name,total_rating,artworks.image_id,screenshots.image_id,involved_companies.developer,involved_companies.company.name,similar_games.name,similar_games.cover.image_id,similar_games.first_release_date,similar_games.summary; where id = ${Number(id)};`
		);
		if (!g) throw new ProviderError(serverMessages().errors.gameNotFound, 404);

		const backdrop = g.artworks?.[0] ?? g.screenshots?.[0];
		const developers = (g.involved_companies ?? [])
			.filter((c) => c.developer)
			.map((c) => c.company.name);
		const facts: Fact[] = [];
		if (g.first_release_date) {
			const released = new Date(g.first_release_date * 1000).toLocaleDateString('sv-SE');
			facts.push({ key: 'released', value: released, isDate: true });
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
	});
}
