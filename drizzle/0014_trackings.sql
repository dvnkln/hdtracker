CREATE TABLE `tracking_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tracking_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`item_id` integer NOT NULL,
	`added_at` integer NOT NULL,
	`notify` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`tracking_id`) REFERENCES `trackings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `library_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracking_members_once` ON `tracking_members` (`user_id`,`item_id`);--> statement-breakpoint
CREATE INDEX `tracking_members_tracking` ON `tracking_members` (`tracking_id`);--> statement-breakpoint
CREATE TABLE `trackings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`status` text NOT NULL,
	`status_changed_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `library_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trackings_item` ON `trackings` (`item_id`);--> statement-breakpoint
-- Existing libraries: every title gets one tracking with the same id as the title (which
-- makes moving the watched episodes below a plain copy), owned by the account there is.
INSERT INTO `trackings` (`id`, `item_id`, `status`, `status_changed_at`) SELECT `id`, `id`, `status`, `status_changed_at` FROM `library_items`;--> statement-breakpoint
INSERT INTO `tracking_members` (`tracking_id`, `user_id`, `item_id`, `added_at`, `notify`) SELECT `id`, (SELECT min(`id`) FROM `users`), `id`, `added_at`, `notify` FROM `library_items` WHERE EXISTS (SELECT 1 FROM `users`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_watched_episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tracking_id` integer NOT NULL,
	`season` integer NOT NULL,
	`episode` integer NOT NULL,
	`watched_at` integer NOT NULL,
	FOREIGN KEY (`tracking_id`) REFERENCES `trackings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_watched_episodes`("id", "tracking_id", "season", "episode", "watched_at") SELECT "id", "item_id", "season", "episode", "watched_at" FROM `watched_episodes`;--> statement-breakpoint
DROP TABLE `watched_episodes`;--> statement-breakpoint
ALTER TABLE `__new_watched_episodes` RENAME TO `watched_episodes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `watched_episodes_unique` ON `watched_episodes` (`tracking_id`,`season`,`episode`);--> statement-breakpoint
ALTER TABLE `library_items` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `library_items` DROP COLUMN `added_at`;--> statement-breakpoint
ALTER TABLE `library_items` DROP COLUMN `status_changed_at`;--> statement-breakpoint
ALTER TABLE `library_items` DROP COLUMN `notify`;