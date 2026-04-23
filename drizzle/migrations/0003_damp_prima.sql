CREATE TABLE `operators` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operators_name_unique` ON `operators` (`name`);--> statement-breakpoint
CREATE TABLE `run_single_analytes` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`analyte_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analyte_id`) REFERENCES `analytes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `runs` (
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
	FOREIGN KEY (`operator_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`panel_id`) REFERENCES `premix_panels`(`id`) ON UPDATE no action ON DELETE no action
);
