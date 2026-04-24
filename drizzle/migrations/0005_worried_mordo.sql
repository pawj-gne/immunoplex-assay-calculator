CREATE TABLE `offline_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`operation` text NOT NULL,
	`payload` text NOT NULL,
	`queued_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `runs` ADD `machine_name` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `is_offline_save` integer DEFAULT false NOT NULL;