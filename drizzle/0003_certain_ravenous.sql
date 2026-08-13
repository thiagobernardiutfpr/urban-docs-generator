CREATE TABLE `aiAuditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`requestId` int,
	`feature` varchar(80) NOT NULL,
	`model` varchar(120) NOT NULL,
	`inputSnapshot` json,
	`outputSnapshot` json NOT NULL,
	`reviewStatus` enum('pending','applied','edited','rejected') NOT NULL DEFAULT 'pending',
	`reviewedById` int,
	`reviewNote` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiAuditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentApprovals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generatedDocumentId` int NOT NULL,
	`requestId` int NOT NULL,
	`requestedById` int NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`decidedById` int,
	`decisionNote` text,
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentApprovals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentSignatures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`generatedDocumentId` int NOT NULL,
	`requestId` int NOT NULL,
	`signedById` int NOT NULL,
	`signerName` varchar(320) NOT NULL,
	`signerRole` varchar(40) NOT NULL,
	`method` varchar(80) NOT NULL,
	`documentDigest` varchar(128) NOT NULL,
	`signatureCode` varchar(180) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `documentSignatures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('author','reviewer','approver','admin') NOT NULL DEFAULT 'author';