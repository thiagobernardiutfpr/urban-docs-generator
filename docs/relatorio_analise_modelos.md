# Relatório de Análise dos Modelos UrbanDocs

## Escopo analisado

Foram analisados os modelos de **parecer EIV**, **diretriz de loteamento** e **laudo de viabilidade**, bem como as referências de **certidão de uso e ocupação do solo**, **certidão de tombamento** e **certidão de desapropriação**. A análise foi consolidada na matriz técnica do projeto e está orientada à captura de dados, ao cruzamento territorial, à anexação cartográfica e à emissão controlada de documentos.

| Documento | Estrutura identificada | Dados que o sistema pode propor | Conteúdo que requer consulta e revisão técnica |
|---|---|---|---|
| Parecer EIV | Capa, identificação, parecer técnico, checklist de caracterização, impactos, mobilidade, ambiente e conclusão | Processo, empreendimento, requerente, endereço, lote, quadra, matrícula, zoneamento, responsável técnico e anexos | Pendências, impactos, medidas mitigadoras, parecer conclusivo e validação do checklist |
| Diretriz de loteamento | Identificação da área, sistema viário, infraestrutura, restrições, parcelamento, doações, APP, documentos e observações | Coordenadas, área, lote, matrícula, zoneamento, geometria, sistema viário e anexos cartográficos | Diretrizes, cartas de viabilidade, pareceres setoriais, APP, doações e decisão técnica |
| Laudo de viabilidade | Localização, relatório, legislação, projeto, licenças, aprovações, cartas de concessionárias e encerramento | Endereço, lote, CAR, bairro, perímetro, zoneamento, figuras e protocolos | Viabilidade, condicionantes, licenças, análises ambientais e manifestações de concessionárias |
| Uso e ocupação do solo | Identificação, tabela cadastral/CNAE, localização, enquadramento, declarações e assinatura | Protocolo, interessado, CNAE, endereço, coordenadas, lote, perímetro e zoneamento | Enquadramento permitido, condicionantes e declaração final de conformidade |
| Tombamento | Identificação, localização, imagem, relatório, caracterização e observações | Cadastro imobiliário, matrícula, área, zoneamento e imagem do lote | Resultado de consulta patrimonial, entorno protegido, restrições e validade |
| Desapropriação | Identificação, localização, imagem, relatório, caracterização e observações | Cadastro imobiliário, matrícula, área, zoneamento e imagem do lote | Resultado de consulta a decretos, DUP/interesse social, restrições e validade |

## Regras consolidadas de preenchimento

O cruzamento de **inscrição imobiliária** com planilhas e GeoPackage pode propor endereço, lote, quadra, bairro, área, coordenadas, geometria e zoneamento. Esses dados devem permanecer visíveis na etapa de conferência, com a fonte territorial identificada e o lote destacado no mapa antes da emissão.

Os dados de processo, interessado, atividade, empreendimento, responsável técnico e matrícula devem ser obtidos do formulário, da instrução do processo ou de fontes administrativas validadas. A plataforma deve registrar a origem do dado, a data de consulta e a versão gerada.

> Conclusões sobre viabilidade, tombamento, desapropriação, licenciamento, conformidade urbanística e impactos não devem ser inferidas apenas pela automação. Elas dependem de bases oficiais atualizadas e de revisão por técnico responsável.

## Observação sobre os arquivos enviados

Os três documentos técnicos originais foram recebidos em **DOCX**, o que permite manter a estrutura do modelo e aplicar marcadores ou compatibilização de campos legados. As três novas certidões foram fornecidas em **PDF** e foram tratadas como documentos de referência de estrutura e conteúdo. Para replicação integral do layout das certidões, recomenda-se encaminhar também suas versões oficiais em **DOCX**; enquanto isso, os campos, seções, imagens e textos declaratórios já foram mapeados para a geração estruturada do UrbanDocs.

## Próximos insumos recomendados

1. Planilhas cadastrais com a chave de inscrição imobiliária e atributos de lote, zoneamento e área.
2. GeoPackage contendo a camada de lotes, o respectivo SRID e, quando disponíveis, camadas de perímetro urbano, zoneamento, APP, patrimônios e decretos.
3. Modelos DOCX oficiais das certidões de uso e ocupação, tombamento e desapropriação, caso seja necessário preservar seu layout exatamente como o padrão administrativo atual.
