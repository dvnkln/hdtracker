ALTER TABLE `library_items` ADD `release_date` text;--> statement-breakpoint
-- Existing titles from earlier years are certainly out: the start of their year stands in until
-- the next refresh stores the exact day, so an update does not reload the whole library.
UPDATE `library_items` SET `release_date` = `year` || '-01-01' WHERE `year` IS NOT NULL AND `year` < CAST(strftime('%Y', 'now') AS integer);--> statement-breakpoint
-- Titles of this year, of coming years or without a year need their real date: mark them as
-- "details not loaded", the refresh queue picks them up at the next start.
UPDATE `library_items` SET `metadata_updated_at` = NULL WHERE `release_date` IS NULL;
