import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { localStorageKeyFromValue, readLocalStorageBytes, resolveLocalStoragePath, storagePut } from "./storage";

const root = path.join(process.cwd(), "tmp", "local-storage-test");

afterEach(async () => {
  delete process.env.LOCAL_STORAGE_DIR;
  await rm(root, { recursive: true, force: true });
});

describe("armazenamento local", () => {
  it("grava e lê arquivos com chave local", async () => {
    process.env.LOCAL_STORAGE_DIR = root;
    await mkdir(root, { recursive: true });

    const stored = await storagePut("urban-docs/teste.txt", Buffer.from("conteúdo local"), "text/plain");
    const bytes = await readLocalStorageBytes(stored.key);

    expect(stored.key).toMatch(/^local:urban-docs\/teste_[a-f0-9]{8}\.txt$/);
    expect(stored.url).toMatch(/^\/local-storage\/urban-docs\/teste_[a-f0-9]{8}\.txt$/);
    expect(Buffer.from(bytes ?? []).toString("utf8")).toBe("conteúdo local");
  });

  it("lê arquivos legados por chave sem prefixo e por URL local relativa", async () => {
    process.env.LOCAL_STORAGE_DIR = root;
    const legacyKey = "urban-docs/1/requests/2/arquivo_antigo.docx";
    const filePath = resolveLocalStoragePath(legacyKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from("arquivo legado"));

    expect(localStorageKeyFromValue(legacyKey)).toBe(`local:${legacyKey}`);
    expect(localStorageKeyFromValue(`/local-storage/${legacyKey}`)).toBe(`local:${legacyKey}`);
    expect(Buffer.from((await readLocalStorageBytes(legacyKey)) ?? []).toString("utf8")).toBe("arquivo legado");
    expect(Buffer.from((await readLocalStorageBytes(`/local-storage/${legacyKey}`)) ?? []).toString("utf8")).toBe("arquivo legado");
  });

  it("recusa caminhos fora da raiz local", () => {
    process.env.LOCAL_STORAGE_DIR = root;
    expect(() => resolveLocalStoragePath("local:../fora.txt")).toThrow("Caminho de armazenamento local inválido");
  });
});
