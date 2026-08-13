# Validação da Pré-visualização Final

A etapa final de emissão utiliza o componente `DocumentFinalPreview` imediatamente após a geração de DOCX e PDF. A pré-visualização é incorporada por `iframe`, com URL normalizada para `#view=FitH`, e permanece acompanhada das ações de download DOCX e abertura/download PDF.

A verificação integrada gera efetivamente uma **certidão de tombamento** com `renderDocument`, confirma as assinaturas binárias DOCX (`PK`) e PDF (`%PDF`) e valida que a URL do PDF resultante alimenta a pré-visualização incorporada. A interface do mesmo componente também foi conferida visualmente na rota `/pre-visualizacao`, utilizando um PDF de referência do acervo administrativo para confirmar a abertura, controles do visualizador e ações finais.

Essa validação confirma o encadeamento: **emissão estruturada → PDF resultante → pré-visualização na etapa final → download**.
