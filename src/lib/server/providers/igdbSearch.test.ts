import { describe, expect, it } from 'vitest';
import { orderGames } from './igdb';

const game = (id: number, name: string, version_parent?: number, game_type = 0) => ({
	id,
	name,
	version_parent,
	game_type
});
const names = (list: { name: string }[]) => list.map((g) => g.name);

describe('order of the games a search finds', () => {
	// What IGDB answers for "spiritfarer" (13.10.2026), shortened
	const byText = [
		game(119304, 'Spiritfarer'),
		game(218758, 'Spiritfarer: Lily Update', undefined, 14),
		game(187506, 'Spiritfarer: Farewell Edition', 119304, 3),
		game(375281, 'Spiritfarer: Netflix Edition', undefined, 11),
		game(204982, 'Spiritfarer: Digital Deluxe Edition', 119304)
	];

	it('finds the editions of a game too, after the games themselves', () => {
		const found = names(orderGames('spiritfarer', byText, byText));
		expect(found).toContain('Spiritfarer: Farewell Edition');
		expect(found).toEqual([
			'Spiritfarer',
			'Spiritfarer: Netflix Edition',
			'Spiritfarer: Farewell Edition',
			'Spiritfarer: Digital Deluxe Edition'
		]);
	});

	it('puts the exact name first, then names starting with the text, then the rest', () => {
		const byName = [game(3, 'Portal Knights'), game(1, 'Portal'), game(4, 'The Portal Wars')];
		const text = [game(2, 'Portal 2'), game(1, 'Portal')];
		expect(names(orderGames('portal', byName, text))).toEqual([
			'Portal',
			'Portal Knights',
			'Portal 2',
			'The Portal Wars'
		]);
	});

	it('an edition whose name is exactly what was typed still comes first', () => {
		const list = [game(1, 'Spiritfarer'), game(2, 'Spiritfarer: Farewell Edition', 1)];
		expect(names(orderGames('Spiritfarer: Farewell Edition', list, list))[0]).toBe(
			'Spiritfarer: Farewell Edition'
		);
	});

	it('leaves out updates, packs and mods – they are no titles one tracks', () => {
		const list = [
			game(1, 'Spiritfarer'),
			game(2, 'Spiritfarer: Lily Update', undefined, 14),
			game(3, 'Spiritfarer: Costume Pack', undefined, 13),
			game(4, 'Spiritfarer: Fan Mod', undefined, 5),
			game(5, 'Spiritfarer: An Expansion', undefined, 2),
			game(6, 'Spiritfarer: Story DLC', undefined, 1)
		];
		expect(names(orderGames('spiritfarer', list, list))).toEqual([
			'Spiritfarer',
			'Spiritfarer: An Expansion',
			'Spiritfarer: Story DLC'
		]);
	});

	it('lists nothing twice', () => {
		const list = [game(1, 'Portal'), game(1, 'Portal')];
		expect(orderGames('portal', list, list)).toHaveLength(1);
	});
});
