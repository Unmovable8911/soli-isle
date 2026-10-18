CREATE TABLE `asset` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`content_hash` text NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `asset_uploaded_at_idx` ON `asset` (`uploaded_at`);--> statement-breakpoint
CREATE TABLE `asset_reference` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`asset_id` text NOT NULL,
	`content_kind` text NOT NULL,
	`content_id` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_reference_asset_content_idx` ON `asset_reference` (`asset_id`,`content_kind`,`content_id`);--> statement-breakpoint
CREATE INDEX `asset_reference_content_idx` ON `asset_reference` (`content_kind`,`content_id`);--> statement-breakpoint
CREATE TABLE `asset_variant` (
	`asset_id` text NOT NULL,
	`variant` text NOT NULL,
	`byte_size` integer NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`format` text NOT NULL,
	PRIMARY KEY(`asset_id`, `variant`),
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade
);
