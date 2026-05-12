CREATE TABLE `master_panel_reagents` (
	`id` text PRIMARY KEY NOT NULL,
	`master_panel_id` text NOT NULL,
	`reagent_kind` text NOT NULL,
	`concentration` real,
	`diluent` text,
	`volume_per_well` real NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`master_panel_id`) REFERENCES `master_panels`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reagent_kind_enum" CHECK("master_panel_reagents"."reagent_kind" IN ('beads', 'antibodies', 'sape')),
	CONSTRAINT "sape_conc_not_null" CHECK("master_panel_reagents"."reagent_kind" <> 'sape' OR "master_panel_reagents"."concentration" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `master_panel_reagents_master_kind_uniq` ON `master_panel_reagents` (`master_panel_id`,`reagent_kind`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_run_single_analytes` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`analyte_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analyte_id`) REFERENCES `analytes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_run_single_analytes`("id", "run_id", "analyte_id", "created_at") SELECT "id", "run_id", "analyte_id", "created_at" FROM `run_single_analytes`;--> statement-breakpoint
DROP TABLE `run_single_analytes`;--> statement-breakpoint
ALTER TABLE `__new_run_single_analytes` RENAME TO `run_single_analytes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`request_number` integer,
	`request_override_ad_hoc` integer DEFAULT false NOT NULL,
	`user_name` text NOT NULL,
	`operator_id` text NOT NULL,
	`run_date` text NOT NULL,
	`sample_type` text NOT NULL,
	`dilution_factor` real NOT NULL,
	`sample_count` integer NOT NULL,
	`replicate_mode` text NOT NULL,
	`request_type` text NOT NULL,
	`platform_id` text NOT NULL,
	`species_id` text NOT NULL,
	`panel_id` text,
	`volume_per_well` real NOT NULL,
	`dead_volume` real NOT NULL,
	`hamilton` integer NOT NULL,
	`run_plate_position` integer NOT NULL,
	`standard_position` integer NOT NULL,
	`trough_position` integer NOT NULL,
	`comments` text,
	`plex` integer NOT NULL,
	`plate_count` integer NOT NULL,
	`plates_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`machine_name` text,
	`is_offline_save` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`panel_id`) REFERENCES `premix_panels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_runs`("id", "request_number", "request_override_ad_hoc", "user_name", "operator_id", "run_date", "sample_type", "dilution_factor", "sample_count", "replicate_mode", "request_type", "platform_id", "species_id", "panel_id", "volume_per_well", "dead_volume", "hamilton", "run_plate_position", "standard_position", "trough_position", "comments", "plex", "plate_count", "plates_json", "created_at", "updated_at", "machine_name", "is_offline_save") SELECT "id", "request_number", "request_override_ad_hoc", "user_name", "operator_id", "run_date", "sample_type", "dilution_factor", "sample_count", "replicate_mode", "request_type", "platform_id", "species_id", "panel_id", "volume_per_well", "dead_volume", "hamilton", "run_plate_position", "standard_position", "trough_position", "comments", "plex", "plate_count", "plates_json", "created_at", "updated_at", "machine_name", "is_offline_save" FROM `runs`;--> statement-breakpoint
DROP TABLE `runs`;--> statement-breakpoint
ALTER TABLE `__new_runs` RENAME TO `runs`;--> statement-breakpoint
DROP INDEX `master_panels_platform_species_uniq`;--> statement-breakpoint
ALTER TABLE `master_panels` ADD `sape_name` text;--> statement-breakpoint
ALTER TABLE `master_panels` ADD `description` text;--> statement-breakpoint
CREATE UNIQUE INDEX `master_panels_platform_species_name_uniq` ON `master_panels` (`platform_id`,`species_id`,`name`);--> statement-breakpoint
ALTER TABLE `master_panels` DROP COLUMN `beads_volume_per_well`;--> statement-breakpoint
ALTER TABLE `master_panels` DROP COLUMN `ab_volume_per_well`;--> statement-breakpoint
ALTER TABLE `master_panels` DROP COLUMN `sape_volume_per_well`;