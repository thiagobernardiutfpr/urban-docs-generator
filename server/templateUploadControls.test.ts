import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TemplateUploadControls } from "../client/src/components/TemplateUploadControls";
import React from "react";

describe("controles visuais do envio de modelo", () => {
  it("mantém o envio desabilitado até que um DOCX seja selecionado", () => {
    const html = renderToStaticMarkup(React.createElement(TemplateUploadControls, { authenticated: true, pending: false, onSelect: vi.fn(), onSend: vi.fn() }));
    expect(html).toContain("Nenhum modelo selecionado");
    expect(html).toContain("Enviar modelo");
    expect(html).toContain("disabled");
  });

  it("exibe arquivo selecionado e estado de envio", () => {
    const selected = renderToStaticMarkup(React.createElement(TemplateUploadControls, { fileName: "modelo.docx", authenticated: true, pending: false, onSelect: vi.fn(), onSend: vi.fn() }));
    const pending = renderToStaticMarkup(React.createElement(TemplateUploadControls, { fileName: "modelo.docx", authenticated: true, pending: true, onSelect: vi.fn(), onSend: vi.fn() }));
    expect(selected).toContain("modelo.docx");
    expect(pending).toContain("Enviando…");
  });

  it("usa seleção e confirmação separadas em vez do envio direto no onChange", async () => {
    const source = await readFile(new URL("../client/src/components/TemplateRegistry.tsx", import.meta.url), "utf8");
    expect(source).toContain("onChange={chooseFile}");
    expect(source).toContain("onSelect={() => fileInputRef.current?.click()}");
    expect(source).toContain("onSend={() => void sendModel()}");
    expect(source).not.toContain("onChange={handleUpload}");
  });
});
