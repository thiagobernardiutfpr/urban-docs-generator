import { COOKIE_NAME } from "@shared/const";
import { documentTypes, getExtension, isImageFile, isSpatialFile, isSupportedUpload, maxUploadBytes, userRoles } from "@shared/urbanDocs";
import { getDemonstrationRequest } from "@shared/documentDemoData";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, roleProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { analyzeUploadedFile, analyzeUrbanInstruction } from "./urbanAI";
import { downloadStorageBytes, extractGeoPackageLot, extractSpreadsheetLot, inspectDocxTemplate, renderDocument, signPdfWithSystemStamp } from "./urbanDocs";
import { documentSchemas } from "../shared/documentFields";

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

async function storeFile(input: { userId: number; requestId?: number; category: "input" | "image" | "template" | "reference" | "spatial" | "generated_docx" | "generated_pdf" | "generated_signed_pdf"; filename: string; mimeType: string; content: Buffer | Uint8Array }) {
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
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), protocol: z.string().min(3).max(80).optional(), enrollment: z.string().max(120).optional(), applicant: z.string().max(320).optional(), description: z.string().max(4000).optional(), formData: z.record(z.string(), z.unknown()).optional() })).mutation(({ ctx, input }) => {
      const { id, ...changes } = input;
      return db.updateRequest(ctx.user.id, id, changes);
    }),
    applyFileExtraction: protectedProcedure.input(z.object({ id: z.number().int().positive(), fields: z.record(z.string(), z.string().max(4000)) })).mutation(async ({ ctx, input }) => {
      const request = await db.getRequestById(ctx.user.id, input.id);
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação não encontrada." });
      const allowed = new Set(documentSchemas[request.documentType as keyof typeof documentSchemas].fields.map((field) => field.key));
      const reviewedFields = Object.fromEntries(Object.entries(input.fields).filter(([key, value]) => allowed.has(key) && value.trim()));
      const baseFields = {
        protocol: input.fields.protocolo?.trim() || undefined,
        enrollment: input.fields.inscricao_imobiliaria?.trim() || undefined,
        applicant: input.fields.interessado?.trim() || undefined,
        description: input.fields.objeto?.trim() || undefined,
      };
      const updated = await db.updateRequest(ctx.user.id, input.id, { ...baseFields, formData: { ...(request.formData as Record<string, unknown> ?? {}), ...reviewedFields } });
      const audit = await db.createAiAudit({ userId: ctx.user.id, requestId: input.id, feature: "file_extraction_apply", model: "human_review", inputSnapshot: { fields: input.fields }, outputSnapshot: { applied: [...Object.keys(reviewedFields), ...Object.entries(baseFields).filter(([, value]) => value).map(([key]) => key)] }, reviewStatus: "applied", reviewedById: ctx.user.id, reviewedAt: new Date() });
      return { request: updated, auditId: audit.id };
    }),
    markReadyForReview: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.updateRequestStatus(ctx.user.id, input.id, "ready_for_review");
      return db.getRequestById(ctx.user.id, input.id);
    }),
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
    analyzeRequestFile: protectedProcedure.input(z.object({ requestId: z.number().int().positive(), fileId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const request = await db.getRequestById(ctx.user.id, input.requestId);
      const file = await db.getFileById(ctx.user.id, input.fileId);
      if (!request || !file || file.requestId !== input.requestId) throw new TRPCError({ code: "NOT_FOUND", message: "Arquivo ou solicitação não encontrados." });
      try {
        const analysis = await analyzeUploadedFile({ documentType: request.documentType as keyof typeof documentSchemas, filename: file.filename, mimeType: file.mimeType, storageKey: file.storageKey });
        const audit = await db.createAiAudit({ userId: ctx.user.id, requestId: request.id, feature: "file_extraction", model: "gpt-5-mini", inputSnapshot: { fileId: file.id, filename: file.filename, mimeType: file.mimeType }, outputSnapshot: analysis });
        return { analysis, auditId: audit.id, fileId: file.id };
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? `Não foi possível analisar “${file.filename}”: ${error.message}` : "Não foi possível analisar o arquivo." });
      }
    }),
  }),
  templates: router({
    list: protectedProcedure.query(({ ctx }) => db.listTemplates(ctx.user.id)),
    setActive: protectedProcedure.input(z.object({ id: z.number().int().positive(), isActive: z.boolean() })).mutation(({ ctx, input }) => db.setTemplateActive(ctx.user.id, input.id, input.isActive)),
    upload: protectedProcedure.input(z.object({ documentType: z.enum(documentTypes), name: z.string().min(3).max(255), version: z.string().min(1).max(40).default("1.0"), payload: filePayload })).mutation(async ({ ctx, input }) => {
      if (getExtension(input.payload.filename) !== "docx") throw new TRPCError({ code: "BAD_REQUEST", message: "Os modelos devem ser enviados em DOCX." });
      const content = readPayload(input.payload);
      const profile = inspectDocxTemplate(content);
      if (!profile.markerNames.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Para preservar o layout e preencher modelos futuros, inclua marcadores como {protocolo}, {endereco} ou {zoneamento} no corpo, cabeçalho ou rodapé do DOCX." });
      const file = await storeFile({ userId: ctx.user.id, category: "template", filename: input.payload.filename, mimeType: input.payload.mimeType, content });
      const template = await db.createTemplate({ userId: ctx.user.id, documentType: input.documentType, name: input.name, version: input.version, fileId: file.id });
      return { template, profile };
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
      if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação não encontrada." });
      const sources = await db.listSpatialSources(ctx.user.id);
      const extracted: Record<string, unknown> = {};
      const matchedSources: string[] = [];
      const sourceFailures: Array<{ source: string; message: string }> = [];
      if (request.enrollment) {
        for (const source of sources) {
          const file = await db.getFileById(ctx.user.id, source.fileId);
          if (!file) continue;
          try {
            const result = source.kind === "geopackage" ? await extractGeoPackageLot(file.storageKey, request.enrollment) : await extractSpreadsheetLot(file.storageKey, request.enrollment);
            if (result) {
              Object.assign(extracted, result);
              matchedSources.push(source.name);
            }
          } catch (error) {
            sourceFailures.push({ source: source.name, message: error instanceof Error ? error.message : "Falha ao consultar a fonte territorial." });
          }
        }
      }
      const updated = await db.updateRequestExtractedData(ctx.user.id, input.requestId, { ...extracted, fontes_consultadas: matchedSources, inscricao_consultada: request.enrollment ?? null, cruzamento_pendente: !request.enrollment });
      return { request: updated, extractedData: updated?.extractedData ?? {}, matchedSources, sourceFailures, processedSources: sources.length };
    }),
  }),
  ai: router({
    analyze: protectedProcedure.input(z.object({
      documentType: z.enum(documentTypes),
      protocol: z.string().max(80).optional(),
      enrollment: z.string().max(120).optional(),
      applicant: z.string().max(320).optional(),
      description: z.string().max(4000).optional(),
      fields: z.record(z.string(), z.string()).optional(),
      extractedData: z.record(z.string(), z.unknown()).optional(),
    })).mutation(async ({ ctx, input }) => {
      try {
        const analysis = await analyzeUrbanInstruction(input);
        const audit = await db.createAiAudit({ userId: ctx.user.id, feature: "instruction_analysis", model: "gpt-5-mini", inputSnapshot: input, outputSnapshot: analysis });
        return { ...analysis, auditId: audit.id };
      } catch {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Assistente de IA temporariamente indisponível. O preenchimento manual e a emissão do documento continuam disponíveis." });
      }
    }),
    chat: protectedProcedure.input(z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2500) })).min(1).max(10) })).mutation(async ({ ctx, input }) => {
      try {
        const { invokeLLM } = await import("./_core/llm");
        const response = await invokeLLM({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: "Você é o Assistente UrbanDocs, uma ferramenta de apoio para a equipe municipal. Oriente sobre os recursos do sistema: solicitações, modelos DOCX, referências PDF, dados territoriais, conferência cartográfica, geração e revisão de documentos. Não invente leis, dados cadastrais, zoneamento, resultados de certidões ou conclusões administrativas. Não faça diagnósticos legais. Quando for solicitada uma decisão, indique os dados a conferir e recomende validação por técnico competente. Responda em português brasileiro, com objetividade." },
            ...input.messages,
          ],
        });
        const answer = response.choices[0]?.message.content;
        if (typeof answer !== "string" || !answer.trim()) throw new Error("A IA não retornou uma resposta utilizável.");
        const audit = await db.createAiAudit({ userId: ctx.user.id, feature: "global_assistant", model: "gpt-5-mini", inputSnapshot: { messages: input.messages }, outputSnapshot: { answer } });
        return { answer, auditId: audit.id };
      } catch {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Assistente de IA temporariamente indisponível. O preenchimento manual e a emissão do documento continuam disponíveis." });
      }
    }),
    contextual: protectedProcedure.input(z.object({ scope: z.enum(["templates", "spatial_sources", "final_review"]), context: z.string().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
      try {
        const { invokeLLM } = await import("./_core/llm");
        const response = await invokeLLM({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: "Você é o Assistente UrbanDocs. Produza orientação curta e técnica para a equipe municipal, baseada somente no contexto fornecido. Não invente legislação, dados cadastrais, zoneamento, licenças, certidões ou conclusões administrativas. Liste pontos para conferência humana e deixe claro que a sugestão não autoriza emissão." },
            { role: "user", content: `Escopo: ${input.scope}\nContexto: ${input.context}` },
          ],
        });
        const answer = response.choices[0]?.message.content;
        if (typeof answer !== "string" || !answer.trim()) throw new Error("A IA não retornou uma orientação utilizável.");
        const audit = await db.createAiAudit({ userId: ctx.user.id, feature: `contextual_${input.scope}`, model: "gpt-5-mini", inputSnapshot: input, outputSnapshot: { answer } });
        return { answer, auditId: audit.id };
      } catch {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Assistente de IA temporariamente indisponível. O preenchimento manual e a emissão do documento continuam disponíveis." });
      }
    }),
    audits: roleProcedure(["reviewer", "approver", "admin"]).query(() => db.listAiAudits()),
    reviewAudit: roleProcedure(["reviewer", "approver", "admin"]).input(z.object({ auditId: z.number().int().positive(), reviewStatus: z.enum(["applied", "edited", "rejected"]), reviewNote: z.string().max(2000).optional() })).mutation(({ ctx, input }) => db.reviewAiAudit(input.auditId, ctx.user.id, input.reviewStatus, input.reviewNote)),
  }),
  governance: router({
    users: adminProcedure.query(() => db.listUsers()),
    setRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), role: z.enum(userRoles) })).mutation(({ input }) => db.setUserRole(input.userId, input.role)),
  }),
  approvals: router({
    list: roleProcedure(["reviewer", "approver", "admin"]).query(() => db.listDocumentApprovals()),
    decide: roleProcedure(["approver", "admin"]).input(z.object({ approvalId: z.number().int().positive(), status: z.enum(["approved", "rejected"]), decisionNote: z.string().max(2000).optional() })).mutation(({ ctx, input }) => db.decideDocumentApproval(input.approvalId, ctx.user.id, input.status, input.decisionNote)),
  }),
  signatures: router({
    get: protectedProcedure.input(z.object({ generatedDocumentId: z.number().int().positive() })).query(({ input }) => db.getDocumentSignature(input.generatedDocumentId)),
    list: roleProcedure(["reviewer", "approver", "admin"]).query(() => db.listDocumentSignatures()),
    previewDemo: protectedProcedure.mutation(async ({ ctx }) => {
      const demonstration = getDemonstrationRequest("certidao_tombamento");
      const rendered = await renderDocument({ documentType: "certidao_tombamento", fields: { protocolo: demonstration.protocol, inscricao_imobiliaria: demonstration.enrollment, interessado: demonstration.applicant, objeto: demonstration.description, ...demonstration.fields } });
      const signed = await signPdfWithSystemStamp({ pdfBytes: rendered.pdfBytes, signerName: ctx.user.name || "Aprovador UrbanDocs", signerRole: ctx.user.role });
      const stamp = Date.now();
      const prefix = `urban-docs/${ctx.user.id}/signature-demo`;
      const pdf = await storagePut(`${prefix}/${rendered.filename}_${stamp}_assinado.pdf`, signed.signedPdfBytes, "application/pdf");
      return { signedPdfUrl: pdf.url, signatureCode: signed.signatureCode, documentDigest: signed.documentDigest, signerName: ctx.user.name || "Aprovador UrbanDocs" };
    }),
    create: roleProcedure(["approver", "admin"]).input(z.object({ generatedDocumentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const approval = await db.getApprovalByDocument(input.generatedDocumentId);
      if (!approval || approval.status !== "approved") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A assinatura exige uma aprovação final registrada." });
      const generated = await db.getGeneratedDocumentById(input.generatedDocumentId);
      if (!generated) throw new TRPCError({ code: "NOT_FOUND", message: "Documento gerado não encontrado." });
      const originalPdf = await db.getFileByIdSystem(generated.pdfFileId);
      if (!originalPdf) throw new TRPCError({ code: "NOT_FOUND", message: "PDF original não encontrado." });
      const existing = await db.getDocumentSignature(input.generatedDocumentId);
      if (existing) return { signature: existing, signedPdf: await db.getFileByIdSystem(existing.signedPdfFileId) };
      const signed = await signPdfWithSystemStamp({ pdfBytes: await downloadStorageBytes(originalPdf.storageKey), signerName: ctx.user.name || "Aprovador UrbanDocs", signerRole: ctx.user.role });
      const signedPdf = await storeFile({ userId: generated.userId, requestId: generated.requestId, category: "generated_signed_pdf", filename: `${originalPdf.filename.replace(/\.pdf$/i, "")}_assinado.pdf`, mimeType: "application/pdf", content: signed.signedPdfBytes });
      const signature = await db.createDocumentSignature({ generatedDocumentId: generated.id, requestId: generated.requestId, signedById: ctx.user.id, signerName: ctx.user.name || "Aprovador UrbanDocs", signerRole: ctx.user.role, method: "urban-docs-system-sha256", documentDigest: signed.documentDigest, signatureCode: signed.signatureCode, signedPdfFileId: signedPdf.id });
      return { signature, signedPdf };
    }),
  }),
  generated: router({
    list: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).query(({ ctx, input }) => db.listGeneratedDocuments(ctx.user.id, input.requestId)),
    previewDemo: protectedProcedure.mutation(async ({ ctx }) => {
      const documentType = "certidao_tombamento" as const;
      const demonstration = getDemonstrationRequest(documentType);
      const rendered = await renderDocument({ documentType, fields: { protocolo: demonstration.protocol, inscricao_imobiliaria: demonstration.enrollment, interessado: demonstration.applicant, objeto: demonstration.description, ...demonstration.fields } });
      const stamp = Date.now();
      const prefix = `urban-docs/${ctx.user.id}/preview-demo`;
      const docx = await storagePut(`${prefix}/${rendered.filename}_${stamp}.docx`, rendered.docxBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const pdf = await storagePut(`${prefix}/${rendered.filename}_${stamp}.pdf`, rendered.pdfBytes, "application/pdf");
      return { docx: { storageUrl: docx.url }, pdf: { storageUrl: pdf.url } };
    }),
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
        const approval = await db.createDocumentApproval({ generatedDocumentId: generated.id, requestId: request.id, requestedById: ctx.user.id });
        return { generated, approval, docx: docxFile, pdf: pdfFile };
      } catch (error) {
        await db.updateRequestStatus(ctx.user.id, request.id, "failed");
        throw error;
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
