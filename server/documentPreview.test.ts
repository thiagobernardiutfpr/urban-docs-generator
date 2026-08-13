import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DocumentFinalPreview from "../client/src/components/DocumentFinalPreview";

describe("DocumentFinalPreview", () => {
  it("exibe a pré-visualização incorporada com a URL do PDF gerado", () => {
    const markup = renderToStaticMarkup(createElement(DocumentFinalPreview, { output: { docx: { storageUrl: "/manus-storage/ato.docx" }, pdf: { storageUrl: "/manus-storage/ato.pdf" } } }));
    expect(markup).toContain('title="Pré-visualização do documento final em PDF"');
    expect(markup).toContain('src="/manus-storage/ato.pdf#view=FitH"');
    expect(markup).toContain("Baixar DOCX");
  });
});
