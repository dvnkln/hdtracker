ALTER TABLE `users` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_color` integer DEFAULT 210 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar` blob;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_updated_at` integer;--> statement-breakpoint
-- Every existing account gets a colour of its own for the placeholder picture.
UPDATE `users` SET `avatar_color` = abs(random()) % 360;
