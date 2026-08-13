import { describe, expect, it, vi } from "vitest";
import { submitTemplateUpload, validateTemplateSelection } from "../shared/templateUpload";

describe("fluxo de envio de modelo DOCX", () => {
  it("rejeita arquivo ausente ou com formato inválido antes de iniciar a mutação", () => {
    expect(validateTemplateSelection(null)).toMatchObject({ ok: false, message: "Selecione um arquivo DOCX antes de enviar." });
    expect(validateTemplateSelection({ name: "modelo.pdf", size: 120 })).toMatchObject({ ok: false, message: "Selecione um arquivo DOCX para registrar o modelo oficial." });
  });

  it("envia o modelo selecionado com a versão e a tipologia escolhidas", async () => {
    const upload = vi.fn().mockResolvedValue({ id: 31 });
    const file = { name: "modelo_urbanistico.docx", size: 300, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    const result = await submitTemplateUpload({ file, documentType: "parecer_urbanistico", version: "2.1", encode: async () => ({ filename: file.name, mimeType: file.type, contentBase64: "UEs=" }), upload });
    expect(result).toEqual({ ok: true });
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ documentType: "parecer_urbanistico", name: "modelo_urbanistico", version: "2.1" }));
  });

  it("preserva o estado de falha quando a mutação de cadastro não é concluída", async () => {
    const file = { name: "modelo.docx", size: 300 };
    const result = await submitTemplateUpload({ file, documentType: "parecer_urbanistico", version: "", encode: async () => ({ filename: file.name, mimeType: "application/octet-stream", contentBase64: "UEs=" }), upload: async () => { throw new Error("Armazenamento indisponível"); } });
    expect(result).toEqual({ ok: false, message: "Armazenamento indisponível" });
  });
});
