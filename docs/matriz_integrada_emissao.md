# Matriz Integrada de Emissão UrbanDocs

Esta matriz consolida a análise dos modelos fornecidos. Ela define quais informações podem ser capturadas automaticamente e quais exigem documento comprobatório ou validação técnica antes da emissão.

| Tipologia | Identificação e cadastro | Dados territoriais e imagens | Evidências e condicionantes | Saída técnica dependente de revisão |
|---|---|---|---|---|
| **Parecer EIV** | Processo, versão, empreendimento, requerente, proprietário, responsável técnico, CAU/CREA, ART/RRT | Endereço, lote, quadra, bairro, CEP, matrícula, zoneamento, AID/AII, mapas temáticos | Checklist, estudos, levantamento fotográfico, cartas de viabilidade, dados de tráfego, equipamentos públicos | Situação de cada item, medidas mitigadoras, conclusão e pedido de correção ou parecer conclusivo |
| **Diretriz de loteamento** | Processo, proprietário, responsável técnico, modalidade de parcelamento | Coordenadas, área, matrícula, zoneamento, sistema viário, lotes, APP, curso d'água e nascente | Cartas de água/esgoto/energia, matrícula atualizada, parecer ambiental, laudo geológico, partido urbanístico e EIV | Diretrizes viárias, restrições urbanísticas, áreas de doação, exigências ambientais e deliberação final |
| **Laudo de viabilidade** | Processo, empreendimento, programa/objeto, aprovações e licenças anteriores | Endereço, quadra, lote, CAR, bairro, perímetro, zoneamento, figura de localização | Licenças, cartas de concessionárias, análises ambientais, normas e manifestações setoriais | Viabilidade condicionada, condicionantes, ressalvas legais e encaminhamentos necessários |
| **Uso e ocupação do solo** | Número da certidão, protocolo, empresa/empreendedor, CNPJ/CPF, empreendimento, CNAE | Endereço, coordenadas, lote, perímetro urbano/rural e zoneamento | Legislação de uso do solo, atividade declarada e eventuais condicionantes ambientais | Enquadramento permitido, permissões condicionadas e texto declaratório final |
| **Tombamento** | Requerente, processo, assunto e prazo de validade | Endereço, quadra, lote, inscrição, bairro, matrícula, zoneamento, área e imagem de localização | Base de bens tombados, áreas de entorno e registros patrimoniais | Existência/inexistência de incidência patrimonial, restrições e ressalvas administrativas |
| **Desapropriação** | Requerente, processo, assunto e prazo de validade | Endereço, quadra, lote, inscrição, bairro, matrícula, zoneamento, área e imagem de localização | Registros de decretos, declarações de utilidade pública e interesse social | Existência/inexistência de desapropriação, interesse público/social e ressalvas administrativas |

## Regras de automação

Os dados de **inscrição imobiliária, endereço, lote, quadra, bairro, área, coordenadas, geometria e zoneamento** podem ser propostos pelo cruzamento de planilhas e GeoPackage. A proposta deve ser exibida para conferência antes da emissão, com mapa da geometria destacada e indicação da fonte territorial.

Os dados de **processo, interessado, empreendimento, responsável técnico, atividade/CNAE, matrícula, número de certidão e versão** devem ser recebidos pelo formulário, por metadados de documentos ou por integração administrativa previamente validada.

As afirmações relativas a **viabilidade, licenciamento, tombamento, desapropriação, conformidade de projeto, impactos, exigências ou inexistência de restrições** exigem consulta à fonte administrativa e aprovação de técnico autorizado. O sistema deve registrar a fonte, a data da consulta e a versão do documento gerado.

## Imagens e anexos

Cada emissão pode anexar imagem de localização, ortofoto do lote, croqui/plantas e demais imagens fornecidas. O conjunto final deve identificar a fonte, a data e o contexto territorial da imagem, sem substituir a verificação humana da delimitação do imóvel.
