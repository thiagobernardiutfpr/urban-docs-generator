import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  updateRequest: vi.fn(),
  getRequestById: vi.fn(),
  listSpatialSources: vi.fn(),
  getFileById: vi.fn(),
  updateRequestExtractedData: vi.fn(),
  extractGeoPackageLot: vi.fn(),
  extractSpreadsheetLot: vi.fn(),
}));

vi.mock("./db", () => ({
  updateRequest: mocks.updateRequest,
  getRequestById: mocks.getRequestById,
  listSpatialSources: mocks.listSpatialSources,
  getFileById: mocks.getFileById,
  updateRequestExtractedData: mocks.updateRequestExtractedData,
}));
vi.mock("./storage", () => ({ storagePut: vi.fn() }));
vi.mock("./urbanDocs", () => ({
  downloadStorageBytes: vi.fn(),
  extractGeoPackageLot: mocks.extractGeoPackageLot,
  extractSpreadsheetLot: mocks.extractSpreadsheetLot,
  renderDocument: vi.fn(),
  signPdfWithSystemStamp: vi.fn(),
}));

import { appRouter } from "./routers";

function context(): TrpcContext {
  return {
    user: { id: 1, openId: "owner", email: "owner@municipio.gov.br", name: "Admin", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("edição de processos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persiste campos editáveis e dados estruturados no processo informado", async () => {
    mocks.updateRequest.mockResolvedValue({ id: 42, protocol: "PROC-2026/42" });
    const caller = appRouter.createCaller(context());

    const result = await caller.requests.update({
      id: 42,
      protocol: "PROC-2026/42",
      enrollment: "01.02.175.0140.001",
      applicant: "Interessado atualizado",
      description: "Objeto revisado",
      formData: { zoneamento: "ZR-3", endereco: "Rua Central, 100" },
    });

    expect(mocks.updateRequest).toHaveBeenCalledWith(1, 42, expect.objectContaining({ protocol: "PROC-2026/42", formData: { zoneamento: "ZR-3", endereco: "Rua Central, 100" } }));
    expect(result).toEqual({ id: 42, protocol: "PROC-2026/42" });
  });

  it("conclui o cruzamento mesmo quando uma fonte GeoPackage falha", async () => {
    mocks.getRequestById.mockResolvedValue({ id: 42, enrollment: "01.02.175.0140.001", status: "collecting" });
    mocks.listSpatialSources.mockResolvedValue([{ id: 9, name: "GeoPackage EIV", kind: "geopackage", fileId: 71 }]);
    mocks.getFileById.mockResolvedValue({ id: 71, storageKey: "eiv/base.gpkg" });
    mocks.extractGeoPackageLot.mockRejectedValue(new Error("GeoPackage inválido"));
    mocks.updateRequestExtractedData.mockResolvedValue({ id: 42, extractedData: { fontes_consultadas: [], inscricao_consultada: "01.02.175.0140.001" } });
    const caller = appRouter.createCaller(context());

    const result = await caller.spatial.crossReference({ requestId: 42 });

    expect(mocks.updateRequestExtractedData).toHaveBeenCalledWith(1, 42, expect.objectContaining({ fontes_consultadas: [], inscricao_consultada: "01.02.175.0140.001" }));
    expect(result.processedSources).toBe(1);
    expect(result.sourceFailures).toEqual([{ source: "GeoPackage EIV", message: "GeoPackage inválido" }]);
  });
});
