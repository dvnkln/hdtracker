CREATE TABLE `anime_tmdb_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anilist_id` integer NOT NULL,
	`tmdb_id` integer NOT NULL,
	`season` integer NOT NULL,
	`source_range` text NOT NULL,
	`target_range` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `anime_tmdb_map_anilist` ON `anime_tmdb_map` (`anilist_id`);