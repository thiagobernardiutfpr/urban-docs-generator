import { COOKIE_NAME } from "@shared/const";
import { documentTypes, getExtension, isImageFile, isSpatialFile, isSupportedUpload, maxUploadBytes } from "@shared/urbanDocs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { downloadStorageBytes, extractGeoPackageLot, extractSpreadsheetLot, renderDocument } from "./urbanDocs";

const filePayload = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(160),
  contentBase64: z.string().min(1),
});

function readPayload(payload: z.infer<typeof filePayload>) {
  const buffer = Buffer.from(payload.contentBase64, "base64");
  if (!isSupportedUpload(payload.filename)) throw new TRPCError({ code: "BAD_REQUEST", message: "Formato de arquivo não suportado." });
  if (!buffer.length || buffer.length > maxUploadBytes) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O arquivo deve ter até 25 MB." });
  return buffer;
}

async function storeFile(input: { userId: number; requestId?: number; category: "input" | "image" | "template" | "reference" | "spatial" | "generated_docx" | "generated_pdf"; filename: string; mimeType: string; content: Buffer | Uint8Array }) {
  const keyPrefix = input.requestId ? `urban-docs/${input.userId}/requests/${input.requestId}` : `urban-docs/${input.userId}/library`;
  const { key, url } = await storagePut(`${keyPrefix}/${input.filename}`, input.content, input.mimeType);
  return db.createFileRecord({ userId: input.userId, requestId: input.requestId, category: input.category, filename: input.filename, mimeType: input.mimeType, byteSize: input.content.byteLength, storageKey: key, storageUrl: url });
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  requests: router({
    list: protectedProcedure.query(({ ctx }) => db.listRequests(ctx.user.id)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => db.getRequestById(ctx.user.id, input.id)),
    create: protectedProcedure.input(z.object({ protocol: z.string().min(3).max(80), documentType: z.enum(documentTypes), enrollment: z.string().max(120).optional(), applicant: z.string().max(320).optional(), description: z.string().max(4000).optional(), formData: z.record(z.string(), z.unknown()).optional() })).mutation(({ ctx, input }) => db.createRequest(ctx.user.id, input)),
    files: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).query(({ ctx, input }) => db.listFilesForRequest(ctx.user.id, input.requestId)),
  }),
  uploads: router({
    requestFile: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), payload: filePayload })).mutation(async ({ ctx, input }) => {
      const request = await db.getRequestById(ctx.user.id, input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação não encontrada." });
      const content = readPayload(input.payload);
      const category = isImageFile(input.payload.filename) ? "image" : "input" as const;
      return storeFile({ userId: ctx.user.id, requestId: input.requestId, category, filename: input.payload.filename, mimeType: input.payload.mimeType, content });
    }),
  }),
  templates: router({
    list: protectedProcedure.query(({ ctx }) => db.listTemplates(ctx.user.id)),
    setActive: protectedProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(({ ctx, input }) => db.setTemplateActive(ctx.user.id, input.id, input.isActive)),
    upload: protectedProcedure.input(z.object({ documentType: z.enum(documentTypes), name: z.string().min(3).max(255), version: z.string().min(1).max(40).default("1.0"), payload: filePayload })).mutation(async ({ ctx, input }) => {
      if (getExtension(input.payload.filename) !== "docx") throw new TRPCError({ code: "BAD_REQUEST", message: "Os modelos devem ser enviados em DOCX." });
      const content = readPayload(input.payload);
      const file = await storeFile({ userId: ctx.user.id, category: "template", filename: input.payload.filename, mimeType: input.payload.mimeType, content });
      return db.createTemplate({ userId: ctx.user.id, documentType: input.documentType, name: input.name, version: input.version, fileId: file.id });
    }),
  }),
  references: router({
    list: protectedProcedure.query(({ ctx }) => db.listReferences(ctx.user.id)),
    setActive: protectedProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(({ ctx, input }) => db.setReferenceActive(ctx.user.id, input.id, input.isActive)),
    upload: protectedProcedure.input(z.object({ documentType: z.enum(documentTypes), title: z.string().min(3).max(255), description: z.string().max(2000).optional(), payload: filePayload })).mutation(async ({ ctx, input }) => {
      if (getExtension(input.payload.filename) !== "pdf") throw new TRPCError({ code: "BAD_REQUEST", message: "Os documentos de referência devem ser enviados em PDF." });
      const content = readPayload(input.payload);
      const file = await storeFile({ userId: ctx.user.id, category: "reference", filename: input.payload.filename, mimeType: input.payload.mimeType, content });
      return db.createReference({ userId: ctx.user.id, documentType: input.documentType, title: input.title, description: input.description, fileId: file.id });
    }),
  }),
  spatial: router({
    list: protectedProcedure.query(({ ctx }) => db.listAllSpatialSources(ctx.user.id)),
    setActive: protectedProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(({ ctx, input }) => db.setSpatialSourceActive(ctx.user.id, input.id, input.isActive)),
    upload: protectedProcedure.input(z.object({ name: z.string().min(3).max(255), payload: filePayload })).mutation(async ({ ctx, input }) => {
      if (!isSpatialFile(input.payload.filename)) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie uma planilha XLS, XLSX, CSV ou um arquivo GeoPackage." });
      const content = readPayload(input.payload);
      const kind = getExtension(input.payload.filename) === "gpkg" ? "geopackage" : "spreadsheet" as const;
      const file = await storeFile({ userId: ctx.user.id, category: "spatial", filename: input.payload.filename, mimeType: input.payload.mimeType, content });
      return db.createSpatialSource({ userId: ctx.user.id, name: input.name, kind, fileId: file.id, metadata: { filename: input.payload.filename } });
    }),
    crossReference: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const request = await db.getRequestById(ctx.user.id, input.requestId);
      if (!request?.enrollment) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe uma inscrição imobiliária antes do cruzamento." });
      const sources = await db.listSpatialSources(ctx.user.id);
      const extracted: Record<string, unknown> = {};
      const matchedSources: string[] = [];
      for (const source of sources) {
        const file = await db.getFileById(ctx.user.id, source.fileId);
        if (!file) continue;
        const result = source.kind === "geopackage" ? await extractGeoPackageLot(file.storageKey, request.enrollment) : await extractSpreadsheetLot(file.storageKey, request.enrollment);
        if (result) {
          Object.assign(extracted, result);
          matchedSources.push(source.name);
        }
      }
      return db.updateRequestExtractedData(ctx.user.id, input.requestId, { ...extracted, fontes_consultadas: matchedSources, inscricao_consultada: request.enrollment });
    }),
  }),
  generated: router({
    list: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).query(({ ctx, input }) => db.listGeneratedDocuments(ctx.user.id, input.requestId)),
    create: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), templateId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => {
      const request = await db.getRequestById(ctx.user.id, input.requestId);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação não encontrada." });
      await db.updateRequestStatus(ctx.user.id, request.id, "processing");
      try {
        const template = input.templateId ? await db.getTemplateById(ctx.user.id, input.templateId) : await db.getActiveTemplate(ctx.user.id, request.documentType);
        const selectedTemplate = template ? await db.getFileById(ctx.user.id, template.fileId) : undefined;
        const templateBytes = selectedTemplate ? await downloadStorageBytes(selectedTemplate.storageKey) : undefined;
        const requestFiles = await db.listFilesForRequest(ctx.user.id, request.id);
        const images = await Promise.all(requestFiles.filter((file) => file.category === "image").slice(0, 4).map(async (file) => ({ name: file.filename, content: await downloadStorageBytes(file.storageKey), mimeType: file.mimeType })));
        const fields = { protocolo: request.protocol, inscricao_imobiliaria: request.enrollment, interessado: request.applicant, objeto: request.description, ...(request.formData as Record<string, unknown> ?? {}), ...(request.extractedData as Record<string, unknown> ?? {}) };
        const rendered = await renderDocument({ documentType: request.documentType as (typeof documentTypes)[number], fields, templateBytes, images });
        const docxFile = await storeFile({ userId: ctx.user.id, requestId: request.id, category: "generated_docx", filename: `${rendered.filename}_v${Date.now()}.docx`, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: rendered.docxBytes });
        const pdfFile = await storeFile({ userId: ctx.user.id, requestId: request.id, category: "generated_pdf", filename: `${rendered.filename}_v${Date.now()}.pdf`, mimeType: "application/pdf", content: rendered.pdfBytes });
        const generated = await db.createGeneratedDocument({ requestId: request.id, userId: ctx.user.id, templateId: template?.id, docxFileId: docxFile.id, pdfFileId: pdfFile.id, dataSnapshot: fields });
        await db.updateRequestStatus(ctx.user.id, request.id, "completed");
        return { generated, docx: docxFile, pdf: pdfFile };
      } catch (error) {
        await db.updateRequestStatus(ctx.user.id, request.id, "failed");
        throw error;
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
