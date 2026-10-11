CREATE TABLE `user_settings` (
	`user_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
-- What used to be set once for the installation and is personal from now on moves to the
-- account there is.
INSERT INTO `user_settings` (`user_id`, `key`, `value`) SELECT (SELECT min(`id`) FROM `users`), `key`, `value` FROM `settings` WHERE `key` IN ('uiLanguage', 'theme', 'animeTitle', 'hideSpoilers', 'autoStatus', 'categories', 'dashboardRecent', 'dashboardUpcoming', 'notifyMode', 'notifyHour', 'notifyFrom') AND EXISTS (SELECT 1 FROM `users`);--> statement-breakpoint
DELETE FROM `settings` WHERE `key` IN ('uiLanguage', 'theme', 'animeTitle', 'hideSpoilers', 'autoStatus', 'categories', 'dashboardRecent', 'dashboardUpcoming', 'notifyMode', 'notifyHour', 'notifyFrom');
