import { invokeLLM } from "./_core/llm";
import { documentTypeLabels, type DocumentType } from "../shared/urbanDocs";
import { documentSchemas } from "../shared/documentFields";

export type UrbanAIAnalysis = {
  summary: string;
  missingFields: string[];
  riskFlags: string[];
  suggestedDraft: string;
  reviewNotice: string;
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
    model: "gpt-5-mini",
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
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new Error("A IA não retornou uma análise textual utilizável.");
  return JSON.parse(content) as UrbanAIAnalysis;
}
