import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { Category, Status } from '../../status';
import type { SearchResult } from '../providers/types';

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
		posterUrl: text('poster_url'),
		overview: text('overview'),
		status: text('status').$type<Status>().notNull(),
		addedAt: integer('added_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		statusChangedAt: integer('status_changed_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [uniqueIndex('library_items_unique').on(t.category, t.source, t.externalId)]
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
		// game; episode: one episode of a series or anime (anime use season 1)
		kind: text('kind').$type<ReleaseKind>().notNull(),
		date: text('date'),
		season: integer('season'),
		episode: integer('episode')
	},
	(t) => [index('releases_item').on(t.itemId)]
);

export type ReleaseKind = 'cinema' | 'home' | 'release' | 'episode';
