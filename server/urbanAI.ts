import { invokeLLM, resolveLlmConfig } from "./_core/llm";
import { documentTypeLabels, type DocumentType } from "../shared/urbanDocs";
import { documentSchemas } from "../shared/documentFields";
import PizZip from "pizzip";
import path from "node:path";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { readLocalStorageBytes, storageGetSignedUrl } from "./storage";

const execFileAsync = promisify(execFile);

export type UrbanAIAnalysis = {
  summary: string;
  missingFields: string[];
  riskFlags: string[];
  suggestedDraft: string;
  reviewNotice: string;
};

export type FileFieldSuggestion = { key: string; value: string; confidence: number; evidence: string };
export type FileExtractionAnalysis = { summary: string; warnings: string[]; suggestions: FileFieldSuggestion[]; requiresHumanReview: boolean };

type FileExtractionInput = {
  documentType: DocumentType;
  filename: string;
  mimeType: string;
  storageKey: string;
  storageUrl?: string;
};

type AnalysisInput = {
  documentType: DocumentType;
  protocol?: string;
  enrollment?: string;
  applicant?: string;
  description?: string;
  fields?: Record<string, string>;
  extractedData?: Record<string, unknown>;
};

const outputSchema = {
  name: "urban_docs_instruction_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      missingFields: { type: "array", items: { type: "string" } },
      riskFlags: { type: "array", items: { type: "string" } },
      suggestedDraft: { type: "string" },
      reviewNotice: { type: "string" },
    },
    required: ["summary", "missingFields", "riskFlags", "suggestedDraft", "reviewNotice"],
    additionalProperties: false,
  },
} as const;

function fileExtractionSchema(documentType: DocumentType) {
  const fieldKeys = ["protocolo", "inscricao_imobiliaria", "interessado", "objeto", ...documentSchemas[documentType].fields.map((field) => field.key)];
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "urban_docs_file_extraction",
      strict: true,
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          warnings: { type: "array", items: { type: "string" } },
          requiresHumanReview: { type: "boolean" },
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string", enum: fieldKeys },
                value: { type: "string" },
                confidence: { type: "integer", minimum: 0, maximum: 100 },
                evidence: { type: "string" },
              },
              required: ["key", "value", "confidence", "evidence"],
              additionalProperties: false,
            },
          },
        },
        required: ["summary", "warnings", "requiresHumanReview", "suggestions"],
        additionalProperties: false,
      },
    },
  } as const;
}

function decodeXmlText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function extractDocxText(bytes: Uint8Array) {
  const zip = new PizZip(bytes);
  return Object.keys(zip.files).filter((name) => /^word\/(?:document|header\d+|footer\d+)\.xml$/.test(name)).map((name) => decodeXmlText(zip.file(name)?.asText() ?? "")).join("\n").slice(0, 14_000);
}

async function extractLegacyDocText(bytes: Uint8Array, filename: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "urban-docs-extract-"));
  const source = path.join(directory, filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "documento.doc");
  const target = source.replace(/\.[^.]+$/, ".txt");
  try {
    await writeFile(source, bytes);
    const profile = pathToFileURL(path.join(directory, "libreoffice-profile")).href;
    await execFileAsync("libreoffice", [`-env:UserInstallation=${profile}`, "--headless", "--convert-to", "txt:Text", "--outdir", directory, source], { timeout: 100_000, maxBuffer: 2 * 1024 * 1024 });
    return (await readFile(target, "utf8")).slice(0, 14_000);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function extractDwgText(bytes: Uint8Array) {
  const readable = Buffer.from(bytes).toString("latin1").match(/[\x20-\x7EÀ-ÿ]{4,}/g) ?? [];
  return readable.filter((part) => /[A-Za-zÀ-ÿ]/.test(part)).slice(0, 350).join("\n").slice(0, 14_000);
}

function parseStructuredAiContent<T>(content: string, operation: string): T {
  const normalized = content.trim();
  if (/service unavailable|temporarily unavailable/i.test(normalized)) {
    throw new Error("O provedor de IA está indisponível no momento. Tente novamente mais tarde ou use o preenchimento manual.");
  }

  const unfenced = normalized.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const parsed = JSON.parse(unfenced) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Resposta estruturada inválida");
    return parsed as T;
  } catch {
    throw new Error(`A IA retornou uma resposta inválida para ${operation}. Tente novamente mais tarde.`);
  }
}

function cleanInput(input: AnalysisInput) {
  return {
    tipo: documentTypeLabels[input.documentType],
    protocolo: input.protocol || "Não informado",
    inscricao_imobiliaria: input.enrollment || "Não informada",
    interessado: input.applicant || "Não informado",
    objeto: input.description || "Não informado",
    campos_formulario: input.fields ?? {},
    dados_territoriais: input.extractedData ?? {},
    campos_requeridos: documentSchemas[input.documentType].fields.filter((field) => field.required).map((field) => field.label),
    alertas_de_revisao: documentSchemas[input.documentType].reviewItems,
  };
}

export async function analyzeUrbanInstruction(input: AnalysisInput): Promise<UrbanAIAnalysis> {
  const data = cleanInput(input);
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "Você é um assistente de instrução documental urbanística. Analise somente os dados fornecidos. Não invente informações, normas, certidões, resultados de consulta ou conclusões legais. Diferencie claramente dados ausentes de dados que exigem validação humana. Produza conteúdo conciso, técnico e em português brasileiro. A redação sugerida deve ser um rascunho neutro, com expressões como 'conforme dados informados' quando a fonte não estiver confirmada. A decisão, a assinatura e a emissão oficial dependem de técnico competente.",
      },
      {
        role: "user",
        content: `Analise a seguinte instrução para ${data.tipo} e gere a resposta no formato solicitado:\n${JSON.stringify(data)}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: outputSchema },
  });
  const choice = response.choices?.[0];
  if (!choice) throw new Error("A IA não retornou uma análise utilizável.");
  const content = choice.message?.content;
  if (typeof content !== "string") throw new Error("A IA não retornou uma análise textual utilizável.");
  return parseStructuredAiContent<UrbanAIAnalysis>(content, "a análise da instrução");
}

export async function analyzeUploadedFile(input: FileExtractionInput): Promise<FileExtractionAnalysis> {
  const extension = input.filename.split(".").pop()?.toLowerCase() ?? "";
  const localBytes = await readLocalStorageBytes(input.storageKey, input.storageUrl);
  const localReference = input.storageKey.startsWith("local:") || input.storageKey.startsWith("/local-storage/") || input.storageUrl?.startsWith("/local-storage/");
  if (localReference && !localBytes) throw new Error("O arquivo local não foi encontrado no armazenamento configurado.");
  const signedUrl = localBytes ? undefined : await storageGetSignedUrl(input.storageKey);
  const allowedFields = [
    { key: "protocolo", label: "Número do protocolo", help: "Número do processo ou protocolo administrativo" },
    { key: "inscricao_imobiliaria", label: "Inscrição imobiliária", help: "Cadastro ou inscrição do imóvel" },
    { key: "interessado", label: "Interessado ou requerente", help: "Pessoa física ou jurídica requerente" },
    { key: "objeto", label: "Objeto da solicitação", help: "Empreendimento, objeto ou escopo indicado no documento" },
    ...documentSchemas[input.documentType].fields.map((field) => ({ key: field.key, label: field.label, help: field.help ?? field.placeholder })),
  ];
  const instruction = `Extraia somente informações explicitamente presentes no arquivo para a tipologia ${documentTypeLabels[input.documentType]}. Campos permitidos: ${JSON.stringify(allowedFields)}. Não invente valores, legislação, zoneamento, pareceres ou conclusões. Registre a evidência textual ou visual de cada sugestão e sinalize qualquer ambiguidade. A saída será revisada por uma pessoa antes de preencher o processo.`;
  let content: unknown;
  if (["jpg", "jpeg", "png"].includes(extension)) {
    const imageUrl = signedUrl ?? `data:${input.mimeType};base64,${Buffer.from(localBytes ?? []).toString("base64")}`;
    content = [{ type: "text", text: instruction }, { type: "image_url", image_url: { url: imageUrl, detail: "auto" } }];
  } else if (extension === "pdf") {
    if (!signedUrl) throw new Error("A análise de PDF armazenado localmente requer uma URL pública ou extração local de texto.");
    content = [{ type: "text", text: instruction }, { type: "file_url", file_url: { url: signedUrl, mime_type: "application/pdf" } }];
  } else {
    const bytes = localBytes ?? await (async () => {
      if (!signedUrl) throw new Error("Não foi possível resolver o arquivo enviado para análise.");
      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error("Não foi possível recuperar o arquivo enviado para análise.");
      return new Uint8Array(await response.arrayBuffer());
    })();
    const extractedText = extension === "docx" ? extractDocxText(bytes) : extension === "doc" ? await extractLegacyDocText(bytes, input.filename) : extension === "dwg" ? extractDwgText(bytes) : "";
    const dwgNotice = extension === "dwg" ? "O DWG foi lido por metadados textuais disponíveis; geometria, escala e medidas requerem conferência no projeto técnico." : "";
    content = `${instruction}\n${dwgNotice}\nConteúdo extraído do arquivo:\n${extractedText || "Não foi possível extrair texto confiável."}`;
  }
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "Você é um extrator documental municipal. Nunca faça inferências além da evidência apresentada e sempre exija revisão humana." },
      { role: "user", content: content as never },
    ],
    response_format: fileExtractionSchema(input.documentType),
  });
  const choice = response.choices?.[0];
  if (!choice) throw new Error("A IA não retornou uma extração utilizável.");
  const result = choice.message?.content;
  if (typeof result !== "string") throw new Error("A IA não retornou uma extração textual utilizável.");
  return parseStructuredAiContent<FileExtractionAnalysis>(result, "a extração do arquivo");
}
