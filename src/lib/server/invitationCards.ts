import { currentPart, groupAnime, type AnimeFacts } from '#lib/animeSeries.js';
import type { Status } from '#lib/status.js';
import type { Invitation } from './sharing';

// How the open invitations of the inbox are shown: one card each – except the seasons of one
// anime series from the same person, which are one card (decided with the user, 27.10.2026:
// only the seasons belong together; films and OVAs stay cards of their own). The card shows the
// first season and how many seasons; its status is the one of the season the person is on.
export type InvitationCard = {
	ids: number[];
	lead: Invitation;
	status: Status;
	// How many seasons the card stands for (0: a single title)
	seasons: number;
};

export function invitationCards(
	list: Invitation[],
	facts: Map<number, AnimeFacts>
): InvitationCard[] {
	// Seasons of one series from one person → one card, found per person
	const series = new Map<number, InvitationCard>();
	const byFrom = new Map<number, Invitation[]>();
	for (const invitation of list) {
		byFrom.set(invitation.from.id, [...(byFrom.get(invitation.from.id) ?? []), invitation]);
	}
	for (const own of byFrom.values()) {
		const hits = own
			.filter((i) => i.item.category === 'anime' && facts.has(i.item.id))
			.map((i) => ({
				externalId: i.item.externalId,
				year: i.item.year,
				anime: facts.get(i.item.id),
				status: i.status as Status | null,
				invitation: i
			}));
		for (const entry of groupAnime(hits)) {
			if (entry.kind !== 'series' || entry.seasons.length < 2) continue;
			const now = currentPart({ ...entry, movies: [], extras: [] })!;
			const card: InvitationCard = {
				ids: entry.seasons.map((h) => h.invitation.id),
				lead: entry.seasons[0].invitation,
				status: now.status!,
				seasons: entry.seasons.length
			};
			for (const id of card.ids) series.set(id, card);
		}
	}
	// In the order of the invitations; a series where its first invitation is
	const cards: InvitationCard[] = [];
	for (const invitation of list) {
		const card = series.get(invitation.id);
		if (!card)
			cards.push({ ids: [invitation.id], lead: invitation, status: invitation.status, seasons: 0 });
		else if (!cards.includes(card)) cards.push(card);
	}
	return cards;
}
