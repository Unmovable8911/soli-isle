CREATE TABLE `health_check` (
  `id` integer PRIMARY KEY NOT NULL,
  `touched_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `health_check` (`id`, `touched_at`) VALUES (1, '1970-01-01T00:00:00.000Z');
--> statement-breakpoint
PRAGMA user_version = 1;
