import type { Status } from '$lib/status';
import { getDb } from '../db';
import { itemDetails, libraryItems, watchedEpisodes } from '../db/schema';

// Writes the library as a CSV file in the format of Yamtrack's own export, so Yamtrack (and
// hdtracker's import) can read it. Only the database is read – nothing is asked from any API.

const COLUMNS = [
	'media_id',
	'source',
	'media_type',
	'title',
	'image',
	'season_number',
	'episode_number',
	'score',
	'status',
	'notes',
	'start_date',
	'end_date',
	'progress',
	'created_at',
	'progressed_at'
] as const;
type Row = Partial<Record<(typeof COLUMNS)[number], string | number | null>>;

const STATUS: Record<Status, string> = {
	planned: 'Planning',
	active: 'In progress',
	paused: 'Paused',
	completed: 'Completed',
	dropped: 'Dropped'
};

// Date -> "2026-08-15 17:16:00+00:00", as Yamtrack writes it
function stamp(date: Date | null | undefined) {
	return date ? date.toISOString().slice(0, 19).replace('T', ' ') + '+00:00' : '';
}

// Every field in quotes, quotes inside doubled (counterpart of parseCsv in import/yamtrack.ts).
function toCsv(rows: Row[]) {
	const line = (fields: (string | number | null | undefined)[]) =>
		fields.map((f) => `"${String(f ?? '').replaceAll('"', '""')}"`).join(',');
	return [line([...COLUMNS]), ...rows.map((r) => line(COLUMNS.map((c) => r[c])))].join('\n') + '\n';
}

// Anime that cannot be exported: Yamtrack knows anime only by their MyAnimeList ID.
export function animeWithoutMalId() {
	const anime = getDb()
		.select()
		.from(libraryItems)
		.all()
		.filter((i) => i.category === 'anime');
	const missing = anime.filter((i) => i.malId === null);
	return {
		// Details still loading: the ID may arrive with them
		loading: missing.filter((i) => i.metadataUpdatedAt === null).length,
		// Loaded, but the anime has no entry at MyAnimeList
		unknown: missing.filter((i) => i.metadataUpdatedAt !== null).length
	};
}

export function exportYamtrack() {
	const db = getDb();
	const items = db.select().from(libraryItems).orderBy(libraryItems.id).all();
	const shows = new Map(
		db
			.select({ itemId: itemDetails.itemId, show: itemDetails.show })
			.from(itemDetails)
			.all()
			.map((d) => [d.itemId, d.show])
	);
	const watched = new Map<number, (typeof watchedEpisodes.$inferSelect)[]>();
	for (const w of db.select().from(watchedEpisodes).all()) {
		watched.set(w.itemId, [...(watched.get(w.itemId) ?? []), w]);
	}
	const first = (dates: Date[]) => (dates.length ? new Date(Math.min(...dates.map(Number))) : null);
	const last = (dates: Date[]) => (dates.length ? new Date(Math.max(...dates.map(Number))) : null);

	const tv: Row[] = [];
	const seasons: Row[] = [];
	const episodes: Row[] = [];
	const movies: Row[] = [];
	const anime: Row[] = [];
	const games: Row[] = [];

	for (const item of items) {
		const done = item.status === 'completed';
		const seen = watched.get(item.id) ?? [];
		const seenAt = seen.map((w) => w.watchedAt);
		const base: Row = {
			media_id: item.externalId,
			source: item.source,
			title: item.title,
			image: item.posterUrl,
			status: STATUS[item.status],
			created_at: stamp(item.addedAt),
			progressed_at: stamp(item.statusChangedAt)
		};

		if (item.category === 'movies') {
			movies.push({
				...base,
				media_type: 'movie',
				end_date: done ? stamp(item.statusChangedAt) : '',
				progress: done ? 1 : 0
			});
		} else if (item.category === 'games') {
			games.push({
				...base,
				media_type: 'game',
				start_date:
					item.status === 'active' || item.status === 'paused' ? stamp(item.statusChangedAt) : '',
				end_date: done ? stamp(item.statusChangedAt) : '',
				progress: '0min' // play time is not tracked
			});
		} else if (item.category === 'anime') {
			if (item.malId === null) continue;
			anime.push({
				...base,
				media_id: String(item.malId),
				source: 'mal',
				media_type: 'anime',
				start_date: stamp(first(seenAt)),
				end_date: done ? stamp(last(seenAt) ?? item.statusChangedAt) : '',
				progress: seen.length
			});
		} else {
			tv.push({
				...base,
				media_type: 'tv',
				start_date: stamp(first(seenAt)),
				end_date: done ? stamp(last(seenAt) ?? item.statusChangedAt) : '',
				progress: seen.filter((w) => w.season > 0).length
			});
			const stored = shows.get(item.id);
			for (const number of [...new Set(seen.map((w) => w.season))].sort((a, b) => a - b)) {
				const inSeason = seen.filter((w) => w.season === number);
				const dates = inSeason.map((w) => w.watchedAt);
				// A season counts as completed when every aired episode is ticked (as far as known).
				const aired = stored?.seasons
					.find((s) => s.number === number)
					?.episodes.filter((e) => e.aired);
				const complete = aired ? inSeason.length >= aired.length : done;
				seasons.push({
					...base,
					media_type: 'season',
					image: '', // the season's own poster: Yamtrack loads it itself
					season_number: number,
					status: complete
						? STATUS.completed
						: STATUS[item.status === 'planned' ? 'active' : item.status],
					start_date: stamp(first(dates)),
					end_date: complete ? stamp(last(dates)) : '',
					progress: inSeason.length,
					progressed_at: stamp(last(dates))
				});
				const stills = new Map(
					stored?.seasons
						.find((s) => s.number === number)
						?.episodes.map((e) => [e.number, e.stillUrl])
				);
				for (const w of [...inSeason].sort((a, b) => a.episode - b.episode)) {
					episodes.push({
						media_id: item.externalId,
						source: item.source,
						media_type: 'episode',
						title: item.title,
						image: stills.get(w.episode) ?? '',
						season_number: number,
						episode_number: w.episode,
						end_date: stamp(w.watchedAt),
						created_at: stamp(w.watchedAt)
					});
				}
			}
		}
	}
	// Same order as Yamtrack: series before their seasons and episodes, then the rest.
	return toCsv([...tv, ...seasons, ...episodes, ...movies, ...anime, ...games]);
}
