import { describe, expect, it } from 'vitest';
import { platformName, storesOf } from './igdb';

describe('storesOf', () => {
	it('takes the stores from the websites, in a fixed order, one link each', () => {
		const stores = storesOf({
			websites: [
				{ type: 1, url: 'https://www.dredge.game' }, // official site: not a store
				{ type: 17, url: 'https://www.gog.com/game/dredge' },
				{ type: 13, url: 'https://store.steampowered.com/app/1562430' },
				{ type: 10, url: 'https://apps.apple.com/app/dredge/id1' },
				{ type: 11, url: 'https://apps.apple.com/app/dredge/id2' } // iPad: same store
			]
		});
		expect(stores).toEqual([
			{ key: 'steam', url: 'https://store.steampowered.com/app/1562430' },
			{ key: 'gog', url: 'https://www.gog.com/game/dredge' },
			{ key: 'appstore', url: 'https://apps.apple.com/app/dredge/id1' }
		]);
	});

	it('fills gaps from the external games, but leaves Amazon and Game Pass out', () => {
		const stores = storesOf({
			websites: [{ type: 13, url: 'https://store.steampowered.com/app/1' }],
			external_games: [
				{ external_game_source: 1, url: 'https://store.steampowered.com/app/other' },
				{ external_game_source: 26, url: 'https://store.epicgames.com/en-US/p/game' },
				{ external_game_source: 20, url: 'https://amazon.de/dp/B0' },
				{ external_game_source: 54, url: 'https://www.microsoft.com/en-us/p/-1-/9P' }
			]
		});
		expect(stores).toEqual([
			{ key: 'steam', url: 'https://store.steampowered.com/app/1' },
			{ key: 'epic', url: 'https://store.epicgames.com/en-US/p/game' }
		]);
	});

	it('sends PlayStation and Xbox to the store of the visitor, not the US one', () => {
		const stores = storesOf({
			websites: [
				{ type: 23, url: 'https://store.playstation.com/en-us/concept/10010334' },
				{ type: 22, url: 'https://www.xbox.com/en-us/games/store/balatro/9PK087LNGJC5' },
				{ type: 24, url: 'https://www.nintendo.com/us/store/products/balatro-switch/' }
			]
		});
		expect(stores.map((store) => store.url)).toEqual([
			'https://store.playstation.com/concept/10010334',
			'https://www.xbox.com/games/store/balatro/9PK087LNGJC5',
			// Nintendo has no address for "your country": stays as it is
			'https://www.nintendo.com/us/store/products/balatro-switch/'
		]);
	});

	it('only takes links that really lead to the store', () => {
		const stores = storesOf({
			websites: [
				{ type: 13, url: 'https://evil.example/store.steampowered.com' },
				{ type: 17, url: 'http://www.gog.com/game/x' }, // no https
				{ type: 16, url: 'javascript:alert(1)' },
				{ type: 23 }, // no link at all
				{ type: 15, url: 'https://thunderlotus.itch.io/spiritfarer' },
				{ type: 26, url: 'https://gamejolt.com.evil.example/games/x' }
			]
		});
		expect(stores).toEqual([{ key: 'itch', url: 'https://thunderlotus.itch.io/spiritfarer' }]);
	});

	it('gives an empty list when IGDB knows no store', () => {
		expect(storesOf({})).toEqual([]);
	});
});

describe('platformName', () => {
	it('calls the Windows PC "Windows" (Mac and Linux run on PCs too)', () => {
		expect(platformName('PC (Microsoft Windows)')).toBe('Windows');
		expect(platformName('Nintendo Switch')).toBe('Nintendo Switch');
	});
});
