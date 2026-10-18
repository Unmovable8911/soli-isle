CREATE TABLE `post` (
	`id` text PRIMARY KEY NOT NULL,
	`default_locale` text NOT NULL,
	`publication_state` text NOT NULL,
	`publish_time` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `post_publication_state_idx` ON `post` (`publication_state`);--> statement-breakpoint
CREATE INDEX `post_publish_time_idx` ON `post` (`publish_time`);--> statement-breakpoint
CREATE TABLE `post_image` (
	`post_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`post_id`, `asset_id`),
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `asset`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_image_post_position_idx` ON `post_image` (`post_id`,`position`);--> statement-breakpoint
CREATE INDEX `post_image_asset_idx` ON `post_image` (`asset_id`);--> statement-breakpoint
CREATE TABLE `post_tag` (
	`post_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_tag_tag_idx` ON `post_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `post_translation` (
	`post_id` text NOT NULL,
	`locale` text NOT NULL,
	`body_json` text NOT NULL,
	`body_markdown` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`post_id`, `locale`),
	FOREIGN KEY (`post_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);
