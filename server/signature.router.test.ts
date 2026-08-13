import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getApprovalByDocument: vi.fn(), getGeneratedDocumentById: vi.fn(), getFileByIdSystem: vi.fn(), getDocumentSignature: vi.fn(), createFileRecord: vi.fn(), createDocumentSignature: vi.fn(),
  storagePut: vi.fn(), downloadStorageBytes: vi.fn(), signPdfWithSystemStamp: vi.fn(),
}));
vi.mock("./db", () => ({
  getApprovalByDocument: mocks.getApprovalByDocument,
  getGeneratedDocumentById: mocks.getGeneratedDocumentById,
  getFileByIdSystem: mocks.getFileByIdSystem,
  getDocumentSignature: mocks.getDocumentSignature,
  createFileRecord: mocks.createFileRecord,
  createDocumentSignature: mocks.createDocumentSignature,
}));
vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("./urbanDocs", async (importOriginal) => ({ ...(await importOriginal<typeof import("./urbanDocs")>()), downloadStorageBytes: mocks.downloadStorageBytes, signPdfWithSystemStamp: mocks.signPdfWithSystemStamp }));
import { appRouter } from "./routers";

const ctx: TrpcContext = { user: { id: 8, openId: "approver", email: "approver@municipio.gov.br", name: "Aprovador", loginMethod: "manus", role: "approver", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };

describe("assinatura institucional", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApprovalByDocument.mockResolvedValue({ id: 9, status: "approved" });
    mocks.getGeneratedDocumentById.mockResolvedValue({ id: 44, userId: 4, requestId: 6, pdfFileId: 12 });
    mocks.getFileByIdSystem.mockResolvedValue({ id: 12, filename: "certidao.pdf", storageKey: "pdf/original.pdf" });
    mocks.getDocumentSignature.mockResolvedValue(undefined);
    mocks.downloadStorageBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mocks.signPdfWithSystemStamp.mockResolvedValue({ signedPdfBytes: new Uint8Array([4, 5, 6]), documentDigest: "a".repeat(64), signatureCode: "URB-TEST-123" });
    mocks.storagePut.mockResolvedValue({ key: "pdf/assinado.pdf", url: "https://storage.local/assinado.pdf" });
    mocks.createFileRecord.mockResolvedValue({ id: 81, storageUrl: "https://storage.local/assinado.pdf" });
    mocks.createDocumentSignature.mockResolvedValue({ id: 91, signatureCode: "URB-TEST-123", documentDigest: "a".repeat(64) });
  });
  it("cria assinatura após aprovação e retorna o PDF assinado", async () => {
    const result = await appRouter.createCaller(ctx).signatures.create({ generatedDocumentId: 44 });
    expect(mocks.signPdfWithSystemStamp).toHaveBeenCalledWith(expect.objectContaining({ signerName: "Aprovador", signerRole: "approver" }));
    expect(mocks.createDocumentSignature).toHaveBeenCalledWith(expect.objectContaining({ generatedDocumentId: 44, signedPdfFileId: 81, documentDigest: "a".repeat(64), signatureCode: "URB-TEST-123" }));
    expect(result.signature.signatureCode).toBe("URB-TEST-123");
    expect(result.signedPdf.storageUrl).toBe("https://storage.local/assinado.pdf");
  });
});
