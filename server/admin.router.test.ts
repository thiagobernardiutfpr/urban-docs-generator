import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { Document, Packer, Paragraph } from "docx";

const dbMock = vi.hoisted(() => ({
  setTemplateActive: vi.fn(),
  setSpatialSourceActive: vi.fn(),
  setReferenceActive: vi.fn(),
  listTemplates: vi.fn(),
  listReferences: vi.fn(),
  createFileRecord: vi.fn(),
  createTemplate: vi.fn(),
  createReference: vi.fn(),
}));

const storageMock = vi.hoisted(() => ({ storagePut: vi.fn() }));

vi.mock("./db", () => ({
  setTemplateActive: dbMock.setTemplateActive,
  setSpatialSourceActive: dbMock.setSpatialSourceActive,
  setReferenceActive: dbMock.setReferenceActive,
  listTemplates: dbMock.listTemplates,
  listReferences: dbMock.listReferences,
  createFileRecord: dbMock.createFileRecord,
  createTemplate: dbMock.createTemplate,
  createReference: dbMock.createReference,
}));

vi.mock("./storage", () => ({ storagePut: storageMock.storagePut }));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: {
      id: 11,
      openId: "admin-open-id",
      email: "admin@municipio.gov.br",
      name: "Administração",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("administração de acervos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.storagePut.mockResolvedValue({ key: "urban-docs/11/library/modelo.docx", url: "/manus-storage/modelo.docx" });
    dbMock.createFileRecord.mockResolvedValue({ id: 75, filename: "modelo.docx" });
    dbMock.createTemplate.mockResolvedValue({ id: 88, documentType: "parecer_eiv", version: "2.0", fileId: 75 });
    dbMock.createReference.mockResolvedValue({ id: 91, documentType: "certidao_tombamento", fileId: 75 });
  });

  it("encaminha a ativação e o arquivamento de modelos para o usuário autenticado", async () => {
    dbMock.setTemplateActive.mockResolvedValue({ id: 9, isActive: 0 });
    const caller = appRouter.createCaller(context());
    await caller.templates.setActive({ id: 9, isActive: false });
    expect(dbMock.setTemplateActive).toHaveBeenCalledWith(11, 9, false);
  });

  it("encaminha a ativação e o arquivamento de fontes territoriais para o usuário autenticado", async () => {
    dbMock.setSpatialSourceActive.mockResolvedValue({ id: 4, isActive: 1 });
    const caller = appRouter.createCaller(context());
    await caller.spatial.setActive({ id: 4, isActive: true });
    expect(dbMock.setSpatialSourceActive).toHaveBeenCalledWith(11, 4, true);
  });

  it("cadastra uma nova versão DOCX vinculada à tipologia selecionada", async () => {
    const caller = appRouter.createCaller(context());
    const model = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("Endereço: {endereco}")] }] }));
    await caller.templates.upload({ documentType: "parecer_eiv", name: "Parecer EIV 2.0", version: "2.0", payload: { filename: "modelo.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", contentBase64: model.toString("base64") } });
    expect(dbMock.createFileRecord).toHaveBeenCalledWith(expect.objectContaining({ userId: 11, category: "template", filename: "modelo.docx" }));
    expect(dbMock.createTemplate).toHaveBeenCalledWith(expect.objectContaining({ userId: 11, documentType: "parecer_eiv", version: "2.0", fileId: 75 }));
  });

  it("expõe o endereço de abertura do arquivo na listagem de versões", async () => {
    dbMock.listTemplates.mockResolvedValue([{ id: 88, documentType: "parecer_eiv", version: "2.0", storageUrl: "/manus-storage/modelo.docx", filename: "modelo.docx" }]);
    const caller = appRouter.createCaller(context());
    const result = await caller.templates.list();
    expect(result[0]).toMatchObject({ filename: "modelo.docx", storageUrl: "/manus-storage/modelo.docx" });
  });

  it("cadastra e arquiva uma referência PDF vinculada à tipologia correta", async () => {
    const caller = appRouter.createCaller(context());
    await caller.references.upload({ documentType: "certidao_tombamento", title: "Certidão de tombamento", description: "Referência oficial", payload: { filename: "tombamento.pdf", mimeType: "application/pdf", contentBase64: "JVBERi0=" } });
    expect(dbMock.createFileRecord).toHaveBeenCalledWith(expect.objectContaining({ userId: 11, category: "reference", filename: "tombamento.pdf" }));
    expect(dbMock.createReference).toHaveBeenCalledWith(expect.objectContaining({ userId: 11, documentType: "certidao_tombamento", title: "Certidão de tombamento", fileId: 75 }));
    dbMock.setReferenceActive.mockResolvedValue({ id: 91, isActive: 0 });
    await caller.references.setActive({ id: 91, isActive: false });
    expect(dbMock.setReferenceActive).toHaveBeenCalledWith(11, 91, false);
  });

  it("expõe referências PDF com endereço de abertura", async () => {
    dbMock.listReferences.mockResolvedValue([{ id: 91, documentType: "certidao_tombamento", title: "Certidão de tombamento", storageUrl: "/manus-storage/tombamento.pdf", filename: "tombamento.pdf", isActive: 1 }]);
    const caller = appRouter.createCaller(context());
    const result = await caller.references.list();
    expect(result[0]).toMatchObject({ filename: "tombamento.pdf", storageUrl: "/manus-storage/tombamento.pdf" });
  });
});
