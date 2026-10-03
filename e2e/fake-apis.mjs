// Loaded into the server process of the browser tests (node --import): replaces fetch, so the
// app never talks to a real data source. Known addresses are answered with the made-up titles
// from fixtures.mjs, image servers with a one-pixel picture, anything else fails loudly.
// The app itself has no test mode – this file is all there is.
import { zstdCompressSync } from 'node:zlib';
import {
	ANIME,
	ANIME_MAPPING,
	ANIME_PAST,
	ANIME_SHOWS,
	GAMES,
	MOVIES,
	SERIES
} from './fixtures.mjs';

const PIXEL = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);
const json = (data, status = 200) =>
	new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const has = (text, query) => text.toLowerCase().includes(query.toLowerCase());

function tmdb(url) {
	const path = url.pathname.replace('/3', '');
	const query = url.searchParams.get('query') ?? '';
	if (path === '/search/movie') return json({ results: MOVIES.filter((m) => has(m.title, query)) });
	if (path === '/search/tv') return json({ results: SERIES.filter((s) => has(s.name, query)) });
	if (path === '/watch/providers/regions')
		return json({ results: [{ iso_3166_1: 'US' }, { iso_3166_1: 'DE' }] });
	if (path === '/configuration/primary_translations') return json(['en-US', 'de-DE']);
	const [, kind, id] = /^\/(movie|tv)\/(\d+)$/.exec(path) ?? [];
	const found = (kind === 'movie' ? MOVIES : [...SERIES, ...ANIME_SHOWS]).find(
		(t) => String(t.id) === id
	);
	return found ? json(found) : json({ status_code: 34, status_message: 'Not found' }, 404);
}

// IGDB's query language: search "…", where name ~ *"…"*, where id = (1,2)
function igdb(body) {
	const ids = /where id = \(([\d,\s]+)\)/.exec(body)?.[1];
	if (ids) {
		const wanted = ids.split(',').map((id) => Number(id.trim()));
		return json(GAMES.filter((g) => wanted.includes(g.id)));
	}
	const text = /search "([^"]*)"/.exec(body)?.[1] ?? /name ~ \*"([^"]*)"\*/.exec(body)?.[1] ?? '';
	return json(GAMES.filter((g) => has(g.name, text)));
}

function anilist(body) {
	const { query, variables } = JSON.parse(body);
	if (variables.search !== undefined) {
		return json({
			data: { Page: { media: ANIME.filter((a) => has(a.title.english, variables.search)) } }
		});
	}
	if (query.includes('idMal_in')) {
		return json({
			data: { Page: { media: ANIME.filter((a) => variables.ids.includes(a.idMal)) } }
		});
	}
	const past = {
		pageInfo: { hasNextPage: false },
		airingSchedules: ANIME_PAST.filter((p) => variables.ids.includes(p.mediaId))
	};
	const media = ANIME.filter((a) => variables.ids.includes(a.id));
	return json({ data: query.includes('media(id_in') ? { Page: { media }, past } : { past } });
}

const IMAGE_HOSTS = ['image.tmdb.org', 'images.igdb.com'];
const blocked = [];

globalThis.fetch = async (input, init) => {
	const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
	const body = typeof init?.body === 'string' ? init.body : '';
	if (url.host === 'api.themoviedb.org') return tmdb(url);
	if (url.host === 'id.twitch.tv')
		return json({ access_token: 'test-token', expires_in: 5_000_000 });
	if (url.host === 'api.igdb.com') return igdb(body);
	if (url.host === 'graphql.anilist.co') return anilist(body);
	if (url.href.startsWith('https://github.com/anibridge/anibridge-mappings/releases/')) {
		return new Response(zstdCompressSync(JSON.stringify(ANIME_MAPPING)));
	}
	if (url.host === 'query.wikidata.org') {
		// The same for many titles at once (background refresh)
		const row = {
			item: { value: 'http://www.wikidata.org/entity/Q101' },
			p: { value: 'http://www.wikidata.org/prop/direct/P1874' },
			v: { value: '80000101' }
		};
		return json({
			results: { bindings: decodeURIComponent(body).includes('wd:Q101') ? [row] : [] }
		});
	}
	if (url.host === 'www.wikidata.org') {
		// The movie with a streaming offer has a Netflix ID at "Wikidata"
		return json({
			entities: {
				Q101: { claims: { P1874: [{ mainsnak: { datavalue: { value: '80000101' } } }] } }
			}
		});
	}
	if (IMAGE_HOSTS.includes(url.host) || url.host.endsWith('.anilist.co')) {
		return new Response(PIXEL, { headers: { 'Content-Type': 'image/png' } });
	}
	blocked.push(url.href);
	console.error(`FAKE-APIS blocked a request to ${url.href}`);
	throw new Error(`Browser tests must not reach the network: ${url.href}`);
};
