import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { getDemonstrationRequest } from "../shared/documentDemoData";

const mocks = vi.hoisted(() => ({
  getRequestById: vi.fn(),
  updateRequestStatus: vi.fn(),
  getActiveTemplate: vi.fn(),
  getFileById: vi.fn(),
  listFilesForRequest: vi.fn(),
  createFileRecord: vi.fn(),
  createGeneratedDocument: vi.fn(),
  createDocumentApproval: vi.fn(),
  storagePut: vi.fn(),
  downloadStorageBytes: vi.fn(),
  renderDocument: vi.fn(),
  signPdfWithSystemStamp: vi.fn(),
}));

vi.mock("./db", () => ({
  getRequestById: mocks.getRequestById,
  updateRequestStatus: mocks.updateRequestStatus,
  getActiveTemplate: mocks.getActiveTemplate,
  getFileById: mocks.getFileById,
  listFilesForRequest: mocks.listFilesForRequest,
  createFileRecord: mocks.createFileRecord,
  createGeneratedDocument: mocks.createGeneratedDocument,
  createDocumentApproval: mocks.createDocumentApproval,
}));

vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("./urbanDocs", () => ({ downloadStorageBytes: mocks.downloadStorageBytes, renderDocument: mocks.renderDocument, signPdfWithSystemStamp: mocks.signPdfWithSystemStamp }));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: { id: 1, openId: "owner", email: "owner@municipio.gov.br", name: "Admin", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("emissão com modelo oficial associado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateRequestStatus.mockResolvedValue(undefined);
    mocks.listFilesForRequest.mockResolvedValue([]);
    mocks.getFileById.mockResolvedValue({ id: 501, storageKey: "modelo-oficial.docx", filename: "modelo.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    mocks.downloadStorageBytes.mockResolvedValue(new Uint8Array([80, 75]));
    mocks.renderDocument.mockResolvedValue({ filename: "ato_urbanistico", docxBytes: Buffer.from("PKdocx"), pdfBytes: new Uint8Array([37, 80, 68, 70]) });
    mocks.storagePut.mockImplementation(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
    let fileId = 700;
    mocks.createFileRecord.mockImplementation(async (input: Record<string, unknown>) => ({ ...input, id: fileId++ }));
    mocks.createGeneratedDocument.mockImplementation(async (input: Record<string, unknown>) => ({ ...input, id: 900 }));
    mocks.createDocumentApproval.mockImplementation(async (input: Record<string, unknown>) => ({ ...input, id: 901, status: "pending" }));
  });

  it.each([
    [1, "laudo_viabilidade", 101],
    [2, "parecer_eiv", 102],
    [3, "diretriz_loteamento", 103],
  ] as const)("seleciona o modelo oficial do %s", async (requestId, documentType, templateId) => {
    mocks.getRequestById.mockResolvedValue({ id: requestId, protocol: `PROC-${requestId}`, documentType, enrollment: "01021750140001", applicant: "Interessado", description: "Objeto", formData: null, extractedData: null });
    mocks.getActiveTemplate.mockResolvedValue({ id: templateId, fileId: 501, documentType });
    const caller = appRouter.createCaller(context());

    const result = await caller.generated.create({ requestId });

    expect(mocks.getActiveTemplate).toHaveBeenCalledWith(1, documentType);
    expect(mocks.renderDocument).toHaveBeenCalledWith(expect.objectContaining({ documentType, templateBytes: expect.any(Uint8Array) }));
    expect(mocks.createGeneratedDocument).toHaveBeenCalledWith(expect.objectContaining({ templateId, requestId }));
    expect(result.docx.storageUrl).toContain(".docx");
    expect(result.pdf.storageUrl).toContain(".pdf");
  });

  it("emite uma certidão estruturada sem modelo DOCX a partir de dados de demonstração", async () => {
    const demonstration = getDemonstrationRequest("certidao_tombamento");
    mocks.getRequestById.mockResolvedValue({ id: 10, protocol: demonstration.protocol, documentType: "certidao_tombamento", enrollment: demonstration.enrollment, applicant: demonstration.applicant, description: demonstration.description, formData: demonstration.fields, extractedData: { zoneamento: "ZR-3" } });
    mocks.getActiveTemplate.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context());

    const result = await caller.generated.create({ requestId: 10 });

    expect(mocks.renderDocument).toHaveBeenCalledWith(expect.objectContaining({
      documentType: "certidao_tombamento",
      templateBytes: undefined,
      fields: expect.objectContaining({ resultado_tombamento: demonstration.fields.resultado_tombamento, protocolo: demonstration.protocol }),
    }));
    expect(mocks.createGeneratedDocument).toHaveBeenCalledWith(expect.objectContaining({ templateId: undefined, requestId: 10 }));
    expect(result.docx.storageUrl).toContain(".docx");
    expect(result.pdf.storageUrl).toContain(".pdf");
  });
});
