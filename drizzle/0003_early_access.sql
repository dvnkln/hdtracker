ALTER TABLE `library_items` ADD `early_access` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Games get their early access state and exact first release from the single release dates:
-- mark them as "details not loaded", the refresh queue reloads them at the next start.
UPDATE `library_items` SET `metadata_updated_at` = NULL WHERE `category` = 'games';
