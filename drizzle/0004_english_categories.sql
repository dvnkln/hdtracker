-- Category keys are English now (they are also the URLs: /movies, /series, /games).
UPDATE `library_items` SET `category` = 'movies' WHERE `category` = 'filme';
--> statement-breakpoint
UPDATE `library_items` SET `category` = 'series' WHERE `category` = 'serien';
--> statement-breakpoint
UPDATE `library_items` SET `category` = 'games' WHERE `category` = 'spiele';
