import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { Category, Status } from '../../status';
import type { Details, SearchResult, ShowDetails } from '../providers/types';

// Simple key/value store for app settings (region, language, ...).
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// One row per logged-in browser. `id` is the HMAC of the cookie token, never the token itself.
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

// A title the user tracks. Metadata is copied from the API when added.
export const libraryItems = sqliteTable(
	'library_items',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		category: text('category').$type<Category>().notNull(),
		source: text('source').$type<SearchResult['source']>().notNull(),
		externalId: text('external_id').notNull(),
		title: text('title').notNull(),
		originalTitle: text('original_title'),
		year: integer('year'),
		// First release anywhere (YYYY-MM-DD), empty = not announced; see isReleased in status.ts
		releaseDate: text('release_date'),
		// Games: currently only available in early access
		earlyAccess: integer('early_access', { mode: 'boolean' }).notNull().default(false),
		// Anime: ID at MyAnimeList (the export for Yamtrack needs it)
		malId: integer('mal_id'),
		posterUrl: text('poster_url'),
		overview: text('overview'),
		status: text('status').$type<Status>().notNull(),
		addedAt: integer('added_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		statusChangedAt: integer('status_changed_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		// When title, poster and release dates were last loaded from the API. Empty = still to
		// be loaded (e.g. right after an import); the refresh queue picks these up.
		metadataUpdatedAt: integer('metadata_updated_at', { mode: 'timestamp' }),
		// Set when the data source no longer knows the title (deleted or merged there). What is
		// stored stays; the source is only asked again once a month. Empty = all fine.
		sourceMissingSince: integer('source_missing_since', { mode: 'timestamp' })
	},
	(t) => [uniqueIndex('library_items_unique').on(t.category, t.source, t.externalId)]
);

// Everything the detail page of a library item shows, kept so the page opens without asking
// the API (see server/itemDetails.ts). Removed together with the item.
export const itemDetails = sqliteTable('item_details', {
	itemId: integer('item_id')
		.primaryKey()
		.references(() => libraryItems.id, { onDelete: 'cascade' }),
	info: text('info', { mode: 'json' }).$type<Details>().notNull(),
	// Seasons and episodes (series and anime only)
	show: text('show', { mode: 'json' }).$type<ShowDetails>(),
	fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull()
});

// Direct links to a title on streaming services, as found on Wikidata (see providers/
// wikidata.ts). Kept for a month, so Wikidata is asked as rarely as possible.
export const wikidataLinks = sqliteTable('wikidata_links', {
	id: text('id').primaryKey(), // Wikidata ID, e.g. "Q189330"
	links: text('links', { mode: 'json' }).$type<Record<string, string>>().notNull(),
	fetchedAt: integer('fetched_at', { mode: 'timestamp' }).notNull()
});

// Which TMDB season and episodes an AniList entry corresponds to (AniList has one entry per
// season, TMDB one show with seasons). Copied from the community list anibridge-mappings, see
// server/animeMapping.ts; replaced as a whole with every download. Ranges like "1-23", "14-".
export const animeTmdbMap = sqliteTable(
	'anime_tmdb_map',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		anilistId: integer('anilist_id').notNull(),
		tmdbId: integer('tmdb_id').notNull(),
		season: integer('season').notNull(),
		// Episodes of the AniList entry ...
		sourceRange: text('source_range').notNull(),
		// ... and the episodes of the TMDB season they are
		targetRange: text('target_range').notNull()
	},
	(t) => [index('anime_tmdb_map_anilist').on(t.anilistId)]
);

// One row per watched episode. Anime use season 1.
export const watchedEpisodes = sqliteTable(
	'watched_episodes',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		itemId: integer('item_id')
			.notNull()
			.references(() => libraryItems.id, { onDelete: 'cascade' }),
		season: integer('season').notNull(),
		episode: integer('episode').notNull(),
		watchedAt: integer('watched_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [uniqueIndex('watched_episodes_unique').on(t.itemId, t.season, t.episode)]
);

// Background tasks (backup, cleanup, ...): schedule and result of the last run.
// Rows are created with default values at startup (see server/tasks/scheduler.ts).
export const tasks = sqliteTable('tasks', {
	key: text('key').primaryKey(),
	enabled: integer('enabled', { mode: 'boolean' }).notNull(),
	frequency: text('frequency').$type<'hourly' | 'daily' | 'weekly' | 'monthly'>().notNull(),
	time: text('time').notNull(), // "HH:MM", server time zone (TZ)
	weekday: integer('weekday').notNull(), // 0 = Sunday, only used for "weekly"
	// When the schedule was last changed: times before that do not count as missed.
	changedAt: integer('changed_at', { mode: 'timestamp' }).notNull(),
	lastRunAt: integer('last_run_at', { mode: 'timestamp' }),
	lastDurationMs: integer('last_duration_ms'),
	// Disk space the last run freed (clean-up tasks only)
	lastFreedBytes: integer('last_freed_bytes'),
	lastError: text('last_error')
});

// Release dates of library items, refreshed by the "metadata" background task.
// Shown on the dashboard. `date` is YYYY-MM-DD (server time zone) or null if announced
// without a date.
export const releases = sqliteTable(
	'releases',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		itemId: integer('item_id')
			.notNull()
			.references(() => libraryItems.id, { onDelete: 'cascade' }),
		// cinema/home: movie in cinemas / digital or disc; release: movie (no regional date) or
		// game; earlyAccess/fullRelease: game that starts in early access; episode: one episode of a series or anime (anime use season 1)
		kind: text('kind').$type<ReleaseKind>().notNull(),
		date: text('date'),
		season: integer('season'),
		episode: integer('episode')
	},
	(t) => [index('releases_item').on(t.itemId)]
);

export type ReleaseKind = 'cinema' | 'home' | 'release' | 'earlyAccess' | 'fullRelease' | 'episode';
