CREATE TABLE `article` (
	`id` text PRIMARY KEY NOT NULL,
	`default_locale` text NOT NULL,
	`publication_state` text NOT NULL,
	`publish_time` text,
	`category_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `article_publication_state_idx` ON `article` (`publication_state`);--> statement-breakpoint
CREATE INDEX `article_publish_time_idx` ON `article` (`publish_time`);--> statement-breakpoint
CREATE INDEX `article_category_idx` ON `article` (`category_id`);--> statement-breakpoint
CREATE TABLE `article_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`locale` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body_json` text NOT NULL,
	`body_markdown` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `article`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `article_revision_article_locale_created_idx` ON `article_revision` (`article_id`,`locale`,`created_at`);--> statement-breakpoint
CREATE TABLE `article_slug` (
	`slug` text PRIMARY KEY NOT NULL,
	`article_id` text,
	`assigned_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `article`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_slug_article_idx` ON `article_slug` (`article_id`);--> statement-breakpoint
CREATE TABLE `article_slug_history` (
	`slug` text PRIMARY KEY NOT NULL,
	`article_id` text,
	`replaced_at` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `article`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `article_slug_history_article_idx` ON `article_slug_history` (`article_id`);--> statement-breakpoint
CREATE TABLE `article_tag` (
	`article_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`article_id`, `tag_id`),
	FOREIGN KEY (`article_id`) REFERENCES `article`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `article_tag_tag_idx` ON `article_tag` (`tag_id`);--> statement-breakpoint
CREATE TABLE `article_translation` (
	`article_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`body_json` text NOT NULL,
	`body_markdown` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`article_id`, `locale`),
	FOREIGN KEY (`article_id`) REFERENCES `article`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`slug` text NOT NULL,
	`path` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_path_idx` ON `category` (`path`);--> statement-breakpoint
CREATE INDEX `category_parent_idx` ON `category` (`parent_id`);--> statement-breakpoint
CREATE TABLE `category_translation` (
	`category_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`category_id`, `locale`),
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_slug_idx` ON `tag` (`slug`);--> statement-breakpoint
CREATE TABLE `tag_translation` (
	`tag_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`tag_id`, `locale`),
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
