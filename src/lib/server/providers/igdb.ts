import { env } from '$env/dynamic/private';
import { cached } from '../cache';
import {
	ProviderError,
	fetchJson,
	germanDate,
	missingKey,
	type Details,
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
			throw new ProviderError('IGDB: Client-ID oder Secret ungültig – bitte .env prüfen.');
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

export async function searchGames(query: string): Promise<SearchResult[]> {
	const safe = query.replace(/["\\]/g, ' ');
	const games = await igdb<IgdbGame[]>(
		'games',
		`search "${safe}"; fields name,first_release_date,cover.image_id,summary; where version_parent = null; limit 30;`
	);
	return games.map(gameToResult);
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
		if (!g) throw new ProviderError('Spiel nicht gefunden.', 404);

		const backdrop = g.artworks?.[0] ?? g.screenshots?.[0];
		const developers = (g.involved_companies ?? [])
			.filter((c) => c.developer)
			.map((c) => c.company.name);
		const released = g.first_release_date
			? germanDate(new Date(g.first_release_date * 1000).toLocaleDateString('sv-SE'))
			: null;

		return {
			item: gameToResult(g),
			externalUrl: g.url,
			sourceLabel: 'IGDB',
			backdropUrl: backdrop ? `${BACKDROP}${backdrop.image_id}.jpg` : null,
			genres: (g.genres ?? []).map((x) => x.name),
			rating: g.total_rating ? Math.round(g.total_rating) / 10 : null,
			meta: [],
			facts: [
				...(released ? [{ label: 'Erschienen', value: released }] : []),
				...(g.platforms?.length
					? [{ label: 'Plattformen', value: g.platforms.map((p) => p.name).join(', ') }]
					: []),
				...(developers.length ? [{ label: 'Entwickler', value: developers.join(', ') }] : [])
			],
			watch: null,
			links: [],
			similar: (g.similar_games ?? []).map(gameToResult)
		};
	});
}
