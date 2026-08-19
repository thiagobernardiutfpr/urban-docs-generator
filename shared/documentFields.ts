import type { DocumentType } from "./urbanDocs";

export type DocumentField = {
  key: string;
  label: string;
  placeholder: string;
  section: string;
  required?: boolean;
  multiline?: boolean;
  help?: string;
};

type DocumentSchema = {
  title: string;
  summary: string;
  fields: DocumentField[];
  reviewItems: string[];
};

const territorialFields: DocumentField[] = [
  { key: "endereco", label: "Endereço", placeholder: "Rua, número e complemento", section: "Localização" },
  { key: "quadra", label: "Quadra", placeholder: "Ex.: 17", section: "Localização" },
  { key: "lote", label: "Lote", placeholder: "Ex.: 01 e 02", section: "Localização" },
  { key: "bairro", label: "Bairro ou gleba", placeholder: "Ex.: Sede Centro", section: "Localização" },
  { key: "matricula", label: "Matrícula", placeholder: "Ex.: 2.729 — 1º Ofício", section: "Caracterização" },
  { key: "zoneamento", label: "Zoneamento", placeholder: "Ex.: ZC1 — Zona Comercial Um", section: "Caracterização" },
  { key: "area_total_terreno", label: "Área total do terreno", placeholder: "Ex.: 1.200,00 m²", section: "Caracterização" },
];

export const documentSchemas: Record<DocumentType, DocumentSchema> = {
  certidao_uso_ocupacao_solo: {
    title: "Certidão de uso e ocupação do solo",
    summary: "Identifica a atividade, a localização e o enquadramento urbanístico aplicável.",
    fields: [
      { key: "empresa_empreendedora", label: "Empresa ou empreendedor", placeholder: "Razão social ou nome", section: "Identificação", required: true },
      { key: "cnpj_cpf", label: "CNPJ ou CPF", placeholder: "00.000.000/0000-00", section: "Identificação" },
      { key: "cnae_atividades", label: "CNAE e atividades", placeholder: "Código e descrição das atividades", section: "Atividade", required: true, multiline: true },
      { key: "endereco", label: "Localização do empreendimento", placeholder: "Rua, número, CEP e referência", section: "Localização", required: true },
      { key: "coordenadas", label: "Coordenadas", placeholder: "Latitude, longitude ou UTM", section: "Localização" },
      { key: "perimetro", label: "Perímetro urbano ou zona rural", placeholder: "Ex.: Perímetro urbano", section: "Enquadramento" },
      { key: "zoneamento", label: "Zoneamento", placeholder: "Ex.: ZC4 — Zona Comercial Quatro", section: "Enquadramento", required: true },
      { key: "enquadramento", label: "Enquadramento", placeholder: "Ex.: Permitido, permissível ou proibido", section: "Enquadramento", required: true },
    ],
    reviewItems: ["Conferir atividade declarada e CNAEs.", "Confirmar zoneamento e perímetro na base territorial.", "Validar enquadramento conforme legislação municipal vigente."],
  },
  laudo_viabilidade: {
    title: "Laudo de viabilidade",
    summary: "Consolida viabilidade urbanística e condicionantes de licenciamento e infraestrutura.",
    fields: [
      { key: "endereco", label: "Endereço", placeholder: "Rua, número e complemento", section: "Localização", required: true },
      { key: "quadra", label: "Quadra", placeholder: "Ex.: 01", section: "Localização" },
      { key: "lote", label: "Lote", placeholder: "Ex.: 268", section: "Localização" },
      { key: "car", label: "CAR", placeholder: "Código do Cadastro Ambiental Rural", section: "Localização" },
      { key: "bairro", label: "Bairro ou gleba", placeholder: "Ex.: Gleba Pirapó", section: "Localização" },
      { key: "perimetro", label: "Perímetro", placeholder: "Ex.: Urbano", section: "Localização" },
      { key: "zoneamento", label: "Zoneamento", placeholder: "Ex.: ZRCH", section: "Parâmetros", required: true },
      { key: "licenca_ambiental", label: "Licença ou protocolo ambiental", placeholder: "Número, órgão e vigência", section: "Evidências", multiline: true },
      { key: "cartas_viabilidade", label: "Cartas de viabilidade", placeholder: "Água, esgoto, energia e respectivas referências", section: "Evidências", multiline: true },
      { key: "condicionantes", label: "Condicionantes", placeholder: "Manifestações e condições para continuidade", section: "Conclusão", multiline: true },
    ],
    reviewItems: ["Verificar licenças e aprovações anteriores.", "Anexar manifestações das concessionárias.", "Validar condicionantes com os órgãos competentes."],
  },
  diretriz_loteamento: {
    title: "Diretriz de loteamento",
    summary: "Organiza os dados territoriais, viários, ambientais e documentais da proposta de parcelamento.",
    fields: [
      { key: "endereco", label: "Localização", placeholder: "Endereço ou referência da gleba", section: "Identificação", required: true },
      { key: "lote", label: "Lote de terras", placeholder: "Ex.: 108-Remanescente", section: "Identificação" },
      { key: "coordenadas", label: "Coordenadas", placeholder: "Ex.: 449321.55 E, 7393491.80 N", section: "Identificação", required: true },
      { key: "area_imovel", label: "Área do imóvel", placeholder: "Ex.: 161.446,58 m²", section: "Identificação", required: true },
      { key: "matricula", label: "Matrícula", placeholder: "Número e cartório", section: "Identificação" },
      { key: "zoneamento", label: "Zoneamento", placeholder: "Ex.: ZR2", section: "Parâmetros", required: true },
      { key: "modalidade_parcelamento", label: "Modalidade de parcelamento", placeholder: "Loteamento, condomínio ou desmembramento", section: "Parâmetros" },
      { key: "unidades_previstas", label: "Unidades previstas", placeholder: "Quantidade de lotes ou unidades", section: "Infraestrutura" },
      { key: "cartas_viabilidade", label: "Viabilidade de infraestrutura", placeholder: "Água, esgoto e energia; protocolo, data e situação", section: "Infraestrutura", multiline: true },
      { key: "restricoes_ambientais", label: "Restrições ambientais", placeholder: "APP, nascente, curso d’água, parecer ambiental", section: "Ambiente", multiline: true },
      { key: "areas_doacao", label: "Áreas de doação", placeholder: "Percentuais, áreas e observações", section: "Ambiente", multiline: true },
    ],
    reviewItems: ["Conferir geometria, área e coordenadas no mapa.", "Validar sistema viário e áreas de doação.", "Anexar parecer ambiental e cartas de viabilidade vigentes."],
  },
  parecer_eiv: {
    title: "Parecer de EIV",
    summary: "Registra a análise do estudo, o checklist de impactos e as exigências de readequação ou aprovação.",
    fields: [
      { key: "versao_estudo", label: "Versão do estudo", placeholder: "Ex.: Versão 01", section: "Identificação" },
      { key: "endereco", label: "Endereço do empreendimento", placeholder: "Rua, número e complemento", section: "Identificação", required: true },
      { key: "lote", label: "Lote", placeholder: "Ex.: 07-D/06/REM", section: "Identificação" },
      { key: "quadra", label: "Quadra", placeholder: "Ex.: Quadra 14", section: "Identificação" },
      { key: "bairro", label: "Bairro ou gleba", placeholder: "Bairro, loteamento ou gleba", section: "Identificação" },
      { key: "matricula", label: "Matrícula", placeholder: "Números das matrículas", section: "Identificação" },
      { key: "zoneamento", label: "Zoneamento", placeholder: "Ex.: ZR3", section: "Parâmetros", required: true },
      { key: "cau_crea", label: "CAU ou CREA", placeholder: "Registro do responsável técnico", section: "Responsabilidade" },
      { key: "art_rrt", label: "ART ou RRT", placeholder: "Número da ART/RRT", section: "Responsabilidade" },
      { key: "resultado_checklist", label: "Resultado do checklist", placeholder: "Pendências, itens apresentados e itens a corrigir", section: "Análise", required: true, multiline: true },
      { key: "medidas_mitigadoras", label: "Medidas mitigadoras ou exigências", placeholder: "Medidas, condicionantes e prazo de atendimento", section: "Análise", multiline: true },
    ],
    reviewItems: ["Confirmar informações quantitativas e fontes do EIV.", "Conferir ART/RRT e documentos comprobatórios.", "Revisar conclusão e exigências antes da assinatura."],
  },
  avaliacao_previa_impacto_vizinhanca: { title: "Avaliação prévia de impacto de vizinhança", summary: "Registra a triagem preliminar dos impactos e da necessidade de estudo aprofundado.", fields: [{ key: "endereco", label: "Localização", placeholder: "Endereço do imóvel", section: "Identificação", required: true }, { key: "zoneamento", label: "Zoneamento", placeholder: "Zona aplicável", section: "Parâmetros" }, { key: "impactos_preliminares", label: "Impactos preliminares", placeholder: "Resumo dos impactos identificados", section: "Análise", multiline: true }, { key: "encaminhamentos", label: "Encaminhamentos", placeholder: "Estudos ou manifestações necessários", section: "Análise", multiline: true }], reviewItems: ["Conferir dados do empreendimento.", "Validar necessidade de EIV completo."] },
  informacao: { title: "Informação", summary: "Produz manifestação técnica informativa com dados oficiais disponíveis.", fields: [{ key: "assunto", label: "Assunto", placeholder: "Tema da informação", section: "Identificação", required: true }, { key: "informacao_tecnica", label: "Informação técnica", placeholder: "Texto técnico a ser consolidado", section: "Conteúdo", required: true, multiline: true }], reviewItems: ["Conferir fonte dos dados antes da emissão."] },
  oficio: { title: "Ofício", summary: "Organiza comunicação oficial com destinatário, assunto e encaminhamento.", fields: [{ key: "destinatario", label: "Destinatário", placeholder: "Órgão, setor ou pessoa", section: "Identificação", required: true }, { key: "assunto", label: "Assunto", placeholder: "Assunto do ofício", section: "Identificação", required: true }, { key: "corpo_oficio", label: "Corpo do ofício", placeholder: "Mensagem e encaminhamento", section: "Conteúdo", required: true, multiline: true }], reviewItems: ["Revisar destinatário, referência e encaminhamento."] },
  parecer_tecnico: { title: "Parecer técnico", summary: "Estrutura a manifestação técnica, a localização, a fundamentação e a conclusão do processo.", fields: [{ key: "assunto", label: "Assunto", placeholder: "Objeto do parecer", section: "Identificação", required: true }, { key: "endereco", label: "Localização", placeholder: "Endereço, lote ou imóvel analisado", section: "Localização" }, { key: "zoneamento", label: "Zoneamento", placeholder: "Zona e parâmetros aplicáveis", section: "Parâmetros" }, { key: "analise_tecnica", label: "Análise técnica", placeholder: "Fundamentação técnica do parecer", section: "Análise", required: true, multiline: true }, { key: "conclusao", label: "Conclusão", placeholder: "Conclusão e encaminhamentos", section: "Conclusão", required: true, multiline: true }], reviewItems: ["Conferir processo, localização e documentos de suporte.", "Revisar fundamentação e conclusão antes da emissão."] },
  autorizacao_uso_espaco_publico: { title: "Autorização de uso do espaço público", summary: "Registra a autorização precária, o local, a finalidade, o período e as condições de uso do espaço público.", fields: [{ key: "finalidade_uso", label: "Finalidade do uso", placeholder: "Atividade ou finalidade solicitada", section: "Identificação", required: true, multiline: true }, { key: "endereco", label: "Local do espaço público", placeholder: "Praça, via, número e referência", section: "Localização", required: true }, { key: "data_inicio", label: "Data de início", placeholder: "DD/MM/AAAA", section: "Período", required: true }, { key: "data_fim", label: "Data de término", placeholder: "DD/MM/AAAA", section: "Período", required: true }, { key: "horario_uso", label: "Horário de uso", placeholder: "Ex.: das 7h às 18h", section: "Período" }, { key: "condicoes_uso", label: "Condições de uso", placeholder: "Condições, restrições e obrigações", section: "Condições", multiline: true }], reviewItems: ["Conferir período, local e finalidade autorizada.", "Validar condições de conservação, desocupação e segurança."] },
  autorizacao_engenho_publicitario: { title: "Autorização de engenho publicitário", summary: "Consolida dados do engenho, do imóvel e das condições de autorização.", fields: [{ key: "endereco", label: "Endereço", placeholder: "Local de instalação", section: "Localização", required: true }, { key: "descricao_engenho", label: "Descrição do engenho", placeholder: "Tipo, dimensões e características", section: "Engenho", required: true, multiline: true }, { key: "zoneamento", label: "Zoneamento", placeholder: "Zona aplicável", section: "Parâmetros" }, { key: "condicionantes", label: "Condições da autorização", placeholder: "Prazo, restrições e condicionantes", section: "Conclusão", multiline: true }], reviewItems: ["Conferir localização, dimensões e legislação aplicável."] },
  certidao_tombamento: { title: "Certidão de tombamento", summary: "Registra a consulta patrimonial do imóvel e sua área de entorno.", fields: [...territorialFields, { key: "resultado_tombamento", label: "Resultado da consulta patrimonial", placeholder: "Indique incidência, inexistência ou restrição encontrada", section: "Consulta oficial", required: true, multiline: true }, { key: "validade", label: "Validade", placeholder: "Ex.: 5 anos a contar da emissão", section: "Consulta oficial" }], reviewItems: ["Consultar base de bens tombados e áreas de entorno.", "Conferir matrícula e imagem de localização.", "Validar texto conclusivo e prazo de validade."] },
  certidao_desapropriacao: { title: "Certidão de desapropriação", summary: "Registra a consulta a atos de desapropriação, utilidade pública e interesse social.", fields: [...territorialFields, { key: "resultado_desapropriacao", label: "Resultado da consulta de desapropriação", placeholder: "Informe decretos, DUP, interesse social ou inexistência", section: "Consulta oficial", required: true, multiline: true }, { key: "validade", label: "Validade", placeholder: "Ex.: 5 anos a contar da emissão", section: "Consulta oficial" }], reviewItems: ["Consultar decretos, DUP e interesse social vigentes.", "Conferir matrícula e imagem de localização.", "Validar texto conclusivo e prazo de validade."] },
  certidao_perimetro_urbano: { title: "Certidão de perímetro urbano", summary: "Certifica a relação territorial do imóvel com o perímetro urbano vigente.", fields: [{ key: "endereco", label: "Endereço", placeholder: "Endereço do imóvel", section: "Localização" }, { key: "perimetro", label: "Situação no perímetro", placeholder: "Dentro, fora ou confrontante", section: "Consulta oficial", required: true }, { key: "coordenadas", label: "Coordenadas", placeholder: "Latitude/longitude ou UTM", section: "Localização" }], reviewItems: ["Conferir geometria do lote e camada do perímetro urbano."] },
  parecer_urbanistico: { title: "Parecer urbanístico", summary: "Estrutura a análise técnica urbanística e seus encaminhamentos.", fields: [{ key: "endereco", label: "Endereço", placeholder: "Local analisado", section: "Identificação" }, { key: "zoneamento", label: "Zoneamento", placeholder: "Zona e parâmetros aplicáveis", section: "Parâmetros" }, { key: "analise_urbanistica", label: "Análise urbanística", placeholder: "Fundamentação técnica", section: "Análise", required: true, multiline: true }, { key: "conclusao", label: "Conclusão", placeholder: "Conclusão e encaminhamentos", section: "Conclusão", required: true, multiline: true }], reviewItems: ["Revisar a fundamentação e os parâmetros antes da emissão."] },
};

export function getSchemaSections(type: DocumentType) {
  const fields = documentSchemas[type].fields;
  return Object.entries(fields.reduce<Record<string, DocumentField[]>>((accumulator, field) => {
    (accumulator[field.section] ??= []).push(field);
    return accumulator;
  }, {}));
}
