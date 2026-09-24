import { cached } from '../cache';
import { fetchJson } from './types';

const DAY = 24 * 60 * 60 * 1000;
// Wikidata asks API users to identify themselves.
const USER_AGENT = 'hdtracker (self-hosted media tracker; https://github.com/dvnkln/hdtracker)';

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

// Direct links to a title on streaming services, if Wikidata knows them. Never throws.
export async function getStreamingLinks(wikidataId: string | null | undefined) {
	if (!wikidataId || !/^Q\d+$/.test(wikidataId)) return {};
	try {
		return await cached(`wikidata:${wikidataId}`, DAY, async () => {
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
						links[service as keyof StreamingLinks] = pattern.replace(
							'$1',
							encodeURIComponent(value)
						);
						break;
					}
				}
			}
			return links;
		});
	} catch (err) {
		console.error('Wikidata lookup failed', err);
		return {};
	}
}
