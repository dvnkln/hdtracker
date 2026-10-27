import { describe, expect, it } from 'vitest';
import {
	currentPart,
	facePart,
	groupAnime,
	libraryEntries,
	partCounts,
	type AnimeFacts
} from './animeSeries';
import type { Status } from './status';

type Hit = { externalId: string; year: number | null; status: Status | null; anime: AnimeFacts };

function hit(
	id: string,
	format: string,
	start: string,
	links: [string, string][] = [],
	status: Status | null = null
): Hit {
	return {
		externalId: id,
		year: Number(start.slice(0, 4)),
		status,
		anime: {
			format,
			episodes: null,
			season: null,
			start,
			links: links.map(([type, to]) => ({ type, id: to }))
		}
	};
}

const ids = (list: Hit[]) => list.map((h) => h.externalId);

// Shaped like AniList's hits for "Attack on Titan" (in its order: by relevance, not by date)
const AOT = [
	hit('s1', 'TV', '2013-04-07', [
		['SEQUEL', 's2'],
		['PREQUEL', 'ova0'],
		['SIDE_STORY', 'ova1']
	]),
	hit('fs', 'TV', '2020-12-07', [['PREQUEL', 's3']]),
	hit('s2', 'TV', '2017-04-01', [
		['PREQUEL', 's1'],
		['SEQUEL', 's3']
	]),
	hit('s3', 'TV', '2018-07-23', [
		['PREQUEL', 's2'],
		['SEQUEL', 'fs']
	]),
	hit('ova0', 'OVA', '2014-12-09', [['SEQUEL', 's1']]),
	hit('ova1', 'OVA', '2013-12-09', [['PARENT', 's1']]),
	hit('movie', 'MOVIE', '2014-11-22', [['PARENT', 's1']]),
	hit('junior', 'TV', '2015-10-04', [['PARENT', 's1']]),
	// Its own work, not linked to the others
	hit('other', 'TV', '2010-01-01')
];

describe('groupAnime', () => {
	it('puts what belongs together into one series, at the place of its first hit', () => {
		const entries = groupAnime(AOT);
		// The spin-off series (Junior High) is a series of its own
		expect(entries.map((e) => e.kind)).toEqual(['series', 'single', 'single']);
		const series = entries[0];
		if (series.kind !== 'series') throw new Error();
		expect(series.cover.externalId).toBe('s1');
		// Seasons in order of airing, not of relevance
		expect(ids(series.seasons)).toEqual(['s1', 's2', 's3', 'fs']);
		expect(ids(series.movies)).toEqual(['movie']);
		// The OVAs, by date
		expect(ids(series.extras)).toEqual(['ova1', 'ova0']);
		expect([series.from, series.to]).toEqual([2013, 2020]);
	});

	it('keeps a hit without links to the others on its own', () => {
		const entries = groupAnime([hit('a', 'TV', '2020-01-01'), hit('b', 'TV', '2021-01-01')]);
		expect(entries).toEqual([
			{ kind: 'single', hit: expect.objectContaining({ externalId: 'a' }) },
			{ kind: 'single', hit: expect.objectContaining({ externalId: 'b' }) }
		]);
	});

	it('joins only through links among the hits, and not through spin-offs', () => {
		const entries = groupAnime([
			hit('a', 'TV', '2020-01-01', [['SEQUEL', 'missing']]),
			hit('b', 'TV', '2021-01-01', [['SPIN_OFF', 'a']])
		]);
		expect(entries.map((e) => e.kind)).toEqual(['single', 'single']);
	});

	it('keeps a spin-off series with its own seasons apart from the main series', () => {
		// As AniList links My Hero Academia: Vigilantes – PARENT to the main series
		const entries = groupAnime([
			hit('mha1', 'TV', '2016-04-03', [['SEQUEL', 'mha2']]),
			hit('mha2', 'TV', '2017-04-01', [['PREQUEL', 'mha1']]),
			hit('film', 'MOVIE', '2018-08-03', [['PARENT', 'mha2']]),
			hit('vig1', 'TV', '2025-04-07', [
				['PARENT', 'mha1'],
				['SEQUEL', 'vig2']
			]),
			hit('vig2', 'TV', '2026-01-05', [['PREQUEL', 'vig1']])
		]);
		expect(
			entries.map((e) => (e.kind === 'series' ? ids([...e.seasons, ...e.movies]) : e.kind))
		).toEqual([
			['mha1', 'mha2', 'film'],
			['vig1', 'vig2']
		]);
	});

	it('counts a web release of a few episodes (ONA) linked to the series as part of it', () => {
		const entries = groupAnime([
			hit('s5', 'TV', '2021-03-27'),
			hit('ova', 'ONA', '2022-08-01', [['SIDE_STORY', 's5']])
		]);
		expect(entries.map((e) => e.kind)).toEqual(['series']);
	});

	it('joins hits that link to the same entry that is not among them', () => {
		// Season 4 is missing: season 3 leads to it, the film belongs to it
		const entries = groupAnime([
			hit('s3', 'TV', '2018-04-07', [['SEQUEL', 's4']]),
			hit('movie', 'MOVIE', '2019-12-20', [['PARENT', 's4']]),
			hit('other', 'TV', '2018-01-01', [['SEQUEL', 'x']])
		]);
		expect(entries.map((e) => e.kind)).toEqual(['series', 'single']);
		const [series] = entries;
		if (series.kind !== 'series') throw new Error();
		expect(ids(series.seasons)).toEqual(['s3']);
		expect(ids(series.movies)).toEqual(['movie']);
	});

	it('joins through two missing entries when the links one step further are known', () => {
		const s3 = hit('s3', 'TV', '2018-04-07', [['SEQUEL', 's4']]);
		s3.anime.around = [{ from: 's4', type: 'SEQUEL', id: 's5', format: 'TV' }];
		const film = hit('film', 'MOVIE', '2021-08-06', [['PARENT', 's5']]);
		expect(groupAnime([s3, film]).map((e) => e.kind)).toEqual(['series']);
		// Without that step they stay apart
		expect(groupAnime([hit('s3', 'TV', '2018-04-07', [['SEQUEL', 's4']]), film]).length).toBe(2);
	});

	it('does not join two series through another version that is a series too', () => {
		const tv = (id: string) =>
			({
				...hit(id, 'TV', '2003-10-04'),
				anime: {
					...hit(id, 'TV', '2003-10-04').anime,
					links: [{ type: 'ALTERNATIVE', id: 'remake', format: 'TV' }]
				}
			}) as Hit;
		expect(groupAnime([tv('a'), tv('b')]).map((e) => e.kind)).toEqual(['single', 'single']);
	});

	it('takes a recap film linked as another version, but keeps two series apart', () => {
		const entries = groupAnime([
			hit('s1', 'TV', '2013-04-07'),
			hit('recap', 'MOVIE', '2014-11-22', [['ALTERNATIVE', 's1']]),
			hit('digest', 'SPECIAL', '2014-01-01', [['SUMMARY', 's1']]),
			hit('fma', 'TV', '2003-10-04'),
			hit('brotherhood', 'TV', '2009-04-05', [['ALTERNATIVE', 'fma']])
		]);
		expect(entries.map((e) => e.kind)).toEqual(['series', 'single', 'single']);
		const [series] = entries;
		if (series.kind !== 'series') throw new Error();
		expect(ids(series.movies)).toEqual(['recap']);
		expect(ids(series.extras)).toEqual(['digest']);
	});

	it('uses the first part as the cover when there is no season (only films)', () => {
		const [series] = groupAnime([
			hit('m2', 'MOVIE', '2016-01-01', [['PREQUEL', 'm1']]),
			hit('m1', 'MOVIE', '2015-01-01', [['SEQUEL', 'm2']])
		]);
		if (series.kind !== 'series') throw new Error();
		expect(series.cover.externalId).toBe('m1');
		expect(series.seasons).toEqual([]);
		expect(ids(series.movies)).toEqual(['m1', 'm2']);
	});
});

describe('numbered seasons', () => {
	const numbered = (hits: Hit[]) => {
		const [series] = groupAnime(hits);
		if (series.kind !== 'series') throw new Error();
		return series.numbered;
	};
	const tv = (id: string, start: string, links: [string, string][]) => {
		const h = hit(id, 'TV', start, links);
		h.anime.links = h.anime.links.map((l) => ({ ...l, format: 'TV' }));
		return h;
	};

	it('counts seasons that are all there from the first one, even with one still to come', () => {
		expect(
			numbered([
				tv('s1', '2016-01-01', [['SEQUEL', 's2']]),
				tv('s2', '2017-01-01', [
					['PREQUEL', 's1'],
					['SEQUEL', 's3']
				])
			])
		).toBe(true);
	});

	it('does not count when a season before or between is missing', () => {
		// Only season 3 and 4: season 2 is missing before them
		expect(
			numbered([
				tv('s3', '2018-01-01', [
					['PREQUEL', 's2'],
					['SEQUEL', 's4']
				]),
				tv('s4', '2019-01-01', [['PREQUEL', 's3']])
			])
		).toBe(false);
		// Season 1 and 3: season 2 is missing between them (joined through it)
		expect(
			numbered([
				tv('s1', '2016-01-01', [['SEQUEL', 's2']]),
				tv('s3', '2018-01-01', [['PREQUEL', 's2']])
			])
		).toBe(false);
	});
});

describe('currentPart', () => {
	const series = (statuses: Record<string, Status>) => {
		const [entry] = groupAnime(AOT.map((h) => ({ ...h, status: statuses[h.externalId] ?? null })));
		if (entry.kind !== 'series') throw new Error();
		return currentPart(entry)?.externalId ?? null;
	};

	it('is the season being watched rather than the one watched', () => {
		expect(series({ s1: 'completed', s2: 'active' })).toBe('s2');
	});

	it('is the latest one among equals', () => {
		expect(series({ s1: 'completed', s2: 'completed', movie: 'completed' })).toBe('s2');
	});

	it('is nothing when no part is in the library', () => {
		expect(series({})).toBeNull();
	});
});

describe('facePart', () => {
	const parts = [
		hit('s1', 'TV', '2013-04-07', [], 'completed'),
		hit('s2', 'TV', '2017-04-01', [], 'completed'),
		hit('s3', 'TV', '2018-07-23', [], 'planned'),
		hit('fs', 'TV', '2020-12-07', [], 'planned'),
		hit('movie', 'MOVIE', '2014-11-22', [], 'active')
	];
	const face = (status: Status) => facePart(parts, status)?.externalId ?? null;

	it('shows what is being watched', () => expect(face('active')).toBe('movie'));
	it('shows the next one planned', () => expect(face('planned')).toBe('s3'));
	it('shows the latest one watched', () => expect(face('completed')).toBe('s2'));
	it('is nothing for a status no part has', () => expect(face('dropped')).toBeNull());
});

describe('libraryEntries', () => {
	// Shaped like the user's My Hero Academia (27.10.2026): season 4 and 5 not in the library
	const mha = () => [
		hit('s1', 'TV', '2016-04-03', [['SEQUEL', 's2']], 'completed'),
		hit(
			's2',
			'TV',
			'2017-04-01',
			[
				['PREQUEL', 's1'],
				['SEQUEL', 's3']
			],
			'active'
		),
		hit(
			's3',
			'TV',
			'2018-04-07',
			[
				['PREQUEL', 's2'],
				['SEQUEL', 's4']
			],
			'planned'
		),
		hit('twoHeroes', 'MOVIE', '2018-08-03', [['PARENT', 's3']], 'completed'),
		hit('heroesRising', 'MOVIE', '2019-12-20', [['PARENT', 's4']], 'completed'),
		hit('training', 'OVA', '2017-06-02', [['PARENT', 's2']], 'completed'),
		hit('ova', 'OVA', '2017-08-04', [['SIDE_STORY', 's2']], 'planned'),
		hit('worldHeroes', 'MOVIE', '2021-08-06', [['PARENT', 's5']], 'planned')
	];
	type Entry = ReturnType<typeof libraryEntries<Hit & { status: Status }>>[number];
	const describeEntry = (e: Entry) =>
		e.kind === 'single'
			? `${e.status}: ${e.hit.externalId}${e.tagged ? ' (tag)' : ''}`
			: `${e.status}: [${ids([...e.series.seasons, ...e.series.movies, ...e.series.extras]).join(
					' '
				)}] face ${e.face.externalId}`;
	const layout = (items: Hit[], around: Record<string, [string, string, string][]> = {}) => {
		for (const item of items) {
			item.anime.around = (around[item.externalId] ?? []).map(([from, type, id]) => ({
				from,
				type,
				id
			}));
		}
		return libraryEntries(items as (Hit & { status: Status })[]).map(describeEntry);
	};

	it('puts the seasons where the user is, the rest in one stack per status', () => {
		// Season 3 leads to 4, and 4 to 5 – known from the links one step further
		expect(layout(mha(), { s3: [['s4', 'SEQUEL', 's5']] })).toEqual([
			'active: [s1 s2 s3] face s2',
			'completed: [twoHeroes heroesRising training] face heroesRising',
			'planned: [worldHeroes ova] face ova'
		]);
	});

	it('puts all seasons with the rest once they are all watched', () => {
		const items = mha().map((h) =>
			h.externalId.startsWith('s') ? { ...h, status: 'completed' as const } : h
		);
		expect(layout(items, { s3: [['s4', 'SEQUEL', 's5']] })[0]).toBe(
			'completed: [s1 s2 s3 twoHeroes heroesRising training] face heroesRising'
		);
	});

	it('shows a part alone in its section as a poster of its own, labelled if not a season', () => {
		const items = [
			hit('s1', 'TV', '2016-04-03', [], 'active'),
			hit('film', 'MOVIE', '2018-08-03', [['PARENT', 's1']], 'planned'),
			hit('alone', 'MOVIE', '2020-01-01', [], 'completed'),
			hit('show', 'TV', '2020-01-01', [], 'completed')
		];
		expect(layout(items)).toEqual([
			'active: s1',
			'planned: film (tag)',
			'completed: alone (tag)',
			'completed: show'
		]);
	});
});

describe('partCounts', () => {
	it('counts seasons, then each kind of the rest, in a fixed order', () => {
		const [series] = groupAnime(AOT);
		if (series.kind !== 'series') throw new Error();
		expect(partCounts(series)).toEqual([
			{ kind: 'SEASON', n: 4 },
			{ kind: 'MOVIE', n: 1 },
			{ kind: 'OVA', n: 2 }
		]);
	});
});
