import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import { canApproveEmission, canReviewAi, canTransitionRequestStatus, documentTypes, getExtension, isSpatialFile, isSupportedUpload, normalizeEnrollment, normalizeFieldName } from "../shared/urbanDocs";
import { documentSchemas } from "../shared/documentFields";
import { getDemonstrationRequest } from "../shared/documentDemoData";
import { getPdfPreviewUrl } from "../shared/documentPreview";
import { projectPosition, renderDocument, signPdfWithSystemStamp } from "./urbanDocs";

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

  it("estrutura as certidões de uso do solo, tombamento e desapropriação sem modelo DOCX", async () => {
    const usage = await renderDocument({ documentType: "certidao_uso_ocupacao_solo", fields: { empresa_empreendedora: "Empresa Teste", cnae_atividades: "4520-0/05 — Serviços automotivos", endereco: "Rua Exemplo, 10", zoneamento: "ZC-4", enquadramento: "Permitido" } });
    const heritage = await renderDocument({ documentType: "certidao_tombamento", fields: { endereco: "Avenida Central, 20", resultado_tombamento: "Não há tombamento incidente", validade: "5 anos" } });
    const expropriation = await renderDocument({ documentType: "certidao_desapropriacao", fields: { endereco: "Avenida Central, 20", resultado_desapropriacao: "Não há decreto incidente", validade: "5 anos" } });
    const usageXml = new PizZip(usage.docxBytes).file("word/document.xml")?.asText() ?? "";
    const heritageXml = new PizZip(heritage.docxBytes).file("word/document.xml")?.asText() ?? "";
    const expropriationXml = new PizZip(expropriation.docxBytes).file("word/document.xml")?.asText() ?? "";
    expect(usageXml).toContain("Enquadramento");
    expect(usageXml).toContain("Permitido");
    expect(heritageXml).toContain("Consulta oficial");
    expect(heritageXml).toContain("Não há tombamento incidente");
    expect(expropriationXml).toContain("Não há decreto incidente");
  });

  it("mantém campos e itens de revisão específicos no catálogo das seis tipologias analisadas", () => {
    expect(documentSchemas.parecer_eiv.fields.some((field) => field.key === "resultado_checklist")).toBe(true);
    expect(documentSchemas.diretriz_loteamento.fields.some((field) => field.key === "restricoes_ambientais")).toBe(true);
    expect(documentSchemas.laudo_viabilidade.fields.some((field) => field.key === "cartas_viabilidade")).toBe(true);
    expect(documentSchemas.certidao_uso_ocupacao_solo.fields.some((field) => field.key === "cnae_atividades")).toBe(true);
    expect(documentSchemas.certidao_tombamento.reviewItems).toContain("Consultar base de bens tombados e áreas de entorno.");
    expect(documentSchemas.certidao_desapropriacao.reviewItems).toContain("Consultar decretos, DUP e interesse social vigentes.");
  });

  it("preenche valores de demonstração para todos os campos obrigatórios da tipologia selecionada", () => {
    const demonstration = getDemonstrationRequest("certidao_tombamento");
    expect(demonstration.protocol).toContain("TESTE");
    expect(demonstration.description).toContain("DADOS DE TESTE");
    expect(documentSchemas.certidao_tombamento.fields.filter((field) => field.required).every((field) => Boolean(demonstration.fields[field.key]))).toBe(true);
    expect(demonstration.fields.resultado_tombamento).toContain("DADO DE TESTE");
  });

  it("preenche todos os campos obrigatórios para cada tipologia do catálogo", () => {
    for (const type of documentTypes) {
      const demonstration = getDemonstrationRequest(type);
      const requiredFields = documentSchemas[type].fields.filter((field) => field.required);
      expect(demonstration.protocol).toBeTruthy();
      expect(demonstration.enrollment).toBeTruthy();
      expect(demonstration.applicant).toBeTruthy();
      expect(requiredFields.every((field) => Boolean(demonstration.fields[field.key]))).toBe(true);
    }
  });

  it("gera bytes DOCX e PDF reais para uma certidão preenchida automaticamente", async () => {
    const demonstration = getDemonstrationRequest("certidao_desapropriacao");
    const output = await renderDocument({
      documentType: "certidao_desapropriacao",
      fields: { protocolo: demonstration.protocol, inscricao_imobiliaria: demonstration.enrollment, interessado: demonstration.applicant, objeto: demonstration.description, ...demonstration.fields },
    });
    const documentXml = new PizZip(output.docxBytes).file("word/document.xml")?.asText() ?? "";
    expect(output.docxBytes.subarray(0, 2).toString()).toBe("PK");
    expect(Buffer.from(output.pdfBytes).subarray(0, 4).toString()).toBe("%PDF");
    expect(documentXml).toContain("Consulta oficial");
    expect(documentXml).toContain(demonstration.fields.resultado_desapropriacao);
  });

  it("monta uma URL de pré-visualização PDF sem reutilizar fragmentos anteriores", () => {
    expect(getPdfPreviewUrl("/manus-storage/documento.pdf")).toBe("/manus-storage/documento.pdf#view=FitH");
    expect(getPdfPreviewUrl("/manus-storage/documento.pdf#page=2")).toBe("/manus-storage/documento.pdf#view=FitH");
  });

  it("permite somente transições coerentes entre etapas de processamento", () => {
    expect(canTransitionRequestStatus("collecting", "cross_referenced")).toBe(true);
    expect(canTransitionRequestStatus("cross_referenced", "processing")).toBe(true);
    expect(canTransitionRequestStatus("processing", "completed")).toBe(true);
    expect(canTransitionRequestStatus("completed", "processing")).toBe(true);
    expect(canTransitionRequestStatus("draft", "completed")).toBe(false);
    expect(canTransitionRequestStatus("collecting", "completed")).toBe(false);
  });

  it("aplica acesso mínimo para revisão de IA e aprovação final", () => {
    expect(canReviewAi("author")).toBe(false);
    expect(canReviewAi("reviewer")).toBe(true);
    expect(canApproveEmission("reviewer")).toBe(false);
    expect(canApproveEmission("approver")).toBe(true);
    expect(canApproveEmission("admin")).toBe(true);
  });

  it("cria uma cópia PDF assinada com digest SHA-256 e código verificável", async () => {
    const output = await renderDocument({ documentType: "certidao_tombamento", fields: { protocolo: "TESTE-ASSINATURA", endereco: "Rua de Teste, 100" } });
    const signature = await signPdfWithSystemStamp({ pdfBytes: output.pdfBytes, signerName: "Aprovador de Teste", signerRole: "approver", signedAt: new Date("2026-08-13T12:00:00Z") });
    expect(signature.documentDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(signature.signatureCode).toMatch(/^URB-/);
    expect(Buffer.from(signature.signedPdfBytes).subarray(0, 4).toString()).toBe("%PDF");
    expect(signature.signedPdfBytes.byteLength).toBeGreaterThan(output.pdfBytes.byteLength);
  });

  it("reprojeta coordenadas UTM do GeoPackage para longitude e latitude de mapa", () => {
    const projected = projectPosition([449321.55, 7393491.8], 31982) as number[];
    expect(projected[0]).toBeGreaterThan(-52);
    expect(projected[0]).toBeLessThan(-51);
    expect(projected[1]).toBeGreaterThan(-24);
    expect(projected[1]).toBeLessThan(-23);
  });

  it("processa os três modelos oficiais associados ao acervo", async () => {
    const templates = [
      "modelo_laudo_viabilidade_LV_28904_2026.docx",
      "modelo_parecer_eiv_lebiconstrutora.docx",
      "modelo_diretriz_loteamento_21337_2026.docx",
    ];
    for (const filename of templates) {
      const bytes = await readFile(path.resolve("/home/ubuntu/webdev-static-assets", filename));
      const output = await renderDocument({ documentType: "parecer_urbanistico", templateBytes: bytes, fields: { protocolo: "TESTE-2026", inscricao_imobiliaria: "01021750140001" } });
      expect(output.docxBytes.subarray(0, 2).toString()).toBe("PK");
      expect(Buffer.from(output.pdfBytes).subarray(0, 4).toString()).toBe("%PDF");
    }
  });

  it("preenche dados nos modelos oficiais legados sem marcadores explícitos", async () => {
    const legacyTemplate = await readFile(path.resolve("/home/ubuntu/webdev-static-assets/modelo_parecer_eiv_lebiconstrutora.docx"));
    const output = await renderDocument({
      documentType: "parecer_eiv",
      templateBytes: legacyTemplate,
      fields: { protocolo: "9876/2026", empreendimento: "CONDOMÍNIO TESTE", interessado: "INTERESSADO TESTE", endereco: "Rua das Palmeiras", zoneamento: "ZR-4" },
    });
    const documentXml = new PizZip(output.docxBytes).file("word/document.xml")?.asText() ?? "";
    expect(documentXml).toContain("9876/2026");
    expect(documentXml).toContain("CONDOMÍNIO TESTE");
    expect(documentXml).toContain("INTERESSADO TESTE");
    expect(documentXml).toContain("Rua das Palmeiras");
  });

  it("compatibiliza os modelos de laudo de viabilidade e diretriz de loteamento", async () => {
    const lvTemplate = await readFile(path.resolve("/home/ubuntu/webdev-static-assets/modelo_laudo_viabilidade_LV_28904_2026.docx"));
    const lv = await renderDocument({ documentType: "laudo_viabilidade", templateBytes: lvTemplate, fields: { endereco: "Estrada Nova", bairro: "Gleba Teste", lote: "999", zoneamento: "ZR-5" } });
    const lvXml = new PizZip(lv.docxBytes).file("word/document.xml")?.asText() ?? "";
    expect(lvXml).toContain("Estrada Nova");
    expect(lvXml).toContain("Gleba Teste");

    const guidelineTemplate = await readFile(path.resolve("/home/ubuntu/webdev-static-assets/modelo_diretriz_loteamento_21337_2026.docx"));
    const guideline = await renderDocument({ documentType: "diretriz_loteamento", templateBytes: guidelineTemplate, fields: { endereco: "Rua do Projeto", lote: "Lote 100", coordenadas: "450000, 7393000", area: "50.000,00m²", matricula: "99.999", zoneamento: "ZR-5" } });
    const guidelineXml = new PizZip(guideline.docxBytes).file("word/document.xml")?.asText() ?? "";
    expect(guidelineXml).toContain("Rua do Projeto");
    expect(guidelineXml).toContain("Lote 100");
    expect(guidelineXml).toContain("99.999");
  });
});
