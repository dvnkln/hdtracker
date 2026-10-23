// One logo per streaming service. TMDB/JustWatch list the same service several times: as plans
// ("Netflix Standard with Ads", "Netflix Kids") and as channels booked through another service
// ("Paramount+ Amazon Channel", "… Apple TV Channel"). Here they become one entry, named and
// drawn like the service itself. A channel whose service is not listed itself is left out: it
// is booked through Prime Video or Apple TV, so it is no service of its own to look for (wish
// of the user, 2026-10-23: "ARD Plus Amazon Channel" stood as a service of its own). Works on
// one row (flat rate, rent or buy) at a time.

// Booked through somebody else. (TMDB also writes "Amzon", and "Amazon Arthaus Channel".)
const CHANNEL =
	/\s+(?:am(?:a)?zon channel|apple tv(?: plus)? channel|roku premium channel|via\s+.+)$/i;
const CHANNEL_FIRST = /^am(?:a)?zon\s+(.+?)\s+channel$/i;
// A plan of the same service ("Peacock Premium Plus", "Paramount Plus Premium" …)
const PLAN =
	/\s+(?:standard with ads|basic with ads|with ads|kids|premium plus|premium|essential)$/i;
// Names that only look like a plan: YouTube Premium is not the YouTube store
const NO_PLAN = new Set(['youtube premium']);

// Brands that appear under another name. Key after normalising → key and name of the service.
const ALIASES: Record<string, { key: string; name: string }> = {
	wowfiction: { key: 'wow', name: 'WOW' },
	'rtl+max': { key: 'rtl+', name: 'RTL+' },
	animedigitalnetwork: { key: 'animationdigitalnetwork', name: 'Animation Digital Network' },
	arthaus: { key: 'arthaus+', name: 'Arthaus+' }
};

function bare(name: string) {
	const channel = name.replace(CHANNEL_FIRST, '$1').replace(CHANNEL, '').trim();
	return NO_PLAN.has(channel.toLowerCase()) ? channel : channel.replace(PLAN, '').trim();
}

// Which service an entry belongs to, its name, and whether it is the service itself.
// (TMDB sometimes sends a name with a space at the end: "ARD Plus Amazon channel ".)
function parse(raw: string) {
	const name = raw.trim();
	const stripped = bare(name);
	const normal = stripped
		.toLowerCase()
		.replace(/\bplus\b/g, '+')
		.replace(/[^a-z0-9+]/g, '');
	const alias = ALIASES[normal];
	return {
		key: alias?.key ?? normal,
		name: alias?.name ?? stripped,
		plain: !alias && stripped === name,
		channel: CHANNEL.test(name) || CHANNEL_FIRST.test(name)
	};
}

// The list is expected in display order; a merged entry keeps the place of its best member.
export function mergeServices<T extends { name: string }>(list: T[]): T[] {
	const groups = new Map<string, T[]>();
	for (const entry of list) {
		const { key } = parse(entry.name);
		groups.set(key, [...(groups.get(key) ?? []), entry]);
	}
	return [...groups.values()]
		.filter((members) => members.some((member) => !parse(member.name).channel))
		.map(
			(members) =>
				members.find((member) => parse(member.name).plain) ?? {
					...members[0],
					name: parse(members[0].name).name
				}
		);
}

// Which service a name belongs to (the same for its plans and channels)
export function serviceKey(name: string) {
	return parse(name).key;
}

// Whether two names mean the same service (plans and channels included).
export function sameService(a: string, b: string) {
	return serviceKey(a) === serviceKey(b);
}

// Stores to rent or buy at that belong to a streaming service under another name: one rents
// and buys in the app of that service. (Sky Store and MagentaTV are left out: their rentals
// are not in the WOW or Magenta TV+ app.)
const STORE_SERVICES: Record<string, { key: string; name: string }> = {
	amazonvideo: { key: 'amazonprimevideo', name: 'Amazon Prime Video' },
	appletvstore: { key: 'appletv', name: 'Apple TV' }
};

// The streaming service a store to rent or buy at belongs to: key and name, and whether that
// is known for sure (a store of a service under another name). Otherwise it is the store
// itself – a service only if it also streams in a flat rate.
export function storeService(name: string) {
	const key = serviceKey(name);
	const service = STORE_SERVICES[key];
	return service ? { ...service, known: true } : { key, name, known: false };
}

// Anime: the offers come from JustWatch (checked for the region), but AniList often knows the
// direct link to this very anime on the same service – then the logo takes that link instead
// of a search on the service.
export function withDirectLinks<
	W extends Record<'flatrate' | 'rent' | 'buy', { name: string; url: string }[]>
>(watch: W, links: { name: string; url: string }[]): W {
	const usable = links.filter((link) => /^https?:\/\//i.test(link.url));
	const direct = <P extends { name: string; url: string }>(provider: P): P => {
		const link = usable.find((one) => sameService(one.name, provider.name));
		return link ? { ...provider, url: link.url } : provider;
	};
	return {
		...watch,
		flatrate: watch.flatrate.map(direct),
		rent: watch.rent.map(direct),
		buy: watch.buy.map(direct)
	};
}
