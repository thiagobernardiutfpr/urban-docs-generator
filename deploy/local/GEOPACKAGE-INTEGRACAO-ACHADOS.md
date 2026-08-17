# Integração do GeoPackage ao Urban Docs

## Arquivo analisado

- Arquivo: `GEOPACKAGE_22-10-25.gpkg`
- Formato: OGC GeoPackage sobre SQLite
- Tamanho: aproximadamente 1,4 GB (relatório completo em `/home/ubuntu/tmp/gpkg_report.json` no ambiente de trabalho)
- O arquivo foi analisado somente em modo leitura.

## Camadas relevantes identificadas

| Camada | Feições | Geometria | SRS | Campos relevantes |
|---|---:|---|---:|---|
| `QUADRAS` | 2.987 | MULTIPOLYGON | EPSG:32722 | `ID`, `geoqua`, `inscricao`, `quadra_ci`, `quadra_eng` |
| `RELATÓRIO NUMERAÇÃO` | 53.494 | POLYGON | EPSG:31982 | `numeracaocorreta`, `numeracaoinloco`, `numerocadastroimobiliario`, `insc_lote`, `lote`, `quadra`, `bairro`, `logradouro`, `cep` |
| `numeração in loco` | 69.842 | POLYGON | EPSG:31982 | `idkey_lote`, `situacao`, `num_pred`, `zoneamento`, `inscricao`, `geo_cadastro` |
| `view_numeracaopredialrelatorio` | 53.427 | POLYGON | EPSG:31982 | `numeracaocorreta`, `numeracaoinloco`, `cadastro`, `insc_lote`, `lote`, `quadra`, `bairro`, `logradouro`, `cep` |
| `Zoneamentos` | 1.861 | MULTIPOLYGON | EPSG:31982 | `zoneamento`, `sigla_zone` |
| `ZONAS ATUAIS` | 6 | MULTIPOLYGON | EPSG:4674 | `id`, `ZONA` |
| `SistemaViario` | 6.195 | MULTILINESTRING | EPSG:31982 | `nome`, `inicio`, `fim`, `bairro`, `tipo`, `larg_via`, `tp_pav`, `Hierarquia` |
| `BAIRROS` | 529 | MULTIPOLYGON | EPSG:31982 | campos de identificação territorial; consultar relatório completo |
| `Parana GEO Perimetro Urbano` | 7 | MULTIPOLYGON | EPSG:31982 | `NmPerimetroUrbano`, `Lei`, `NmMunicipio`, `CdMunicipioIBGE` |
| `NASCENTE_OLHO_DAGUA` | 606 | POINT | EPSG:4674 | `IDF`, `TEMA` |
| `Rios` | 1.966 | MULTILINESTRING | EPSG:32722 | `nome`, `observacao`, `nascente`, `largura` |
| `APP`/camadas ambientais | consultar relatório | polígonos/pontos | variado | dados de restrição ambiental |

## Modelo atual do aplicativo

O esquema Drizzle já possui `spatialSources`, com `kind` `spreadsheet` ou `geopackage`, `fileId` e `metadata` JSON. O router já aceita upload de `.gpkg`, grava o arquivo como categoria `spatial` e possui `spatial.crossReference({ requestId })`.

O cruzamento atual chama `extractGeoPackageLot(storageKey, request.enrollment)`, portanto depende de matrícula/inscrição imobiliária. O resultado é gravado em `documentRequests.extractedData` e segue para a geração dos documentos.

Os formulários já têm campos diretamente compatíveis: `endereco`, `quadra`, `lote`, `bairro`, `matricula`, `zoneamento`, `area_imovel`, `area_total_terreno`, `coordenadas`, `perimetro` e `restricoes_ambientais`.

## Decisões de integração

1. Não importar 1,4 GB de geometrias brutas diretamente em tabelas MySQL genéricas. O GeoPackage deve permanecer como fonte espacial versionada e o banco local deve guardar metadados e resultados normalizados de consultas.
2. O primeiro fluxo será por inscrição/matrícula, aproveitando a função existente, com prioridade para `RELATÓRIO NUMERAÇÃO`, `numeração in loco`, `QUADRAS` e `Zoneamentos`.
3. A integração deve retornar fonte, camada, identificador do registro, campos usados e indicação de revisão humana; não deve afirmar conclusões legais ou urbanísticas automaticamente.
4. Para a base local, o arquivo deve ser montado em uma pasta persistente do projeto ou armazenado via mecanismo de arquivos; não deve ser embutido no Git por causa do tamanho.
5. O upload do GeoPackage completo via navegador pode ser pesado. Deve haver uma opção de configuração local que registre o arquivo no banco e uma consulta espacial em processo controlado.
