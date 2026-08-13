import { describe, expect, it } from "vitest";
import { canTransitionRequestStatus, getExtension, isSpatialFile, isSupportedUpload, normalizeEnrollment, normalizeFieldName } from "../shared/urbanDocs";
import { renderDocument } from "./urbanDocs";

describe("regras documentais urbanísticas", () => {
  it("normaliza inscrições imobiliárias preservando alfanuméricos", () => {
    expect(normalizeEnrollment("01.02.175.0140.001")).toBe("01021750140001");
    expect(normalizeEnrollment("ab-12 / 3")).toBe("AB123");
  });

  it("reconhece campos de inscrição escritos com acentos e separadores", () => {
    expect(normalizeFieldName("Inscrição Imobiliária")).toBe("inscricaoimobiliaria");
    expect(normalizeFieldName("COD. LOTE")).toBe("codlote");
  });

  it("aceita somente extensões previstas para os insumos", () => {
    expect(isSupportedUpload("planta.DWG")).toBe(true);
    expect(isSupportedUpload("dados.gpkg")).toBe(true);
    expect(isSupportedUpload("arquivo.exe")).toBe(false);
    expect(getExtension("modelo.final.docx")).toBe("docx");
    expect(isSpatialFile("cadastro.xlsx")).toBe(true);
    expect(isSpatialFile("imagem.png")).toBe(false);
  });

  it("gera versões DOCX e PDF quando não há modelo oficial associado", async () => {
    const output = await renderDocument({
      documentType: "certidao_uso_ocupacao_solo",
      fields: { protocolo: "UD-2026.0148", inscricao_imobiliaria: "01.02.175.0140.001", zoneamento: "ZR-3" },
    });

    expect(output.docxBytes.subarray(0, 2).toString()).toBe("PK");
    expect(Buffer.from(output.pdfBytes).subarray(0, 4).toString()).toBe("%PDF");
    expect(output.filename).toContain("certidao");
  });

  it("permite somente transições coerentes entre etapas de processamento", () => {
    expect(canTransitionRequestStatus("collecting", "cross_referenced")).toBe(true);
    expect(canTransitionRequestStatus("cross_referenced", "processing")).toBe(true);
    expect(canTransitionRequestStatus("processing", "completed")).toBe(true);
    expect(canTransitionRequestStatus("completed", "processing")).toBe(true);
    expect(canTransitionRequestStatus("draft", "completed")).toBe(false);
    expect(canTransitionRequestStatus("collecting", "completed")).toBe(false);
  });
});
