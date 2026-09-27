import { isStatusFor, type Category, type Status } from '$lib/status';
import { getDb } from '../db';
import { libraryItems, watchedEpisodes } from '../db/schema';
import { airedEpisodes, getShowDetails } from '../episodes';
import { findItem, SOURCE_FOR, type LibraryItem } from '../library';
import { getAnimeByMalIds } from '../providers/anilist';
import type { SearchResult } from '../providers/types';
import { refreshItem } from '../releases';

// ---- CSV ----

// Splits CSV text into rows of fields (RFC 4180: quoted fields may contain commas, quotes
// written as "" and line breaks).
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field || row.length) rows.push([...row, field]);
	return rows.filter((r) => r.some((f) => f !== ''));
}

// ---- Yamtrack export ----

type YamtrackRow = Record<string, string>;

const REQUIRED_COLUMNS = ['media_id', 'source', 'media_type', 'title', 'status'];

const STATUS: Record<string, Status> = {
	Planning: 'planned',
	'In progress': 'active',
	Paused: 'paused',
	Completed: 'completed',
	Dropped: 'dropped'
};

// Yamtrack media type + source -> our area.
function categoryOf(row: YamtrackRow): Category | null {
	if (row.media_type === 'movie' && row.source === 'tmdb') return 'movies';
	if (row.media_type === 'tv' && row.source === 'tmdb') return 'series';
	if (row.media_type === 'anime' && row.source === 'mal') return 'anime';
	if (row.media_type === 'game' && row.source === 'igdb') return 'games';
	return null;
}

export type SkipReason = 'manual' | 'unsupported' | 'notFound';

export type ImportReport = {
	imported: Record<Category, number>;
	episodes: number; // watched episodes taken over
	existing: number; // already in the library, left alone
	skipped: { title: string; reason: SkipReason }[];
};

// "2026-08-15 17:16:00+00:00" -> Date (null if empty or invalid)
function parseDate(value: string | undefined) {
	if (!value) return null;
	const date = new Date(value.replace(' ', 'T'));
	return Number.isNaN(date.getTime()) ? null : date;
}

export class ImportError extends Error {}

// Takes over a Yamtrack CSV export. Titles already in the library are left alone.
// Posters, descriptions and release dates are loaded afterwards in the background.
export async function importYamtrack(text: string): Promise<ImportReport> {
	const [header, ...lines] = parseCsv(text.replace(/^﻿/, ''));
	if (!header || !REQUIRED_COLUMNS.every((c) => header.includes(c))) {
		throw new ImportError('not a Yamtrack export');
	}
	const rows: YamtrackRow[] = lines.map((l) =>
		Object.fromEntries(header.map((name, i) => [name, l[i] ?? '']))
	);

	const report: ImportReport = {
		imported: { movies: 0, series: 0, anime: 0, games: 0 },
		episodes: 0,
		existing: 0,
		skipped: []
	};

	// Anime: translate MyAnimeList IDs to AniList in one go.
	const malIds = rows
		.filter((r) => categoryOf(r) === 'anime')
		.map((r) => Number(r.media_id))
		.filter((id) => Number.isInteger(id));
	const anime = malIds.length ? await getAnimeByMalIds(malIds) : new Map<number, SearchResult>();

	// Watched series episodes per show: "tmdbId" -> rows
	const episodeRows = new Map<string, YamtrackRow[]>();
	for (const r of rows.filter((r) => r.media_type === 'episode' && r.source === 'tmdb')) {
		episodeRows.set(r.media_id, [...(episodeRows.get(r.media_id) ?? []), r]);
	}

	const added: { item: LibraryItem; allEpisodes: boolean }[] = [];
	const seen = new Set<string>(); // Yamtrack exports sometimes contain a title twice
	const db = getDb();

	db.transaction((tx) => {
		for (const row of rows) {
			// Seasons and episodes belong to their show (handled with the "tv" row).
			if (row.media_type === 'season' || row.media_type === 'episode') continue;

			const category = categoryOf(row);
			if (!category) {
				report.skipped.push({
					title: row.title,
					reason: row.source === 'manual' ? 'manual' : 'unsupported'
				});
				continue;
			}

			let item: SearchResult;
			if (category === 'anime') {
				const found = anime.get(Number(row.media_id));
				if (!found) {
					report.skipped.push({ title: row.title, reason: 'notFound' });
					continue;
				}
				item = found;
			} else {
				if (!/^\d{1,12}$/.test(row.media_id)) {
					report.skipped.push({ title: row.title, reason: 'notFound' });
					continue;
				}
				item = {
					source: SOURCE_FOR[category],
					externalId: row.media_id,
					title: row.title,
					originalTitle: null,
					year: null,
					posterUrl: row.image?.startsWith('https://') ? row.image : null,
					overview: null
				};
			}

			const key = `${category}:${item.externalId}`;
			if (seen.has(key)) continue;
			seen.add(key);
			if (findItem(category, item.externalId)) {
				report.existing++;
				continue;
			}

			// Movies have no "watching"/"paused": those become "planned".
			const mapped = STATUS[row.status] ?? 'planned';
			const status = isStatusFor(category, mapped) ? mapped : 'planned';
			const addedAt = parseDate(row.created_at) ?? new Date();
			const changedAt = parseDate(row.end_date) ?? parseDate(row.progressed_at) ?? addedAt;

			const inserted = tx
				.insert(libraryItems)
				.values({ ...item, category, status, addedAt, statusChangedAt: changedAt })
				.returning()
				.get();
			report.imported[category]++;

			// Watched episodes: series from the episode rows, anime from the progress number.
			let episodes: { season: number; episode: number; watchedAt: Date }[] = [];
			if (category === 'series') {
				episodes = (episodeRows.get(row.media_id) ?? [])
					.map((e) => ({
						season: Number(e.season_number),
						episode: Number(e.episode_number),
						watchedAt: parseDate(e.end_date) ?? changedAt
					}))
					.filter((e) => Number.isInteger(e.season) && Number.isInteger(e.episode));
			} else if (category === 'anime') {
				const progress = Number.parseInt(row.progress, 10) || 0;
				episodes = Array.from({ length: progress }, (_, i) => ({
					season: 1,
					episode: i + 1,
					watchedAt: changedAt
				}));
			}
			for (const e of episodes) {
				tx.insert(watchedEpisodes)
					.values({ itemId: inserted.id, ...e })
					.onConflictDoNothing()
					.run();
			}
			report.episodes += episodes.length;

			// A finished series without single episodes in the export: tick all aired ones later.
			const allEpisodes = category === 'series' && status === 'completed' && !episodes.length;
			added.push({ item: inserted, allEpisodes });
		}
	});

	completeInBackground(added);
	return report;
}

// Loads posters, descriptions and release dates of the imported titles, one after another
// (rate limits), and ticks all aired episodes of finished series where needed.
function completeInBackground(added: { item: LibraryItem; allEpisodes: boolean }[]) {
	(async () => {
		for (const { item, allEpisodes } of added) {
			try {
				await refreshItem(item);
				if (allEpisodes) {
					const details = await getShowDetails('series', item.externalId);
					for (const e of airedEpisodes(details)) {
						getDb()
							.insert(watchedEpisodes)
							.values({ itemId: item.id, season: e.season, episode: e.episode })
							.onConflictDoNothing()
							.run();
					}
				}
			} catch (err) {
				console.error(`Import: loading ${item.category}/${item.externalId} failed`, err);
			}
		}
		console.log(`Import: details of ${added.length} titles loaded`);
	})();
}
