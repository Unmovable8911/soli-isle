CREATE TABLE `auth_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_at` text NOT NULL,
	`kind` text NOT NULL,
	`source` text,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `auth_audit_log_occurred_at_idx` ON `auth_audit_log` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `auth_audit_log_source_occurred_at_idx` ON `auth_audit_log` (`source`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`expires_at` text NOT NULL
);
