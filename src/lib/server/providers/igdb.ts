import { env } from '$env/dynamic/private';
import { ProviderError, fetchJson, missingKey, type SearchResult } from './types';

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
	return games.map((g) => ({
		source: 'igdb',
		externalId: String(g.id),
		title: g.name,
		originalTitle: null,
		year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
		posterUrl: g.cover ? `${COVER}${g.cover.image_id}.jpg` : null,
		overview: g.summary ?? null
	}));
}
