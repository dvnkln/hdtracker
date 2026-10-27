import { describe, expect, it } from 'vitest';
import type { AnimeFacts } from '#lib/animeSeries.js';
import type { Status } from '#lib/status.js';
import { invitationCards } from './invitationCards';
import type { Invitation } from './sharing';

const person = (id: number) => ({ id, name: `P${id}`, color: 0, picture: null });
let n = 0;
function invitation(
	itemId: number,
	from: number,
	status: Status,
	category: 'anime' | 'movies' = 'anime'
): Invitation {
	return {
		id: ++n,
		createdAt: new Date(),
		item: {
			id: itemId,
			category,
			externalId: String(itemId),
			year: 2000 + itemId,
			title: `T${itemId}`
		},
		from: person(from),
		to: person(9),
		status
	} as unknown as Invitation;
}
const facts = (format: string, year: number, links: [string, number][]): AnimeFacts => ({
	format,
	episodes: 12,
	season: null,
	start: `${year}-01-01`,
	links: links.map(([type, id]) => ({ type, id: String(id), format: 'TV' }))
});

describe('invitationCards', () => {
	const FACTS = new Map<number, AnimeFacts>([
		[1, facts('TV', 2016, [['SEQUEL', 2]])],
		[
			2,
			facts('TV', 2017, [
				['PREQUEL', 1],
				['SEQUEL', 3]
			])
		],
		[3, facts('TV', 2018, [['PREQUEL', 2]])],
		[4, facts('MOVIE', 2019, [['PARENT', 2]])]
	]);

	it('makes one card of the seasons of a series from one person – not of its film', () => {
		const list = [
			invitation(7, 1, 'planned', 'movies'),
			invitation(2, 1, 'active'),
			invitation(1, 1, 'completed'),
			invitation(4, 1, 'completed'),
			invitation(3, 1, 'planned')
		];
		const cards = invitationCards(list, FACTS);
		expect(cards.map((c) => [c.lead.item.id, c.seasons, c.ids.length, c.status])).toEqual([
			[7, 0, 1, 'planned'],
			// The seasons, in order, under the first one; the status of the one being watched
			[1, 3, 3, 'active'],
			[4, 0, 1, 'completed']
		]);
	});

	it('keeps invitations of different people apart', () => {
		const cards = invitationCards([invitation(1, 1, 'active'), invitation(2, 2, 'active')], FACTS);
		expect(cards.map((c) => c.seasons)).toEqual([0, 0]);
	});
});
