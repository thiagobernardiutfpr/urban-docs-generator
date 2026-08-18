import { afterEach, describe, expect, it, vi } from "vitest";
import { Document, Paragraph, Packer } from "docx";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

import { analyzeUploadedFile } from "./urbanAI";
import { resolveLocalStoragePath, storagePut } from "./storage";

const root = path.join(process.cwd(), "tmp", "urban-ai-local-storage-test");

afterEach(async () => {
  vi.unstubAllGlobals();
  delete process.env.LOCAL_STORAGE_DIR;
  await rm(root, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe("análise de arquivos no armazenamento local", () => {
  it("analisa DOCX local sem tentar fazer fetch de uma URL relativa", async () => {
    process.env.LOCAL_STORAGE_DIR = root;
    await mkdir(root, { recursive: true });
    mocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ summary: "Arquivo lido", warnings: [], suggestions: [], requiresHumanReview: true }) } }],
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch não deveria ser chamado para arquivo local")));

    const docxBytes = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("Inscrição: 123.456.789.000")] }] }));
    const stored = await storagePut("urban-docs/1/requests/1/documento.docx", docxBytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    const result = await analyzeUploadedFile({
      documentType: "certidao_uso_ocupacao_solo",
      filename: "documento.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: stored.key,
    });

    expect(result.summary).toBe("Arquivo lido");
    expect(mocks.invokeLLM).toHaveBeenCalledOnce();
  });

  it("analisa DOCX legado usando a URL local registrada na base", async () => {
    process.env.LOCAL_STORAGE_DIR = root;
    await mkdir(root, { recursive: true });
    mocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ summary: "Arquivo legado lido", warnings: [], suggestions: [], requiresHumanReview: true }) } }],
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fetch não deveria ser chamado para URL local")));

    const legacyKey = "urban-docs/1/requests/2/documento_legacy.docx";
    const docxBytes = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("Documento legado")] }] }));
    const filePath = resolveLocalStoragePath(legacyKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, docxBytes);

    const result = await analyzeUploadedFile({
      documentType: "certidao_uso_ocupacao_solo",
      filename: "documento_legacy.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: legacyKey,
      storageUrl: `/local-storage/${legacyKey}`,
    });

    expect(result.summary).toBe("Arquivo legado lido");
    expect(mocks.invokeLLM).toHaveBeenCalledOnce();
  });
});
