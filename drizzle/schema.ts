import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["author", "reviewer", "approver", "admin"]).default("author").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const documentRequests = mysqlTable("documentRequests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  protocol: varchar("protocol", { length: 80 }).notNull(),
  documentType: varchar("documentType", { length: 80 }).notNull(),
  status: mysqlEnum("status", ["draft", "collecting", "cross_referenced", "ready_for_review", "processing", "completed", "failed"]).default("draft").notNull(),
  enrollment: varchar("enrollment", { length: 120 }),
  applicant: varchar("applicant", { length: 320 }),
  description: text("description"),
  formData: json("formData"),
  extractedData: json("extractedData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const documentFiles = mysqlTable("documentFiles", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId"),
  userId: int("userId").notNull(),
  category: mysqlEnum("category", ["input", "image", "template", "reference", "spatial", "generated_docx", "generated_pdf", "generated_signed_pdf"]).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 160 }).notNull(),
  byteSize: int("byteSize").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 700 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const documentTemplates = mysqlTable("documentTemplates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  documentType: varchar("documentType", { length: 80 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 40 }).default("1.0").notNull(),
  isActive: int("isActive").default(1).notNull(),
  fileId: int("fileId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const documentReferences = mysqlTable("documentReferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  documentType: varchar("documentType", { length: 80 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  fileId: int("fileId").notNull(),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const spatialSources = mysqlTable("spatialSources", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  kind: mysqlEnum("kind", ["spreadsheet", "geopackage"]).notNull(),
  fileId: int("fileId").notNull(),
  metadata: json("metadata"),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const generatedDocuments = mysqlTable("generatedDocuments", {
  id: int("id").autoincrement().primaryKey(),
  requestId: int("requestId").notNull(),
  userId: int("userId").notNull(),
  templateId: int("templateId"),
  versionNumber: int("versionNumber").notNull(),
  docxFileId: int("docxFileId").notNull(),
  pdfFileId: int("pdfFileId").notNull(),
  dataSnapshot: json("dataSnapshot"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const aiAuditEvents = mysqlTable("aiAuditEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  requestId: int("requestId"),
  feature: varchar("feature", { length: 80 }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  inputSnapshot: json("inputSnapshot"),
  outputSnapshot: json("outputSnapshot").notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["pending", "applied", "edited", "rejected"]).default("pending").notNull(),
  reviewedById: int("reviewedById"),
  reviewNote: text("reviewNote"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const documentApprovals = mysqlTable("documentApprovals", {
  id: int("id").autoincrement().primaryKey(),
  generatedDocumentId: int("generatedDocumentId").notNull(),
  requestId: int("requestId").notNull(),
  requestedById: int("requestedById").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  decidedById: int("decidedById"),
  decisionNote: text("decisionNote"),
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const documentSignatures = mysqlTable("documentSignatures", {
  id: int("id").autoincrement().primaryKey(),
  generatedDocumentId: int("generatedDocumentId").notNull(),
  requestId: int("requestId").notNull(),
  signedById: int("signedById").notNull(),
  signerName: varchar("signerName", { length: 320 }).notNull(),
  signerRole: varchar("signerRole", { length: 40 }).notNull(),
  method: varchar("method", { length: 80 }).notNull(),
  documentDigest: varchar("documentDigest", { length: 128 }).notNull(),
  signatureCode: varchar("signatureCode", { length: 180 }).notNull(),
  signedPdfFileId: int("signedPdfFileId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
});
