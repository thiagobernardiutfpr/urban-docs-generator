# Validação de Modelos e Fluxo Contínuo

## Modelos ativos

Os quatro modelos ativos — certidão de uso e ocupação do solo, laudo de viabilidade, diretriz de loteamento e parecer de EIV — foram renderizados em validação isolada. Em todos, o pacote DOCX resultante preservou os mesmos arquivos `word/document.xml`, `word/header*.xml` e `word/footer*.xml` do respectivo modelo de origem. A conversão produziu PDF válido em todos os casos.

## Modelos futuros

O cadastro de novos modelos DOCX agora exige pelo menos um marcador no formato `{campo}`. Os marcadores podem estar no corpo, cabeçalho ou rodapé. O motor preenche essas três regiões no mesmo DOCX e gera o PDF a partir desse arquivo preenchido, preservando a formatação original.

## Fluxo de solicitação

A tela de nova solicitação foi verificada visualmente na etapa inicial. Ela apresenta cinco etapas explícitas: cadastro, anexos, revisão, mapa e emissão. O fluxo foi coberto por testes de rotas para análise de anexos, aplicação revisada de sugestões e transição para revisão antes da emissão.

A biblioteca administrativa de modelos também foi verificada visualmente. O seletor de arquivo informa que os marcadores `{protocolo}`, `{endereco}` e `{zoneamento}` podem ser inseridos no corpo, cabeçalho ou rodapé do DOCX para preservar o layout na emissão.

O processo 49316/2026 foi aberto visualmente pelo identificador interno. Ele está concluído e exibe seis versões documentais, cada uma com ações de exportação PDF e DOCX. A última versão confirma a continuidade do histórico de reemissões no modelo ativo.

O componente de finalização mantém uma pré-visualização incorporada do PDF, além dos links para baixar o DOCX e abrir o PDF. Essa estrutura é coberta pelo teste `documentPreview.test.ts`.

O PDF da versão 6 do processo 49316/2026 foi baixado do acervo e inspecionado visualmente. A primeira e a última página preservam a identidade do modelo institucional, incluindo brasão, logotipo, faixa lateral, marca d’água, campo preenchido, rodapé e numeração de página. O arquivo possui sete páginas.

Na sessão autenticada, o detalhe do processo 49316/2026 confirmou o status concluído, a lista de seis versões documentais e os controles PDF/DOCX em cada versão. A evidência textual da interface também confirmou o interessado, o objeto e a ação de reemitir nova versão.

A tela de detalhe foi verificada após a inclusão da prévia. Cada uma das seis versões agora apresenta os controles **Prévia**, **PDF** e **DOCX**, sob a coluna “Visualizar e exportar”.

O assistente de nova solicitação foi conferido após o reposicionamento das ações. O botão “Registrar e continuar” permanece exposto na faixa inferior, separado da área reservada ao assistente flutuante.

## Validação autenticada do percurso completo

Uma solicitação de validação identificada pelo protocolo `VALIDACAO-FLUXO-20260815` foi criada com autorização expressa, sem gerar documentos. O botão “Registrar e continuar” avançou da etapa de cadastro para anexos sem abrir o assistente flutuante. Sem anexos, a interface seguiu para revisão humana; após o preenchimento dos campos obrigatórios, prosseguiu ao mapa e à preparação para emissão.

O cruzamento GeoPackage foi otimizado para pesquisar somente a inscrição normalizada, sem carregar integralmente as tabelas da base. O processo de validação passou a “Dados cruzados” e pôde ser retomado diretamente na etapa de mapa. O mapa informou corretamente que não havia geometria para a inscrição de teste, preservando a possibilidade de continuar até a preparação de emissão.

A pré-visualização autenticada foi aberta no detalhe de uma emissão existente. O diálogo carregou o PDF no iframe e permaneceu acompanhado dos controles de exportação PDF e DOCX.

A conferência final mostrou a primeira página de um PDF com sete páginas no visualizador incorporado, incluindo a barra do leitor de PDF, a identidade visual institucional, o conteúdo preenchido e a paginação. Essa prévia foi aberta a partir do controle “Prévia” da versão 6, cuja mesma linha preserva os links PDF e DOCX.

No DOM da sessão autenticada, a prévia aberta contém um elemento `iframe` com o título “Pré-visualização do documento emitido em PDF” e URL de armazenamento do PDF com o fragmento `#view=FitH`. A mesma tela expõe seis ações de prévia e doze links de exportação, organizados em pares PDF/DOCX para as seis versões documentais.

Na etapa de anexos, uma solicitação em coleta foi reaberta visualmente e exibiu o cartão “Próxima etapa” com a ação “Continuar sem anexos”. A variação com arquivos é coberta pelo teste de rótulos do fluxo, que apresenta “Analisar anexos e continuar” quando há ao menos um anexo selecionado.

A decisão de continuidade da etapa de anexos também foi centralizada em teste. Sem arquivos, ela retorna a ação “Continuar sem anexos” e a próxima etapa 3; com ao menos um anexo, retorna “Analisar anexos e continuar” e a mesma etapa 3, exigindo análise antes da revisão.

A cobertura de componente também executa os cliques reais no assistente: sem anexo, “Continuar sem anexos” muda a interface para “Conferir dados antes do mapa”; com um PDF, o teste confirma o envio, a análise e a mesma mudança para a revisão humana.

## Comparação da ação da etapa de anexos

A ausência originalmente relatada não voltou a ocorrer na versão anterior quando a solicitação em coleta foi reaberta no ambiente publicado. A análise da composição revelou, porém, que a continuidade dependia de um cartão posicionado abaixo das áreas de anexos e das referências territoriais; em telas menores ou após rolagem, a ação poderia ficar fora da área visível.

A correção adiciona a mesma ação à barra de navegação persistente no rodapé do assistente. A tela de desenvolvimento confirmou “Continuar sem anexos” fixado na parte inferior, separado do botão flutuante do assistente. O teste de componente cobre a atualização desse botão persistente para “Analisar anexos e continuar” quando um arquivo é selecionado.

Na publicação, a ação persistente “Continuar sem anexos” foi acionada no processo `TESTE/2026`. A interface exibiu a confirmação “Insumos registrados” e abriu a etapa 3 de 5, “Conferir dados antes do mapa”, sem necessidade de rolagem até o cartão de anexos.

## Indisponibilidade do Assistente IA

O serviço de IA retornou precondição 412 no ambiente publicado. A política de repetição agora considera 412 não recuperável, portanto não repete a chamada ao proxy. Uma chamada técnica autorizada ao mesmo contrato do Assistente IA retornou `SERVICE_UNAVAILABLE` com a mensagem: “Assistente de IA temporariamente indisponível. O preenchimento manual e a emissão do documento continuam disponíveis.” Nenhum processo, anexo ou emissão foi alterado durante essa validação.
