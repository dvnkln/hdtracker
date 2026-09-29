ALTER TABLE `library_items` ADD `metadata_updated_at` integer;--> statement-breakpoint
-- Existing titles that already have details count as loaded, so an update does not reload
-- the whole library. Only titles without year and description (e.g. an unfinished import) load.
UPDATE `library_items` SET `metadata_updated_at` = CAST(strftime('%s', 'now') AS integer) WHERE `year` IS NOT NULL OR `overview` IS NOT NULL;
