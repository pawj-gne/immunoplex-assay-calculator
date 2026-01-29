ALTER TABLE `analytes` RENAME COLUMN `bead_stock_conc` TO `premix_conc`;--> statement-breakpoint
ALTER TABLE `analytes` RENAME COLUMN `antibody_stock_conc` TO `single_conc`;
