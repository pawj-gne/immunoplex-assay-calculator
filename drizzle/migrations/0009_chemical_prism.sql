ALTER TABLE `runs` ADD `sape_name` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `sape_concentration` real;--> statement-breakpoint
ALTER TABLE `runs` ADD `beads_diluent` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `antibodies_diluent` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `beads_volume_per_well` real;--> statement-breakpoint
ALTER TABLE `runs` ADD `antibodies_volume_per_well` real;--> statement-breakpoint
ALTER TABLE `runs` ADD `premix_concentration` real;--> statement-breakpoint
ALTER TABLE `runs` ADD `old_beads_override` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `old_antibodies_override` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `calculation_rules_version` text;