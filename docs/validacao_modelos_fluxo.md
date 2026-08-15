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

## Pendência operacional

O percurso interativo autenticado das etapas 2 a 5 requer uma sessão válida do UrbanDocs no navegador. A validação foi interrompida na tela de login; não foram usados dados de credenciais nem criados registros de demonstração adicionais.
