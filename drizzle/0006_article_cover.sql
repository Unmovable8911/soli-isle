ALTER TABLE `article` ADD `cover_asset_id` text REFERENCES asset(id) ON DELETE set null;
