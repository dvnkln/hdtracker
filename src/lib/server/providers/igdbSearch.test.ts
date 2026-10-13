import { describe, expect, it } from 'vitest';
import { orderGames } from './igdb';

const game = (id: number, name: string, version_parent?: number) => ({ id, name, version_parent });
const names = (list: { name: string }[]) => list.map((g) => g.name);

describe('order of the games a search finds', () => {
	// What IGDB answers for "spiritfarer" (13.10.2026), shortened
	const byText = [
		game(119304, 'Spiritfarer'),
		game(218758, 'Spiritfarer: Lily Update'),
		game(187506, 'Spiritfarer: Farewell Edition', 119304),
		game(375281, 'Spiritfarer: Netflix Edition'),
		game(204982, 'Spiritfarer: Digital Deluxe Edition', 119304)
	];

	it('finds the editions of a game too, after the games themselves', () => {
		const found = names(orderGames('spiritfarer', byText, byText));
		expect(found).toContain('Spiritfarer: Farewell Edition');
		expect(found).toEqual([
			'Spiritfarer',
			'Spiritfarer: Lily Update',
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

	it('lists nothing twice', () => {
		const list = [game(1, 'Portal'), game(1, 'Portal')];
		expect(orderGames('portal', list, list)).toHaveLength(1);
	});
});
