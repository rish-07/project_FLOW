PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`venue_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`event_slot` text NOT NULL,
	`phone_primary` text NOT NULL,
	`phone_secondary` text,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text,
	`next_followup_on` text,
	`last_contacted_at` integer,
	`source_image_key` text,
	`extraction_confidence` text,
	`is_confirmed` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_leads`("id", "session_id", "venue_id", "customer_name", "event_type", "event_date", "event_slot", "phone_primary", "phone_secondary", "status", "notes", "next_followup_on", "last_contacted_at", "source_image_key", "extraction_confidence", "is_confirmed", "created_at") SELECT "id", "session_id", "venue_id", "customer_name", "event_type", "event_date", CASE WHEN upper(coalesce("event_time", '')) LIKE '%PM%' OR upper(coalesce("event_time", '')) LIKE '%EVEN%' OR upper(coalesce("event_time", '')) LIKE '%NIGHT%' THEN 'PM' ELSE 'AM' END, "phone_primary", "phone_secondary", "status", "notes", "next_followup_on", "last_contacted_at", "source_image_key", "extraction_confidence", "is_confirmed", "created_at" FROM `leads`;--> statement-breakpoint
DROP TABLE `leads`;--> statement-breakpoint
ALTER TABLE `__new_leads` RENAME TO `leads`;--> statement-breakpoint
PRAGMA foreign_keys=ON;