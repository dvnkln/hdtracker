CREATE TABLE `wikidata_links` (
	`id` text PRIMARY KEY NOT NULL,
	`links` text NOT NULL,
	`fetched_at` integer NOT NULL
);
