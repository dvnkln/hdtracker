CREATE TABLE `tasks` (
	`key` text PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	`frequency` text NOT NULL,
	`time` text NOT NULL,
	`weekday` integer NOT NULL,
	`changed_at` integer NOT NULL,
	`last_run_at` integer,
	`last_duration_ms` integer,
	`last_error` text
);
