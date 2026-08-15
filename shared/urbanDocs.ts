export const documentTypes = [
  "certidao_uso_ocupacao_solo",
  "laudo_viabilidade",
  "diretriz_loteamento",
  "parecer_eiv",
  "avaliacao_previa_impacto_vizinhanca",
  "informacao",
  "oficio",
  "autorizacao_engenho_publicitario",
  "certidao_tombamento",
  "certidao_desapropriacao",
  "certidao_perimetro_urbano",
  "parecer_urbanistico",
] as const;

export type DocumentType = (typeof documentTypes)[number];

export const userRoles = ["author", "reviewer", "approver", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const roleLabels: Record<UserRole, string> = {
  author: "Elaborador",
  reviewer: "Revisor",
  approver: "Aprovador",
  admin: "Administrador",
};

export function canReviewAi(role: UserRole) {
  return role === "reviewer" || role === "approver" || role === "admin";
}

export function canApproveEmission(role: UserRole) {
  return role === "approver" || role === "admin";
}

export const documentTypeLabels: Record<DocumentType, string> = {
  certidao_uso_ocupacao_solo: "Certidão de uso e ocupação do solo",
  laudo_viabilidade: "Laudo de viabilidade",
  diretriz_loteamento: "Diretriz de loteamento",
  parecer_eiv: "Parecer de EIV",
  avaliacao_previa_impacto_vizinhanca: "Avaliação prévia de impacto de vizinhança",
  informacao: "Informação",
  oficio: "Ofício",
  autorizacao_engenho_publicitario: "Autorização de engenho publicitário",
  certidao_tombamento: "Certidão de tombamento",
  certidao_desapropriacao: "Certidão de desapropriação",
  certidao_perimetro_urbano: "Certidão de perímetro urbano",
  parecer_urbanistico: "Parecer urbanístico",
};

export const allowedUploadExtensions = ["pdf", "docx", "doc", "dwg", "jpg", "jpeg", "png", "xlsx", "xls", "csv", "gpkg"] as const;
export const maxUploadBytes = 25 * 1024 * 1024;

export const requestStatuses = ["draft", "collecting", "cross_referenced", "ready_for_review", "processing", "completed", "failed"] as const;
export type RequestStatus = (typeof requestStatuses)[number];

const validStatusTransitions: Record<RequestStatus, RequestStatus[]> = {
  draft: ["collecting"],
  collecting: ["cross_referenced", "processing", "failed"],
  cross_referenced: ["ready_for_review", "processing", "failed"],
  ready_for_review: ["processing", "failed"],
  processing: ["completed", "failed"],
  completed: ["processing"],
  failed: ["processing", "collecting"],
};

export function canTransitionRequestStatus(from: RequestStatus, to: RequestStatus): boolean {
  return validStatusTransitions[from].includes(to);
}

export function requestWorkflowStep(status: RequestStatus): number {
  if (status === "draft") return 1;
  if (status === "collecting" || status === "failed") return 2;
  if (status === "cross_referenced") return 4;
  return 5;
}

export function requestWorkflowActionLabel(step: number, attachmentCount = 0): string {
  if (step === 1) return "Registrar e continuar";
  if (step === 2) return attachmentCount > 0 ? "Analisar anexos e continuar" : "Continuar sem anexos";
  if (step === 3) return "Revisar e cruzar dados";
  if (step === 4) return "Preparar emissão";
  return "Gerar DOCX e PDF";
}

export function attachmentContinuation(attachmentCount: number) {
  return {
    actionLabel: requestWorkflowActionLabel(2, attachmentCount),
    nextStep: 3,
    requiresAnalysis: attachmentCount > 0,
  } as const;
}

export function normalizeEnrollment(value: unknown): string {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function normalizeFieldName(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function getExtension(filename: string): string {
  const extension = filename.split(".").pop()?.toLocaleLowerCase("pt-BR") ?? "";
  return extension;
}

export function isSupportedUpload(filename: string): boolean {
  return (allowedUploadExtensions as readonly string[]).includes(getExtension(filename));
}

export function isImageFile(filename: string): boolean {
  return ["jpg", "jpeg", "png"].includes(getExtension(filename));
}

export function isSpatialFile(filename: string): boolean {
  return ["xlsx", "xls", "csv", "gpkg"].includes(getExtension(filename));
}
