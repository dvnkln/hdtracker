import type { Person } from '#lib/avatar.js';

// Where tracking a title together stands for the user: who tracks along, and whom they could
// invite (`invitation` is set while one is open). Null while there is nobody to share with.
export type Sharing = {
	companions: Person[];
	candidates: { person: Person; invitation: number | null }[];
} | null;

// Puts it together from what a list page knows: everybody one could share with, who shares
// this title already, and the open invitations for it (user -> invitation).
export function sharingFor(
	people: Person[],
	companions: Person[] = [],
	invitations: Record<number, number> = {}
): Sharing {
	const inside = new Set(companions.map((person) => person.id));
	const candidates = people
		.filter((person) => !inside.has(person.id))
		.map((person) => ({ person, invitation: invitations[person.id] ?? null }));
	return companions.length + candidates.length > 0 ? { companions, candidates } : null;
}
