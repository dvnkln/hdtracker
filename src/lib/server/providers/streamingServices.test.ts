import { describe, expect, it } from 'vitest';
import { mergeServices, withDirectLinks } from './streamingServices';

const names = (list: string[]) => mergeServices(list.map((name) => ({ name }))).map((s) => s.name);

describe('mergeServices', () => {
	it('folds plans into the service', () => {
		expect(names(['Netflix', 'Netflix Standard with Ads', 'Netflix Kids'])).toEqual(['Netflix']);
		expect(names(['Amazon Prime Video with Ads', 'Amazon Prime Video'])).toEqual([
			'Amazon Prime Video'
		]);
	});

	it('folds channels into the service, also with "Plus" for "+"', () => {
		expect(names(['HBO Max Amazon Channel', 'HBO Max'])).toEqual(['HBO Max']);
		expect(
			names(['Paramount+ Amazon Channel', 'Paramount Plus', 'Paramount Plus Apple TV Channel'])
		).toEqual(['Paramount Plus']);
		expect(names(['Apple TV Amazon Channel', 'Apple TV'])).toEqual(['Apple TV']);
		expect(names(['Crunchyroll', 'Crunchyroll Amazon Channel'])).toEqual(['Crunchyroll']);
		expect(names(['Paramount+ Roku Premium Channel', 'Paramount+'])).toEqual(['Paramount+']);
	});

	it('names a service that only comes as a channel like the service', () => {
		expect(names(['Filmlegenden Amazon Channel'])).toEqual(['Filmlegenden']);
		expect(names(['Wow Fiction Amazon Channel'])).toEqual(['WOW']);
		expect(names(['RTL+ Max Amazon Channel'])).toEqual(['RTL+']);
	});

	it('knows brands under another name', () => {
		expect(names(['Wow Fiction Amazon Channel', 'WOW'])).toEqual(['WOW']);
		expect(names(['RTL+ Max Amazon Channel', 'RTL+'])).toEqual(['RTL+']);
		expect(names(['Anime Digital Network Amazon Channel', 'Animation Digital Network'])).toEqual([
			'Animation Digital Network'
		]);
		expect(names(['ArthouseCNMA', 'Arthouse CNMA Amazon Channel'])).toEqual(['ArthouseCNMA']);
	});

	it('keeps the place of the best member and the logo of the service itself', () => {
		const merged = mergeServices([
			{ name: 'Netflix Kids', logoUrl: 'kids' },
			{ name: 'Disney Plus', logoUrl: 'disney' },
			{ name: 'Netflix', logoUrl: 'netflix' }
		]);
		expect(merged).toEqual([
			{ name: 'Netflix', logoUrl: 'netflix' },
			{ name: 'Disney Plus', logoUrl: 'disney' }
		]);
	});

	it('leaves different services and stores alone', () => {
		const list = ['Sky Go', 'WOW', 'Apple TV Store', 'YouTube Premium', 'Magenta TV+', 'MagentaTV'];
		expect(names(list.slice(0, 5))).toEqual(list.slice(0, 5));
		expect(names(['Apple TV', 'Apple TV Store'])).toEqual(['Apple TV', 'Apple TV Store']);
	});
});

describe('withDirectLinks', () => {
	const watch = {
		link: null,
		flatrate: [
			{ name: 'Crunchyroll', logoUrl: 'cr', url: 'https://www.crunchyroll.com/search?q=Frieren' },
			{ name: 'WOW', logoUrl: 'wow', url: 'https://tmdb/watch' }
		],
		rent: [{ name: 'Amazon Video', logoUrl: 'av', url: 'https://tmdb/watch' }],
		buy: []
	};

	it('takes the link of the same service, plans and channels included', () => {
		const result = withDirectLinks(watch, [
			{ name: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/GG5H5XQX4' },
			{ name: 'Hulu', url: 'https://www.hulu.com/series/frieren' }
		]);
		expect(result.flatrate.map((p) => p.url)).toEqual([
			'https://www.crunchyroll.com/series/GG5H5XQX4',
			'https://tmdb/watch'
		]);
		expect(result.rent).toEqual(watch.rent);
		expect(result.flatrate.map((p) => p.name)).toEqual(['Crunchyroll', 'WOW']);
	});

	it('ignores links that are no web address', () => {
		const result = withDirectLinks(watch, [{ name: 'Crunchyroll', url: 'javascript:alert(1)' }]);
		expect(result.flatrate[0].url).toBe('https://www.crunchyroll.com/search?q=Frieren');
	});
});
