import {
	blob,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import type { Category, Status } from '../../status';
import type { Details, SearchResult, ShowDetails } from '../providers/types';

// Simple key/value store for the settings of the whole installation (region, content
// language, ...). What every user sets for themselves is in `user_settings`.
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	// Admins manage the installation and its accounts; there is always at least one
	role: text('role').$type<'admin' | 'user'>().notNull().default('user'),
	// Locked: logging in is refused, everything else about the account stays
	disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
	// Set while the account has a temporary password (new, or reset by an admin): the next
	// page after logging in asks for a password of the user's own
	mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
	lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
	// The name others see instead of the username (empty: the username is shown)
	displayName: text('display_name'),
	// Profile picture: without one of their own, the first letter of the name on a colour
	// (hue 0–359, given at random). `avatar` is a small JPEG, see setAvatar() in users.ts.
	avatarColor: integer('avatar_color').notNull().default(210),
	avatar: blob('avatar', { mode: 'buffer' }),
	avatarUpdatedAt: integer('avatar_updated_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});

// What a user set for themselves (interface language, theme, shown areas, notifications, ...),
// see server/settings.ts for the keys and their defaults.
export const userSettings = sqliteTable(
	'user_settings',
	{
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		key: text('key').notNull(),
		value: text('value').notNull()
	},
	(t) => [primaryKey({ columns: [t.userId, t.key] })]
);

// One row per logged-in browser. `id` is the HMAC of the cookie token, never the token itself.
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

// A browser or installed app that receives push notifications (Web Push). `endpoint` is the
// address at the browser maker's push service, the two keys encrypt the message for this
// device only. Belongs to the user who switched it on.
export const pushSubscriptions = sqliteTable(
	'push_subscriptions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		// Shown in the list of devices, e.g. "Chrome · Android"
		label: text('label').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		// Last time the push service accepted a message for this device
		lastOkAt: integer('last_ok_at', { mode: 'timestamp' }),
		// Off: stays in the list with everything about it, but gets no messages
		enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true)
	},
	(t) => [index('push_subscriptions_user').on(t.userId)]
);

// Further ways to notify a user, besides their own devices (see server/channels.ts): a
// Pushover account, a webhook. Any number per user, each with a name and a switch – off
// keeps the settings. `config` holds what the kind needs (keys, address, ...).
export const notificationChannels = sqliteTable(
	'notification_channels',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		kind: text('kind').$type<'pushover' | 'ntfy' | 'webhook'>().notNull(),
		name: text('name').notNull(),
		enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
		config: text('config', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		lastOkAt: integer('last_ok_at', { mode: 'timestamp' }),
		// Why the last message could not be delivered (cleared by the next one that works)
		lastError: text('last_error')
	},
	(t) => [index('notification_channels_user').on(t.userId)]
);

// What a user was already notified about (a date of a title), so nothing is announced twice.
// Kept apart from `releases`, whose rows are rewritten with every refresh of a title.
export const notificationsSent = sqliteTable(
	'notifications_sent',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		itemId: integer('item_id')
			.notNull()
			.references(() => libraryItems.id, { onDelete: 'cascade' }),
		kind: text('kind').$type<ReleaseKind>().notNull(),
		// 0 where a date has no season or episode (movies, games)
		season: integer('season').notNull(),
		episode: integer('episode').notNull(),
		date: text('date').notNull()
	},
	(t) => [
		uniqueIndex('notifications_sent_once').on(
			t.userId,
			t.itemId,
			t.kind,
			t.season,
			t.episode,
			t.date
		)
	]
);

// A title somebody tracks: what the data source says about it, once for everyone. Who tracks
// it and how far they are is in `trackings` and `tracking_members`.
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
		// When title, poster and release dates were last loaded from the API. Empty = still to
		// be loaded (e.g. right after an import); the refresh queue picks these up.
		metadataUpdatedAt: integer('metadata_updated_at', { mode: 'timestamp' }),
		// Set when the data source no longer knows the title (deleted or merged there). What is
		// stored stays; the source is only asked again once a month. Empty = all fine.
		sourceMissingSince: integer('source_missing_since', { mode: 'timestamp' })
	},
	(t) => [uniqueIndex('library_items_unique').on(t.category, t.source, t.externalId)]
);

// One state of a title: its status and (in watched_episodes) the episodes ticked off. Somebody
// who tracks a title alone has a tracking of their own; people who track it together share one.
export const trackings = sqliteTable(
	'trackings',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		itemId: integer('item_id')
			.notNull()
			.references(() => libraryItems.id, { onDelete: 'cascade' }),
		status: text('status').$type<Status>().notNull(),
		statusChangedAt: integer('status_changed_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [index('trackings_item').on(t.itemId)]
);

// Who a tracking belongs to. `itemId` repeats the title of the tracking, so the database
// itself guarantees that a user has one state per title.
export const trackingMembers = sqliteTable(
	'tracking_members',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		trackingId: integer('tracking_id')
			.notNull()
			.references(() => trackings.id, { onDelete: 'cascade' }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		itemId: integer('item_id')
			.notNull()
			.references(() => libraryItems.id, { onDelete: 'cascade' }),
		// When this user added the title (or joined the tracking)
		addedAt: integer('added_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		// Off: no notifications about this title for this user (the bell on its page)
		notify: integer('notify', { mode: 'boolean' }).notNull().default(true)
	},
	(t) => [
		uniqueIndex('tracking_members_once').on(t.userId, t.itemId),
		index('tracking_members_tracking').on(t.trackingId)
	]
);

// An open invitation to track a title together: `fromUserId` (a member of the tracking) asks
// `toUserId` to join it. A row only exists while the invitation is open – answering or
// withdrawing it removes the row. It goes with the tracking and with either account.
export const invitations = sqliteTable(
	'invitations',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		trackingId: integer('tracking_id')
			.notNull()
			.references(() => trackings.id, { onDelete: 'cascade' }),
		fromUserId: integer('from_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		toUserId: integer('to_user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [
		uniqueIndex('invitations_once').on(t.trackingId, t.toUserId),
		index('invitations_to').on(t.toUserId),
		index('invitations_from').on(t.fromUserId)
	]
);

// What the user finds under "Inbox": something released (`kind` release, with what and when),
// or what somebody did with a title tracked together (`actorId` accepted or declined an
// invitation, or left). Unread until `readAt` is set; read ones are removed after a while.
// Open invitations are not stored here – they are in `invitations` until answered.
export type NoticeKind = 'release' | 'accepted' | 'declined' | 'left';
export const notices = sqliteTable(
	'notices',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		kind: text('kind').$type<NoticeKind>().notNull(),
		itemId: integer('item_id')
			.notNull()
			.references(() => libraryItems.id, { onDelete: 'cascade' }),
		actorId: integer('actor_id').references(() => users.id, { onDelete: 'cascade' }),
		// Releases only – a copy, because `releases` is rewritten with every refresh. Season and
		// episode are 0 where a date has none (movies, games).
		releaseKind: text('release_kind').$type<ReleaseKind>(),
		season: integer('season'),
		episode: integer('episode'),
		date: text('date'),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date()),
		readAt: integer('read_at', { mode: 'timestamp' })
	},
	(t) => [
		// A release is noted once per user (rows without a release never collide: NULLs differ)
		uniqueIndex('notices_release_once').on(
			t.userId,
			t.itemId,
			t.releaseKind,
			t.season,
			t.episode,
			t.date
		),
		index('notices_user').on(t.userId)
	]
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

// One row per watched episode of a tracking. Anime use season 1.
export const watchedEpisodes = sqliteTable(
	'watched_episodes',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		trackingId: integer('tracking_id')
			.notNull()
			.references(() => trackings.id, { onDelete: 'cascade' }),
		season: integer('season').notNull(),
		episode: integer('episode').notNull(),
		watchedAt: integer('watched_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(t) => [uniqueIndex('watched_episodes_unique').on(t.trackingId, t.season, t.episode)]
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
