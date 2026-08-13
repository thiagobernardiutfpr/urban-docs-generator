# Correção do Envio de Modelos DOCX

## Causa-raiz

O fluxo anterior iniciava a mutação de upload imediatamente no evento de alteração de um campo de arquivo oculto. Esse desenho não fornecia uma confirmação de que o arquivo havia sido selecionado, não deixava explícito se a mutação estava em andamento e tornava o acionamento dependente do comportamento do `label` que envolvia o campo oculto. Assim, para o usuário, o comando **Enviar modelo DOCX** podia parecer não responder.

## Correção aplicada

O acervo agora separa o procedimento em duas ações claras: **Selecionar DOCX** abre o seletor de arquivos e exibe o nome escolhido; **Enviar modelo** somente é habilitado após uma seleção válida e executa a mutação de cadastro. O fluxo mostra estados de envio, sucesso e falha por mensagens de interface. A regra compartilhada `submitTemplateUpload` valida formato, tamanho, versão, payload e tratamento de erro, com testes automatizados de seleção, sucesso e falha.
