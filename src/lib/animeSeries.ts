import type { Status } from './status';

// AniList has one entry per season, film or OVA. The anime search shows the entries that belong
// together as one series: one poster, and a list of its parts in order. Worked out from the hits
// themselves and the links AniList sends with each one – nothing is fetched for it. Two hits also
// belong together when they link to the same entry that is not among them (a film of season 4
// and season 3 both link to season 4): what is not among the hits is not shown, but it still
// joins. Only for showing: every part keeps its own status.

// What the search sends along with an anime hit. `start` is the first air date with unknown
// parts as 9999/12/31, so entries sort by it.
export type AnimeFacts = {
	format: string | null;
	episodes: number | null;
	season: 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL' | null;
	start: string;
	// Links to other anime that make them one series (see LINKS), with the format of the other
	links: { type: string; id: string; format?: string | null }[];
	// The links of those linked entries (one step further), so that two parts join even when
	// two steps between them are missing (season 3 and a film of season 5)
	around?: { from: string; type: string; id: string; format?: string | null }[];
};

// Links that join a series: one after the other (PREQUEL/SEQUEL), recaps (SUMMARY), and parts
// that belong to a main entry (PARENT, SIDE_STORY) or are another version of it (ALTERNATIVE) –
// the last three only when one side is not a series: that is how AniList links films, OVAs and
// recap films (Attack on Titan Part I to season 1). A series linked that way to another series is
// a work of its own: a spin-off (My Hero Academia: Vigilantes, Attack on Titan: Junior High) or
// a remake (Fullmetal Alchemist: Brotherhood) – a TV series, that is: AniList also files web
// releases of a few episodes as ONA ("My Hero Academia Season 5 OVA"), and those belong to it.
// Spin-offs and characters never join.
export const LINKS = ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'SUMMARY', 'ALTERNATIVE'];
const NOT_BETWEEN_SERIES = ['PARENT', 'SIDE_STORY', 'ALTERNATIVE'];
// Series formats (counted as seasons when they are in the line of prequels and sequels)
const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
const isSeriesFormat = (hit: Hit | undefined) => SERIES.has(hit?.anime?.format ?? '');
const isTvSeries = (format: string | null | undefined) => format === 'TV' || format === 'TV_SHORT';

type Hit = { externalId: string; year: number | null; anime?: AnimeFacts };

export type AnimeEntry<T extends Hit> =
	| { kind: 'single'; hit: T }
	| {
			kind: 'series';
			// Poster and name of the series: its first season (or its first part)
			cover: T;
			// Seasons in order; films; everything else (OVAs, specials, spin-off series)
			seasons: T[];
			movies: T[];
			extras: T[];
			from: number | null;
			to: number | null;
			// The seasons can be counted (S1, S2 …): none is missing before or between them
			numbered: boolean;
	  };

const startOf = (hit: Hit) => hit.anime?.start ?? '9999-12-31';
const byStart = (a: Hit, b: Hit) => startOf(a).localeCompare(startOf(b));

// Hits joined by the given links – directly or through an entry they both link to – each group
// in the order of the hits, the groups in the order of their first hit.
function joined<T extends Hit>(hits: T[], types: string[]) {
	const byId = new Map(hits.map((h) => [h.externalId, h]));
	const up = new Map<string, string>();
	const root = (id: string): string => {
		const next = up.get(id) ?? id;
		return next === id ? id : root(next);
	};
	const formatOf = (id: string, known?: string | null) => byId.get(id)?.anime?.format ?? known;
	const join = (
		from: string,
		fromFormat: string | null | undefined,
		link: AnimeFacts['links'][0]
	) => {
		if (!types.includes(link.type)) return;
		const format = formatOf(link.id, link.format);
		if (NOT_BETWEEN_SERIES.includes(link.type) && isTvSeries(fromFormat) && isTvSeries(format))
			return;
		const a = root(from);
		const b = root(link.id);
		if (a !== b) up.set(a, b);
	};
	for (const hit of hits) {
		const facts = hit.anime;
		for (const link of facts?.links ?? []) join(hit.externalId, facts?.format, link);
		for (const { from, ...link } of facts?.around ?? []) {
			const via = facts?.links.find((l) => l.id === from);
			join(from, formatOf(from, via?.format), link);
		}
	}
	const groups = new Map<string, T[]>();
	for (const hit of hits) {
		const key = root(hit.externalId);
		groups.set(key, [...(groups.get(key) ?? []), hit]);
	}
	return [...groups.values()];
}

export function groupAnime<T extends Hit>(hits: T[]): AnimeEntry<T>[] {
	return joined(hits, LINKS).map((members): AnimeEntry<T> => {
		if (members.length === 1) return { kind: 'single', hit: members[0] };
		// The main line: prequels and sequels around the first series among the hits
		const first = members.find(isSeriesFormat);
		const line = first
			? joined(members, ['PREQUEL', 'SEQUEL']).find((group) => group.includes(first))!
			: [];
		const seasons = line.filter(isSeriesFormat).sort(byStart);
		const movies = members.filter((h) => h.anime?.format === 'MOVIE').sort(byStart);
		const extras = members.filter((h) => !seasons.includes(h) && !movies.includes(h));
		const years = members.map((h) => h.year).filter((y): y is number => y !== null);
		return {
			kind: 'series',
			cover: seasons[0] ?? [...members].sort(byStart)[0],
			seasons,
			movies,
			extras: extras.sort(byStart),
			from: years.length ? Math.min(...years) : null,
			to: years.length ? Math.max(...years) : null,
			numbered: countable(seasons)
		};
	});
}

// Whether the seasons are all there from the first one, so their place is their number: no season
// links to an earlier season that is missing, and none but the last to a later one that is
// missing (a season still to come does not change the numbers). A link whose format is unknown
// does not count.
function countable(seasons: Hit[]) {
	const here = new Set(seasons.map((h) => h.externalId));
	const missing = (h: Hit, type: string) =>
		(h.anime?.links ?? []).some(
			(l) => l.type === type && !here.has(l.id) && SERIES.has(l.format ?? '')
		);
	return !seasons.some(
		(h, i) => missing(h, 'PREQUEL') || (i < seasons.length - 1 && missing(h, 'SEQUEL'))
	);
}

// The part the user is on, shown on the poster of the series: watching before paused before
// planned before watched before dropped; among equals the latest one.
const RANK: Status[] = ['active', 'paused', 'planned', 'completed', 'dropped'];

export function currentPart<T extends Hit & { status: Status | null }>(
	entry: Extract<AnimeEntry<T>, { kind: 'series' }>
): T | null {
	const tracked = [...entry.seasons, ...entry.movies, ...entry.extras].filter((h) => h.status);
	tracked.sort((a, b) => RANK.indexOf(a.status!) - RANK.indexOf(b.status!) || byStart(b, a));
	return tracked[0] ?? null;
}

// The part whose poster and year a stack shows for one status: what the user is watching, the
// next one planned, the latest of the others (watched, paused, dropped).
export function facePart<T extends Hit & { status: Status | null }>(
	parts: T[],
	status: Status
): T | null {
	const same = parts.filter((h) => h.status === status).sort(byStart);
	if (same.length === 0) return null;
	return status === 'planned' ? same[0] : same[same.length - 1];
}

// ---- The library ----

// What stands in the sections of the anime library (decided with the user, 27.10.2026):
// - The seasons of a series: one stack, only in the section of the season the user is on.
// - Everything else of a series: one stack per status (with the seasons if they stand there).
// - Alone in its section: a poster of its own; `tagged` when it is not a season or a series
//   (films, OVAs, specials, … get a small label).
// A stack shows the poster and year of `face` (see facePart) and the name of `named`.
export type LibraryEntry<T extends Hit & { status: Status }> =
	| { kind: 'single'; status: Status; hit: T; tagged: boolean }
	| {
			kind: 'stack';
			status: Status;
			// Only the parts in this stack, sorted like a series
			series: Extract<AnimeEntry<T>, { kind: 'series' }>;
			face: T;
			named: T;
	  };

export function libraryEntries<T extends Hit & { status: Status }>(items: T[]): LibraryEntry<T>[] {
	const out: LibraryEntry<T>[] = [];
	for (const entry of groupAnime(items)) {
		if (entry.kind === 'single') {
			const tagged = !SERIES.has(entry.hit.anime?.format ?? '');
			out.push({ kind: 'single', status: entry.hit.status, hit: entry.hit, tagged });
			continue;
		}
		const parts = [...entry.seasons, ...entry.movies, ...entry.extras];
		const seasonsOnly = { ...entry, movies: [], extras: [] };
		const where = entry.seasons.length ? currentPart(seasonsOnly)!.status : null;
		const byStatus = new Map<Status, T[]>();
		for (const part of parts) {
			const status = entry.seasons.includes(part) ? where! : part.status;
			byStatus.set(status, [...(byStatus.get(status) ?? []), part]);
		}
		for (const [status, list] of byStatus) {
			if (list.length === 1) {
				const tagged = !entry.seasons.includes(list[0]);
				out.push({ kind: 'single', status, hit: list[0], tagged });
				continue;
			}
			const only = (of: T[]) => of.filter((h) => list.includes(h));
			const seasons = only(entry.seasons);
			const movies = only(entry.movies);
			const extras = only(entry.extras);
			const years = list.map((h) => h.year).filter((y): y is number => y !== null);
			out.push({
				kind: 'stack',
				status,
				series: {
					kind: 'series',
					cover: seasons[0] ?? movies[0] ?? extras[0],
					seasons,
					movies,
					extras,
					from: years.length ? Math.min(...years) : null,
					to: years.length ? Math.max(...years) : null,
					numbered: entry.numbered
				},
				// Poster: the part that counts here – or, for the seasons with a part of another status
				// among them (watched seasons in the "watching" stack), the one with this status
				face: facePart(list, status) ?? list[0],
				named: entry.cover
			});
		}
	}
	return out;
}

// How many parts of each kind a series (or stack) has, in a fixed order: seasons first, then
// films, OVAs, ONAs, specials and the rest – only kinds that occur.
const KIND_ORDER = ['SEASON', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'TV', 'TV_SHORT', 'MUSIC'];

export function partCounts(series: Extract<AnimeEntry<Hit>, { kind: 'series' }>) {
	const counts = new Map<string, number>();
	if (series.seasons.length) counts.set('SEASON', series.seasons.length);
	for (const part of [...series.movies, ...series.extras]) {
		const kind = part.anime?.format ?? 'OTHER';
		counts.set(kind, (counts.get(kind) ?? 0) + 1);
	}
	const rank = (kind: string) => (KIND_ORDER.includes(kind) ? KIND_ORDER.indexOf(kind) : 99);
	return [...counts.entries()]
		.sort(([a], [b]) => rank(a) - rank(b))
		.map(([kind, n]) => ({ kind, n }));
}
