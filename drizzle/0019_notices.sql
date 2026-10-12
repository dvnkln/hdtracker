CREATE TABLE `notices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`item_id` integer NOT NULL,
	`actor_id` integer,
	`release_kind` text,
	`season` integer,
	`episode` integer,
	`date` text,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `library_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notices_release_once` ON `notices` (`user_id`,`item_id`,`release_kind`,`season`,`episode`,`date`);--> statement-breakpoint
CREATE INDEX `notices_user` ON `notices` (`user_id`);