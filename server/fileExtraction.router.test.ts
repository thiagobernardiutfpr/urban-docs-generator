import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getRequestById: vi.fn(),
  getFileById: vi.fn(),
  createAiAudit: vi.fn(),
  updateRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
  analyzeUploadedFile: vi.fn(),
}));

vi.mock("./db", () => ({
  getRequestById: mocks.getRequestById,
  getFileById: mocks.getFileById,
  createAiAudit: mocks.createAiAudit,
  updateRequest: mocks.updateRequest,
  updateRequestStatus: mocks.updateRequestStatus,
}));
vi.mock("./storage", () => ({ storagePut: vi.fn() }));
vi.mock("./urbanAI", () => ({ analyzeUrbanInstruction: vi.fn(), analyzeUploadedFile: mocks.analyzeUploadedFile }));
vi.mock("./urbanDocs", () => ({ downloadStorageBytes: vi.fn(), extractGeoPackageLot: vi.fn(), extractSpreadsheetLot: vi.fn(), inspectDocxTemplate: vi.fn(), renderDocument: vi.fn(), signPdfWithSystemStamp: vi.fn() }));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return { user: { id: 1, openId: "owner", email: "owner@municipio.br", name: "Admin", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("extração revisada de anexos", () => {
  it("analisa um arquivo do processo e registra a sugestão para revisão humana", async () => {
    mocks.getRequestById.mockResolvedValue({ id: 9, userId: 1, documentType: "certidao_uso_ocupacao_solo", formData: {} });
    mocks.getFileById.mockResolvedValue({ id: 71, requestId: 9, filename: "cadastro.pdf", mimeType: "application/pdf", storageKey: "urban-docs/1/cadastro.pdf" });
    mocks.analyzeUploadedFile.mockResolvedValue({ summary: "Cadastro localizado", warnings: [], requiresHumanReview: true, suggestions: [{ key: "endereco", value: "Rua Central, 10", confidence: 92, evidence: "página 1" }] });
    mocks.createAiAudit.mockResolvedValue({ id: 201 });
    const result = await appRouter.createCaller(context()).uploads.analyzeRequestFile({ requestId: 9, fileId: 71 });
    expect(mocks.analyzeUploadedFile).toHaveBeenCalledWith(expect.objectContaining({ documentType: "certidao_uso_ocupacao_solo", filename: "cadastro.pdf" }));
    expect(mocks.createAiAudit).toHaveBeenCalledWith(expect.objectContaining({ requestId: 9, feature: "file_extraction", model: "gpt-5-mini" }));
    expect(result.analysis.suggestions[0]).toMatchObject({ key: "endereco", confidence: 92 });
  });

  it("aplica somente campos revisados, atualizando os dados-base e o formulário", async () => {
    mocks.getRequestById.mockResolvedValue({ id: 9, userId: 1, documentType: "certidao_uso_ocupacao_solo", protocol: "OLD", formData: { zoneamento: "ZR-1" } });
    mocks.updateRequest.mockResolvedValue({ id: 9, protocol: "PROC-9/2026" });
    mocks.createAiAudit.mockResolvedValue({ id: 202 });
    const result = await appRouter.createCaller(context()).requests.applyFileExtraction({ id: 9, fields: { protocolo: "PROC-9/2026", inscricao_imobiliaria: "00.00.001", interessado: "Requerente", endereco: "Rua Central, 10", zoneamento: "ZR-3", campo_invalido: "ignorar" } });
    expect(mocks.updateRequest).toHaveBeenCalledWith(1, 9, expect.objectContaining({ protocol: "PROC-9/2026", enrollment: "00.00.001", applicant: "Requerente", formData: { zoneamento: "ZR-3", endereco: "Rua Central, 10" } }));
    expect(result.auditId).toBe(202);
  });

  it("move a solicitação cruzada para a etapa de revisão antes da emissão", async () => {
    mocks.getRequestById.mockResolvedValue({ id: 9, status: "ready_for_review" });
    await appRouter.createCaller(context()).requests.markReadyForReview({ id: 9 });
    expect(mocks.updateRequestStatus).toHaveBeenCalledWith(1, 9, "ready_for_review");
  });
});
