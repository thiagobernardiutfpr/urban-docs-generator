import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DocumentFinalPreview from "../client/src/components/DocumentFinalPreview";
import { renderDocument } from "./urbanDocs";

describe("emissão e pré-visualização final", () => {
  it("gera DOCX/PDF reais e conecta a URL PDF da emissão à pré-visualização incorporada", async () => {
    const rendered = await renderDocument({
      documentType: "certidao_tombamento",
      fields: {
        protocolo: "INTEGRACAO-2026/001",
        inscricao_imobiliaria: "01.02.175.0140.001",
        interessado: "Interessado de integração",
        endereco: "Rua de Teste, 100",
        resultado_tombamento: "Consulta de integração para conferência da prévia.",
      },
    });
    const pdfUrl = `/manus-storage/${rendered.filename}_integracao.pdf`;
    const markup = renderToStaticMarkup(createElement(DocumentFinalPreview, { output: { docx: { storageUrl: `/manus-storage/${rendered.filename}_integracao.docx` }, pdf: { storageUrl: pdfUrl } } }));
    expect(Buffer.from(rendered.docxBytes).subarray(0, 2).toString()).toBe("PK");
    expect(Buffer.from(rendered.pdfBytes).subarray(0, 4).toString()).toBe("%PDF");
    expect(markup).toContain(`src="${pdfUrl}#view=FitH"`);
    expect(markup).toContain("Pré-visualização do documento final");
  });
});
