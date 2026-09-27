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
CREATE INDEX `releases_item` ON `releases` (`item_id`);