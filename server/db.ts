import { and, desc, eq, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { documentFiles, documentReferences, documentRequests, documentTemplates, generatedDocuments, InsertUser, spatialSources, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { canTransitionRequestStatus, type RequestStatus } from "../shared/urbanDocs";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type RequestInput = {
  protocol: string;
  documentType: string;
  enrollment?: string;
  applicant?: string;
  description?: string;
  formData?: Record<string, unknown>;
};

export async function createRequest(userId: number, input: RequestInput) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(documentRequests).values({ userId, ...input, status: "collecting" });
  return getRequestById(userId, Number(result[0].insertId));
}

export async function listRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentRequests).where(eq(documentRequests.userId, userId)).orderBy(desc(documentRequests.updatedAt));
}

export async function getRequestById(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documentRequests).where(and(eq(documentRequests.id, id), eq(documentRequests.userId, userId))).limit(1);
  return result[0];
}

export async function updateRequestExtractedData(userId: number, id: number, extractedData: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const current = await getRequestById(userId, id);
  if (!current) throw new Error("Solicitação não encontrada.");
  if (!canTransitionRequestStatus(current.status as RequestStatus, "cross_referenced")) throw new Error("A solicitação não está em um estágio compatível com o cruzamento.");
  await db.update(documentRequests).set({ extractedData, status: "cross_referenced" }).where(and(eq(documentRequests.id, id), eq(documentRequests.userId, userId)));
  return getRequestById(userId, id);
}

export async function updateRequestStatus(userId: number, id: number, status: "ready_for_review" | "processing" | "completed" | "failed") {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const current = await getRequestById(userId, id);
  if (!current) throw new Error("Solicitação não encontrada.");
  if (!canTransitionRequestStatus(current.status as RequestStatus, status)) throw new Error("Transição de status não permitida para esta solicitação.");
  await db.update(documentRequests).set({ status }).where(and(eq(documentRequests.id, id), eq(documentRequests.userId, userId)));
}

export async function createFileRecord(input: typeof documentFiles.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(documentFiles).values(input);
  const id = Number(result[0].insertId);
  const row = await db.select().from(documentFiles).where(eq(documentFiles.id, id)).limit(1);
  return row[0];
}

export async function listFilesForRequest(userId: number, requestId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentFiles).where(and(eq(documentFiles.userId, userId), eq(documentFiles.requestId, requestId))).orderBy(desc(documentFiles.createdAt));
}

export async function createTemplate(input: typeof documentTemplates.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(documentTemplates).values(input);
  const row = await db.select().from(documentTemplates).where(eq(documentTemplates.id, Number(result[0].insertId))).limit(1);
  return row[0];
}

export async function listTemplates(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const templates = await db.select().from(documentTemplates).where(eq(documentTemplates.userId, userId)).orderBy(desc(documentTemplates.updatedAt));
  return Promise.all(templates.map(async (template) => {
    const file = await getFileById(userId, template.fileId);
    return { ...template, storageUrl: file?.storageUrl, filename: file?.filename };
  }));
}

export async function setTemplateActive(userId: number, id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(documentTemplates).set({ isActive: isActive ? 1 : 0 }).where(and(eq(documentTemplates.id, id), eq(documentTemplates.userId, userId)));
  const result = await db.select().from(documentTemplates).where(and(eq(documentTemplates.id, id), eq(documentTemplates.userId, userId))).limit(1);
  return result[0];
}

export async function getActiveTemplate(userId: number, documentType: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documentTemplates).where(and(eq(documentTemplates.userId, userId), eq(documentTemplates.documentType, documentType), eq(documentTemplates.isActive, 1))).orderBy(desc(documentTemplates.updatedAt)).limit(1);
  return result[0];
}

export async function getTemplateById(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documentTemplates).where(and(eq(documentTemplates.userId, userId), eq(documentTemplates.id, id))).limit(1);
  return result[0];
}

export async function createReference(input: typeof documentReferences.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(documentReferences).values(input);
  const row = await db.select().from(documentReferences).where(eq(documentReferences.id, Number(result[0].insertId))).limit(1);
  return row[0];
}

export async function listReferences(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const references = await db.select().from(documentReferences).where(eq(documentReferences.userId, userId)).orderBy(desc(documentReferences.updatedAt));
  return Promise.all(references.map(async (reference) => {
    const file = await getFileById(userId, reference.fileId);
    return { ...reference, storageUrl: file?.storageUrl, filename: file?.filename };
  }));
}

export async function setReferenceActive(userId: number, id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(documentReferences).set({ isActive: isActive ? 1 : 0 }).where(and(eq(documentReferences.id, id), eq(documentReferences.userId, userId)));
  const row = await db.select().from(documentReferences).where(and(eq(documentReferences.id, id), eq(documentReferences.userId, userId))).limit(1);
  return row[0];
}

export async function getFileById(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documentFiles).where(and(eq(documentFiles.id, id), eq(documentFiles.userId, userId))).limit(1);
  return result[0];
}

export async function createSpatialSource(input: typeof spatialSources.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const result = await db.insert(spatialSources).values(input);
  const row = await db.select().from(spatialSources).where(eq(spatialSources.id, Number(result[0].insertId))).limit(1);
  return row[0];
}

export async function listSpatialSources(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(spatialSources).where(and(eq(spatialSources.userId, userId), eq(spatialSources.isActive, 1))).orderBy(desc(spatialSources.updatedAt));
}

export async function listAllSpatialSources(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(spatialSources).where(eq(spatialSources.userId, userId)).orderBy(desc(spatialSources.updatedAt));
}

export async function setSpatialSourceActive(userId: number, id: number, isActive: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.update(spatialSources).set({ isActive: isActive ? 1 : 0 }).where(and(eq(spatialSources.id, id), eq(spatialSources.userId, userId)));
  const result = await db.select().from(spatialSources).where(and(eq(spatialSources.id, id), eq(spatialSources.userId, userId))).limit(1);
  return result[0];
}

export async function createGeneratedDocument(input: Omit<typeof generatedDocuments.$inferInsert, "versionNumber">) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const versionResult = await db.select({ version: max(generatedDocuments.versionNumber) }).from(generatedDocuments).where(eq(generatedDocuments.requestId, input.requestId));
  const versionNumber = (versionResult[0]?.version ?? 0) + 1;
  const result = await db.insert(generatedDocuments).values({ ...input, versionNumber });
  const row = await db.select().from(generatedDocuments).where(eq(generatedDocuments.id, Number(result[0].insertId))).limit(1);
  return row[0];
}

export async function listGeneratedDocuments(userId: number, requestId: number) {
  const db = await getDb();
  if (!db) return [];
  const documents = await db.select().from(generatedDocuments).where(and(eq(generatedDocuments.userId, userId), eq(generatedDocuments.requestId, requestId))).orderBy(desc(generatedDocuments.versionNumber));
  return Promise.all(documents.map(async (document) => {
    const [docx, pdf] = await Promise.all([getFileById(userId, document.docxFileId), getFileById(userId, document.pdfFileId)]);
    return { ...document, docxUrl: docx?.storageUrl, pdfUrl: pdf?.storageUrl, docxFilename: docx?.filename, pdfFilename: pdf?.filename };
  }));
}
