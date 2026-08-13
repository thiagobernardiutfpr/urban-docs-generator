import { documentSchemas } from "./documentFields";
import type { DocumentType } from "./urbanDocs";

export type DemonstrationRequest = {
  protocol: string;
  enrollment: string;
  applicant: string;
  description: string;
  fields: Record<string, string>;
};

const defaults: Record<string, string> = {
  endereco: "Rua de Demonstração, 100 — Centro",
  quadra: "Quadra 12",
  lote: "Lote 07",
  bairro: "Bairro Central",
  matricula: "12.345 — 1º Ofício",
  zoneamento: "ZR-3 — Zona Residencial Três",
  area_total_terreno: "1.250,00 m²",
  coordenadas: "449321,55 E; 7393491,80 N",
  perimetro: "Perímetro urbano",
  validade: "5 anos a contar da emissão",
  empreendimento: "Empreendimento demonstrativo",
  responsavel_tecnico: "Responsável de teste — CAU/CREA 000000",
  empresa_empreendedora: "Empresa Demonstrativa Ltda.",
  cnpj_cpf: "00.000.000/0001-00",
  cnae_atividades: "DADO DE TESTE — Atividade cadastrada para validação do fluxo.",
  enquadramento: "DADO DE TESTE — Permitido, sujeito à conferência técnica.",
  car: "DADO DE TESTE — CAR 000000000000000",
  licenca_ambiental: "DADO DE TESTE — Protocolo ambiental e vigência a confirmar.",
  cartas_viabilidade: "DADO DE TESTE — Água, esgoto e energia em consulta.",
  condicionantes: "DADO DE TESTE — Condicionantes sujeitas à validação técnica.",
  area_imovel: "161.446,58 m²",
  modalidade_parcelamento: "Loteamento",
  unidades_previstas: "48 lotes",
  restricoes_ambientais: "DADO DE TESTE — Verificar APP, curso d’água e parecer ambiental.",
  areas_doacao: "DADO DE TESTE — Áreas institucionais e verdes a confirmar.",
  versao_estudo: "Versão de teste 01",
  cau_crea: "CAU/CREA 000000",
  art_rrt: "ART/RRT de teste 000000",
  resultado_checklist: "DADO DE TESTE — Checklist preliminar preenchido para validação do fluxo.",
  medidas_mitigadoras: "DADO DE TESTE — Medidas e prazos dependem de análise técnica.",
  impactos_preliminares: "DADO DE TESTE — Impactos preliminares em avaliação.",
  encaminhamentos: "DADO DE TESTE — Encaminhar para análise técnica.",
  assunto: "DADO DE TESTE — Assunto para validação do fluxo",
  informacao_tecnica: "DADO DE TESTE — Informação técnica para conferência interna.",
  destinatario: "Secretaria municipal competente",
  corpo_oficio: "DADO DE TESTE — Corpo do ofício para validação do fluxo documental.",
  descricao_engenho: "DADO DE TESTE — Engenho publicitário com dimensões a confirmar.",
  resultado_tombamento: "DADO DE TESTE — Consulta patrimonial pendente de validação do técnico responsável.",
  resultado_desapropriacao: "DADO DE TESTE — Consulta a decretos e interesse social pendente de validação do técnico responsável.",
  analise_urbanistica: "DADO DE TESTE — Análise urbanística a ser revisada antes da emissão.",
  conclusao: "DADO DE TESTE — Conclusão provisória para validação do fluxo.",
};

export function getDemonstrationRequest(type: DocumentType): DemonstrationRequest {
  const schema = documentSchemas[type];
  const fields = Object.fromEntries(schema.fields.map((field) => [field.key, defaults[field.key] ?? `DADO DE TESTE — ${field.label}.`]));
  return {
    protocol: "TESTE-2026/000001",
    enrollment: "01.02.175.0140.001",
    applicant: "Interessado de demonstração",
    description: `DADOS DE TESTE — Solicitação de ${schema.title.toLocaleLowerCase("pt-BR")} para validação interna. Não emitir sem conferência técnica.`,
    fields,
  };
}
