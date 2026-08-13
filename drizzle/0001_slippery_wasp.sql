CREATE TABLE `documentFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int,
	`userId` int NOT NULL,
	`category` enum('input','image','template','spatial','generated_docx','generated_pdf') NOT NULL,
	`filename` varchar(255) NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`byteSize` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(700) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`protocol` varchar(80) NOT NULL,
	`documentType` varchar(80) NOT NULL,
	`status` enum('draft','collecting','cross_referenced','ready_for_review','processing','completed','failed') NOT NULL DEFAULT 'draft',
	`enrollment` varchar(120),
	`applicant` varchar(320),
	`description` text,
	`formData` json,
	`extractedData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentType` varchar(80) NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` varchar(40) NOT NULL DEFAULT '1.0',
	`isActive` int NOT NULL DEFAULT 1,
	`fileId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generatedDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`userId` int NOT NULL,
	`templateId` int,
	`versionNumber` int NOT NULL,
	`docxFileId` int NOT NULL,
	`pdfFileId` int NOT NULL,
	`dataSnapshot` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generatedDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spatialSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`kind` enum('spreadsheet','geopackage') NOT NULL,
	`fileId` int NOT NULL,
	`metadata` json,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spatialSources_id` PRIMARY KEY(`id`)
);
