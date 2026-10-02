ALTER TABLE `library_items` ADD `mal_id` integer;--> statement-breakpoint
-- The ID comes with the normal loading of an anime: mark the anime as "details not loaded",
-- the refresh queue fills it in at the next start.
UPDATE `library_items` SET `metadata_updated_at` = NULL WHERE `category` = 'anime';
