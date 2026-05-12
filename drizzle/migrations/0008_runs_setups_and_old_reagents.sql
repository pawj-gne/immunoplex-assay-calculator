ALTER TABLE `runs` ADD `number_of_setups` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `old_beads` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `old_antibodies` real DEFAULT 0 NOT NULL;