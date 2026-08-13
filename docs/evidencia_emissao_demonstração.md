# Evidência de Emissão de Demonstração e Pré-visualização

## Execução validada

A rota **`/pre-visualizacao`** executou a mutação protegida **`generated.previewDemo`**, que utiliza a mesma função `renderDocument` da emissão estruturada. A operação gerou uma certidão de tombamento de demonstração sem criar solicitação ou dado de teste no banco de dados; os artefatos DOCX e PDF foram enviados ao armazenamento do usuário e retornados ao componente final no contrato:

```ts
{
  docx: { storageUrl: string },
  pdf: { storageUrl: string }
}
```

## Conferência visual

A tela final foi inspecionada após a conclusão da emissão. Ela exibiu o título **“Documentos gerados para revisão”**, a seção **“Pré-visualização do documento final”**, o visualizador incorporado e as ações **“Baixar DOCX”** e **“Abrir ou baixar PDF”**. O visualizador mostrou o PDF produzido pela emissão de demonstração, identificado como **Certidão de tombamento**, com dados marcados como teste e com o controle **“Ocultar prévia”** disponível.

Assim, foi confirmado o fluxo completo: **mutação de emissão → retorno de `output.pdf.storageUrl` → componente `DocumentFinalPreview` → `iframe` incorporado com o PDF resultante**.
