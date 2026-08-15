# Validação de Modelos e Fluxo Contínuo

## Modelos ativos

Os quatro modelos ativos — certidão de uso e ocupação do solo, laudo de viabilidade, diretriz de loteamento e parecer de EIV — foram renderizados em validação isolada. Em todos, o pacote DOCX resultante preservou os mesmos arquivos `word/document.xml`, `word/header*.xml` e `word/footer*.xml` do respectivo modelo de origem. A conversão produziu PDF válido em todos os casos.

## Modelos futuros

O cadastro de novos modelos DOCX agora exige pelo menos um marcador no formato `{campo}`. Os marcadores podem estar no corpo, cabeçalho ou rodapé. O motor preenche essas três regiões no mesmo DOCX e gera o PDF a partir desse arquivo preenchido, preservando a formatação original.

## Fluxo de solicitação

A tela de nova solicitação foi verificada visualmente na etapa inicial. Ela apresenta cinco etapas explícitas: cadastro, anexos, revisão, mapa e emissão. O fluxo foi coberto por testes de rotas para análise de anexos, aplicação revisada de sugestões e transição para revisão antes da emissão.

A biblioteca administrativa de modelos também foi verificada visualmente. O seletor de arquivo informa que os marcadores `{protocolo}`, `{endereco}` e `{zoneamento}` podem ser inseridos no corpo, cabeçalho ou rodapé do DOCX para preservar o layout na emissão.

## Pendência operacional

O percurso interativo autenticado das etapas 2 a 5 requer uma sessão válida do UrbanDocs no navegador. A validação foi interrompida na tela de login; não foram usados dados de credenciais nem criados registros de demonstração adicionais.
