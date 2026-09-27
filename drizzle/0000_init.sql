CREATE TABLE `library_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`title` text NOT NULL,
	`original_title` text,
	`year` integer,
	`poster_url` text,
	`overview` text,
	`status` text NOT NULL,
	`added_at` integer NOT NULL,
	`status_changed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_items_unique` ON `library_items` (`category`,`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `releases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`kind` text NOT NULL,
	`date` text,
	`season` integer,
	`episode` integer,
	FOREIGN KEY (`item_id`) REFERENCES `library_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `releases_item` ON `releases` (`item_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`key` text PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	`frequency` text NOT NULL,
	`time` text NOT NULL,
	`weekday` integer NOT NULL,
	`changed_at` integer NOT NULL,
	`last_run_at` integer,
	`last_duration_ms` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `watched_episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`item_id` integer NOT NULL,
	`season` integer NOT NULL,
	`episode` integer NOT NULL,
	`watched_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `library_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watched_episodes_unique` ON `watched_episodes` (`item_id`,`season`,`episode`);