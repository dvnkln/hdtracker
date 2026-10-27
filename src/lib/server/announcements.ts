import type { Category } from '#lib/categories.js';
import { getDb } from './db';
import { findItem, saveTogether, trackersOf } from './library';
import { addAnnouncement } from './noticeLog';
import { animeHits } from './providers/anilist';
import type { Details, ShowDetails } from './providers/types';

// A new season that became known, found when a title of a library is refreshed (every night) –
// the same for series and anime (decided with the user, 27.10.2026):
// - a series of TMDB has a season more than before (its number, its start if known);
// - an anime has a new sequel that is a season: it comes into the libraries of those who track
//   the anime, as planned – the series grows, as a series of TMDB does.
// Those who have the title (not dropped, not muted) get a notice; it is pushed like a release
// (notifications.ts). Only what is new since the last refresh counts: without a stored state
// nothing is announced (else the first refresh after an update would announce everything), and
// a season one removed is not brought back.

type Stored = { info: Details; show: ShowDetails | null } | undefined;
const SEASON_FORMATS = ['TV', 'TV_SHORT', 'ONA'];

export type News =
	{ kind: 'season'; season: number; date: string | null } | { kind: 'sequel'; id: string };

export function newSeasons(
	category: Category,
	before: Stored,
	info: Details,
	show: ShowDetails | null
) {
	const news: News[] = [];
	if (category === 'series' && before?.show && show) {
		const regular = (s: ShowDetails) => s.seasons.filter((season) => !season.special);
		const known = Math.max(0, ...regular(before.show).map((season) => season.number));
		for (const season of regular(show)) {
			if (season.number <= known) continue;
			const date = season.airDate ?? season.episodes.find((e) => e.airDate)?.airDate ?? null;
			news.push({ kind: 'season', season: season.number, date });
		}
	}
	if (category === 'anime' && before?.info.anime && info.anime) {
		const sequels = (links: NonNullable<Details['anime']>['links']) =>
			links.filter((l) => l.type === 'SEQUEL' && SEASON_FORMATS.includes(l.format ?? ''));
		const known = new Set(sequels(before.info.anime.links).map((l) => l.id));
		for (const link of sequels(info.anime.links)) {
			if (!known.has(link.id)) news.push({ kind: 'sequel', id: link.id });
		}
	}
	return news;
}

// Acts on what newSeasons found for the title `itemId`. Returns the anime it added (externalId
// → users), so the caller can load their details.
export async function announce(itemId: number, news: News[]) {
	if (news.length === 0) return [];
	const people = trackersOf(itemId).filter((t) => t.status !== 'dropped');
	const told = people.filter((t) => t.notify).map((t) => t.userId);
	const db = getDb();
	for (const n of news) {
		if (n.kind === 'season') addAnnouncement(db, itemId, told, n.season, n.date);
	}

	const sequels = news.filter((n) => n.kind === 'sequel').map((n) => n.id);
	const added: string[] = [];
	for (const season of await animeHits(sequels)) {
		const { anime: _facts, ...item } = season;
		const newcomers = people.filter((t) => !findItem(t.userId, 'anime', item.externalId));
		if (newcomers.length === 0) continue;
		// Who tracks the season before together gets the new one together as well
		// (each keeps the bell they had for the season before: muted stays muted)
		const byTracking = new Map<number, { userId: number; notify: boolean }[]>();
		for (const t of newcomers) {
			const member = { userId: t.userId, notify: t.notify };
			byTracking.set(t.trackingId, [...(byTracking.get(t.trackingId) ?? []), member]);
		}
		for (const members of byTracking.values()) saveTogether(members, 'anime', item, 'planned');
		added.push(item.externalId);
		const title = findItem(newcomers[0].userId, 'anime', item.externalId)!;
		addAnnouncement(
			db,
			title.id,
			newcomers.filter((t) => t.notify).map((t) => t.userId),
			null,
			item.releaseDate
		);
	}
	return added;
}
