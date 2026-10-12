CREATE TABLE `invitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tracking_id` integer NOT NULL,
	`from_user_id` integer NOT NULL,
	`to_user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tracking_id`) REFERENCES `trackings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_once` ON `invitations` (`tracking_id`,`to_user_id`);--> statement-breakpoint
CREATE INDEX `invitations_to` ON `invitations` (`to_user_id`);--> statement-breakpoint
CREATE INDEX `invitations_from` ON `invitations` (`from_user_id`);