CREATE TABLE `master_panels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`platform_id` text NOT NULL,
	`species_id` text NOT NULL,
	`beads_volume_per_well` real NOT NULL,
	`ab_volume_per_well` real NOT NULL,
	`sape_volume_per_well` real NOT NULL,
	`vendor_singles_term` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `master_panels_platform_species_uniq` ON `master_panels` (`platform_id`,`species_id`);--> statement-breakpoint
ALTER TABLE `analytes` ADD `master_panel_id` text REFERENCES master_panels(id);--> statement-breakpoint
ALTER TABLE `premix_panels` ADD `master_panel_id` text REFERENCES master_panels(id);--> statement-breakpoint
ALTER TABLE `premix_panels` ADD `sub_panel_conc` real DEFAULT 1 NOT NULL;