// One logo per streaming service. TMDB/JustWatch list the same service several times: as plans
// ("Netflix Standard with Ads", "Netflix Kids") and as channels booked through another service
// ("Paramount+ Amazon Channel", "… Apple TV Channel"). Here they become one entry, named and
// drawn like the service itself. Works on one row (flat rate, rent or buy) at a time.

// Booked through somebody else.
const CHANNEL = /\s+(?:amazon channel|apple tv(?: plus)? channel|roku premium channel|via\s+.+)$/i;
// A plan of the same service. ("Premium" stays: "YouTube Premium" is not YouTube.)
const PLAN = /\s+(?:standard with ads|basic with ads|with ads|kids)$/i;

// Brands that appear under another name. Key after normalising → key and name of the service.
const ALIASES: Record<string, { key: string; name: string }> = {
	wowfiction: { key: 'wow', name: 'WOW' },
	'rtl+max': { key: 'rtl+', name: 'RTL+' },
	animedigitalnetwork: { key: 'animationdigitalnetwork', name: 'Animation Digital Network' }
};

function bare(name: string) {
	return name.replace(CHANNEL, '').replace(PLAN, '').trim();
}

// Which service an entry belongs to, its name, and whether it is the service itself.
function parse(name: string) {
	const stripped = bare(name);
	const normal = stripped
		.toLowerCase()
		.replace(/\bplus\b/g, '+')
		.replace(/[^a-z0-9+]/g, '');
	const alias = ALIASES[normal];
	return {
		key: alias?.key ?? normal,
		name: alias?.name ?? stripped,
		plain: !alias && stripped === name
	};
}

// The list is expected in display order; a merged entry keeps the place of its best member.
export function mergeServices<T extends { name: string }>(list: T[]): T[] {
	const groups = new Map<string, T[]>();
	for (const entry of list) {
		const { key } = parse(entry.name);
		groups.set(key, [...(groups.get(key) ?? []), entry]);
	}
	return [...groups.values()].map(
		(members) =>
			members.find((member) => parse(member.name).plain) ?? {
				...members[0],
				name: parse(members[0].name).name
			}
	);
}
