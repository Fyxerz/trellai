CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'feature' NOT NULL,
	`column` text DEFAULT 'features' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`branch_name` text,
	`worktree_path` text,
	`claude_session_id` text,
	`agent_status` text DEFAULT 'idle' NOT NULL,
	`commit_sha` text,
	`test_status` text,
	`test_results` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text,
	`project_id` text,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`column` text NOT NULL,
	`message_type` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`text` text NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`card_id` text,
	`filename` text NOT NULL,
	`stored_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`repo_path` text NOT NULL,
	`chat_session_id` text,
	`mode` text DEFAULT 'worktree' NOT NULL,
	`storage_mode` text DEFAULT 'local' NOT NULL,
	`user_id` text,
	`team_id` text,
	`created_at` text NOT NULL
);
