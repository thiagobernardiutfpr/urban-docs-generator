CREATE TABLE `documentReferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentType` varchar(80) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`fileId` int NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentReferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documentFiles` MODIFY COLUMN `category` enum('input','image','template','reference','spatial','generated_docx','generated_pdf') NOT NULL;