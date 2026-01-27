CREATE TABLE `analytes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bead_region` integer NOT NULL,
	`bead_stock_conc` real NOT NULL,
	`antibody_stock_conc` real NOT NULL,
	`platform_id` text NOT NULL,
	`species_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `panel_analytes` (
	`id` text PRIMARY KEY NOT NULL,
	`panel_id` text NOT NULL,
	`analyte_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`panel_id`) REFERENCES `premix_panels`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`analyte_id`) REFERENCES `analytes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `premix_panels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`platform_id` text NOT NULL,
	`species_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`species_id`) REFERENCES `species`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `species` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`platform_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`platform_id`) REFERENCES `platforms`(`id`) ON UPDATE no action ON DELETE no action
);
