import { describe, expect, it } from 'vitest';
import { mergeServices, serviceKey, storeService, withDirectLinks } from './streamingServices';

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

	it('leaves out a channel whose service is not listed itself', () => {
		expect(names(['ARD Plus Amazon Channel', 'Netflix'])).toEqual(['Netflix']);
		// As TMDB sent it for "The Whale": a space at the end, a channel in lower case
		expect(
			names([
				'ARD Plus',
				'ARD Plus Apple TV channel',
				'ARD Plus Amazon channel ',
				'HBO Max',
				'HBO Max Amazon Channel'
			])
		).toEqual(['ARD Plus', 'HBO Max']);
		expect(names(['Filmlegenden Amazon Channel'])).toEqual([]);
		expect(names(['Wow Fiction Amazon Channel', 'Paramount+ Apple TV Channel'])).toEqual([]);
		// A plan alone is the service itself
		expect(names(['Netflix Standard with Ads'])).toEqual(['Netflix']);
		expect(names(['RTL+ Max'])).toEqual(['RTL+']);
	});

	it('reads channels and plans the way TMDB writes them, typos included', () => {
		expect(names(['Wild West Amzon Channel', 'Netflix'])).toEqual(['Netflix']);
		expect(names(['Amazon Arthaus Channel', 'Arthaus+'])).toEqual(['Arthaus+']);
		expect(names([' AXN White Amazon Channel ', 'Here TV  Amazon Channel', 'Here TV'])).toEqual([
			'Here TV'
		]);
		expect(names(['Peacock Premium', 'Peacock Premium Plus'])).toEqual(['Peacock']);
		expect(
			names([
				'Paramount Plus Premium',
				'Paramount+ Amazon Channel',
				'Paramount+ Roku Premium Channel'
			])
		).toEqual(['Paramount Plus']);
		expect(names(['ViX Premium Amazon Channel'])).toEqual([]);
		expect(names(['YouTube Premium'])).toEqual(['YouTube Premium']);
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

describe('storeService', () => {
	it('puts stores to rent or buy with the streaming service they belong to', () => {
		expect(storeService('Amazon Video')).toEqual({
			key: serviceKey('Amazon Prime Video'),
			name: 'Amazon Prime Video',
			known: true
		});
		expect(storeService('Apple TV Store')).toMatchObject({ key: serviceKey('Apple TV') });
		// A store of its own: a service only where it also streams
		expect(storeService('Apple TV')).toEqual({ key: 'appletv', name: 'Apple TV', known: false });
		expect(storeService('Videoload')).toEqual({
			key: 'videoload',
			name: 'Videoload',
			known: false
		});
		expect(storeService('Sky Store').key).not.toBe(serviceKey('WOW'));
	});
});
