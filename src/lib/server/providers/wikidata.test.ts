import { describe, expect, it } from 'vitest';
import { mockFetch } from '../../../tests/helpers';
import { getStreamingLinks, preloadStreamingLinks } from './wikidata';

// What the query service answers: one row per title and ID at a streaming service.
const row = (id: string, property: string, value: string) => ({
	item: { value: `http://www.wikidata.org/entity/${id}` },
	p: { value: `http://www.wikidata.org/prop/direct/${property}` },
	v: { value }
});
const answer = (...rows: ReturnType<typeof row>[]) => ({ results: { bindings: rows } });

describe('preloadStreamingLinks', () => {
	it('asks for many titles with one request and stores every answer', async () => {
		const calls = mockFetch({
			'query.wikidata.org': (_url: string, body: string) => {
				const query = new URLSearchParams(body).get('query') ?? '';
				expect(query).toContain('wd:Q11 wd:Q12 wd:Q13');
				expect(query).toContain('wdt:P1874');
				return answer(
					row('Q11', 'P1874', '8011'),
					row('Q11', 'P9751', 'umc.11'),
					row('Q12', 'P8055', 'amzn12'),
					// A second value for the same service is ignored
					row('Q12', 'P8055', 'other')
				);
			}
		});
		// Doubles, empty and odd values are left out
		await preloadStreamingLinks(['Q11', 'Q12', 'Q13', 'Q11', null, 'nonsense']);
		expect(calls).toHaveLength(1);

		// Everything is answered from the store now – also the title without any link
		expect(await getStreamingLinks('Q11')).toEqual({
			netflix: 'https://www.netflix.com/title/8011',
			apple: 'https://tv.apple.com/show/umc.11'
		});
		expect(await getStreamingLinks('Q12')).toEqual({
			prime: 'https://www.primevideo.com/detail/amzn12'
		});
		expect(await getStreamingLinks('Q13')).toEqual({});
		expect(calls).toHaveLength(1);
	});

	it('does not ask again for titles with a fresh stored answer', async () => {
		const calls = mockFetch({
			'query.wikidata.org': (_url: string, body: string) => {
				const query = new URLSearchParams(body).get('query') ?? '';
				expect(query).toContain('wd:Q14');
				expect(query).not.toContain('wd:Q11');
				return answer(row('Q14', 'P1874', '8014'));
			}
		});
		await preloadStreamingLinks(['Q11', 'Q14']);
		await preloadStreamingLinks(['Q11', 'Q12', 'Q13', 'Q14']);
		expect(calls).toHaveLength(1);
	});

	it('throws when the service fails, and single titles still ask for themselves', async () => {
		const calls = mockFetch({
			'Special:EntityData/Q15': {
				entities: { Q15: { claims: { P1874: [{ mainsnak: { datavalue: { value: '8015' } } }] } } }
			}
		});
		await expect(preloadStreamingLinks(['Q15'])).rejects.toThrow();
		expect(await getStreamingLinks('Q15')).toEqual({
			netflix: 'https://www.netflix.com/title/8015'
		});
		expect(calls).toHaveLength(1);
	});
});
