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
CREATE UNIQUE INDEX `library_items_unique` ON `library_items` (`category`,`source`,`external_id`);