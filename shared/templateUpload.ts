import { maxUploadBytes, type DocumentType } from "./urbanDocs";

export type TemplateFileLike = { name: string; size: number; type?: string };
export type TemplatePayload = { filename: string; mimeType: string; contentBase64: string };

export function validateTemplateSelection(file: TemplateFileLike | null | undefined) {
  if (!file) return { ok: false as const, message: "Selecione um arquivo DOCX antes de enviar." };
  if (!file.name.toLowerCase().endsWith(".docx")) return { ok: false as const, message: "Selecione um arquivo DOCX para registrar o modelo oficial." };
  if (file.size > maxUploadBytes) return { ok: false as const, message: "O modelo deve ter até 25 MB." };
  return { ok: true as const };
}

export async function submitTemplateUpload<TFile extends TemplateFileLike>(input: {
  file: TFile | null;
  documentType: DocumentType;
  version: string;
  encode: (file: TFile) => Promise<TemplatePayload>;
  upload: (payload: { documentType: DocumentType; name: string; version: string; payload: TemplatePayload }) => Promise<unknown>;
}) {
  if (!input.file) return { ok: false as const, message: "Selecione um arquivo DOCX antes de enviar." };
  const file = input.file;
  const validation = validateTemplateSelection(file);
  if (!validation.ok) return validation;
  try {
    await input.upload({ documentType: input.documentType, name: file.name.replace(/\.docx$/i, ""), version: input.version.trim() || "1.0", payload: await input.encode(file) });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Não foi possível enviar o modelo. Tente novamente." };
  }
}
