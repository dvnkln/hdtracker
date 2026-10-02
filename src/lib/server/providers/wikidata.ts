import { eq, lt } from 'drizzle-orm';
import pkg from '../../../../package.json';
import { getDb } from '../db';
import { wikidataLinks } from '../db/schema';
import { fetchJson } from './types';

const DAY = 24 * 60 * 60 * 1000;
// Links to streaming services rarely change: a stored answer is used for a month, so the
// nightly refresh of the library hardly ever asks Wikidata (they ask API users to cache).
const KEEP_MS = 30 * DAY;
// Wikimedia's User-Agent policy: name/version and a way to contact the operator.
const USER_AGENT = `hdtracker/${pkg.version} (https://github.com/dvnkln/hdtracker)`;

export type StreamingLinks = Partial<Record<'netflix' | 'disney' | 'prime' | 'apple', string>>;

// Wikidata properties holding a title's ID at a streaming service, with the link pattern
// taken from each property's "formatter URL". The first property found wins.
const PROPERTIES: Record<keyof StreamingLinks, [string, string][]> = {
	netflix: [['P1874', 'https://www.netflix.com/title/$1']],
	disney: [
		['P13902', 'https://www.disneyplus.com/browse/$1'],
		['P7596', 'https://www.disneyplus.com/series/wp/$1'],
		['P7595', 'https://www.disneyplus.com/movies/wd/$1']
	],
	prime: [
		['P14440', 'https://www.primevideo.com/detail/$1'],
		['P8055', 'https://www.primevideo.com/detail/$1']
	],
	apple: [
		['P9751', 'https://tv.apple.com/show/$1'],
		['P9586', 'https://tv.apple.com/movie/$1']
	]
};

type Entity = { claims: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]> };

// Requests for the same title that arrive together share one lookup.
const loading = new Map<string, Promise<StreamingLinks>>();

// Reads the whole entry of a title (Wikidata's "Linked Data Interface", meant for single
// known entries) and picks the IDs at the streaming services.
async function lookUp(wikidataId: string): Promise<StreamingLinks> {
	const data = await fetchJson<{ entities: Record<string, Entity> }>(
		'Wikidata',
		`https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`,
		{ headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } }
	);
	const claims = Object.values(data.entities)[0]?.claims ?? {};
	const links: StreamingLinks = {};
	for (const [service, props] of Object.entries(PROPERTIES)) {
		for (const [prop, pattern] of props) {
			const value = claims[prop]?.[0]?.mainsnak.datavalue?.value;
			if (typeof value === 'string' && value) {
				links[service as keyof StreamingLinks] = pattern.replace('$1', encodeURIComponent(value));
				break;
			}
		}
	}
	return links;
}

// Direct links to a title on streaming services, if Wikidata knows them. Never throws.
export async function getStreamingLinks(
	wikidataId: string | null | undefined
): Promise<StreamingLinks> {
	if (!wikidataId || !/^Q\d+$/.test(wikidataId)) return {};
	const db = getDb();
	const stored = db.select().from(wikidataLinks).where(eq(wikidataLinks.id, wikidataId)).get();
	if (stored && stored.fetchedAt.getTime() > Date.now() - KEEP_MS) return stored.links;

	let pending = loading.get(wikidataId);
	if (!pending) {
		pending = lookUp(wikidataId)
			.then((links) => {
				const values = { links, fetchedAt: new Date() };
				db.insert(wikidataLinks)
					.values({ id: wikidataId, ...values })
					.onConflictDoUpdate({ target: wikidataLinks.id, set: values })
					.run();
				return links;
			})
			.catch((err) => {
				console.error('Wikidata lookup failed', err);
				// Wikidata cannot be reached: an older answer is better than none.
				return stored?.links ?? {};
			})
			.finally(() => loading.delete(wikidataId));
		loading.set(wikidataId, pending);
	}
	return pending;
}

// Removes answers that were not renewed for two months (titles nobody looks at any more).
export function pruneWikidataLinks() {
	return getDb()
		.delete(wikidataLinks)
		.where(lt(wikidataLinks.fetchedAt, new Date(Date.now() - 2 * KEEP_MS)))
		.run().changes;
}
