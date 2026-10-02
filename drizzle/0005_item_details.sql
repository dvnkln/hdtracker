CREATE TABLE `item_details` (
	`item_id` integer PRIMARY KEY NOT NULL,
	`info` text NOT NULL,
	`show` text,
	`fetched_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `library_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Fill the new table: mark all titles as "details not loaded", the refresh queue loads the
-- whole library once at the next start.
UPDATE `library_items` SET `metadata_updated_at` = NULL;
