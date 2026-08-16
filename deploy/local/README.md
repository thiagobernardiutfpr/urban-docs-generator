# Ambiente local do Urban Docs no Windows

O script `setup-local-windows.ps1` prepara um ambiente de desenvolvimento local com MySQL 8.4, cria o banco `urban_docs`, cria o usuário `urban_docs_app`, grava um `.env` ignorado pelo Git, aplica o esquema Drizzle e deixa o projeto pronto para execução.

## Recomendado: Docker Desktop

Instale e inicie o [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/). Depois abra o PowerShell na pasta do projeto:

```powershell
cd D:\Gerador_de_Documentos
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\deploy\local\setup-local-windows.ps1
```

O script solicitará duas senhas sem exibi-las. A primeira é a senha do usuário `root` do MySQL local; a segunda é uma nova senha para `urban_docs_app`. Elas são locais e não têm relação com a senha do Oracle Cloud ou do MySQL HeatWave.

O banco será disponibilizado em `127.0.0.1:3306`, com a conexão:

```text
mysql://urban_docs_app:SENHA@127.0.0.1:3306/urban_docs
```

Depois da conclusão:

```powershell
pnpm dev
```

Abra `http://localhost:3000/`.

Para iniciar o script e a aplicação em sequência, use:

```powershell
.\deploy\local\setup-local-windows.ps1 -StartApp
```

## MySQL já instalado no Windows

Se o MySQL Server já estiver instalado e o comando `mysql` estiver no `PATH`, execute:

```powershell
.\deploy\local\setup-local-windows.ps1 -UseExistingMySql
```

Nesse modo, o script usa o MySQL em `127.0.0.1:3306` e não cria container.

## Persistência e atualização

O banco em Docker fica no volume `urban_docs_mysql_data` e continua disponível após reiniciar o computador ou o Docker Desktop. Para parar o container sem apagar os dados:

```powershell
docker compose -f .\docker-compose.local.yml stop
```

Para iniciar novamente:

```powershell
docker compose -f .\docker-compose.local.yml start
```

Não execute `docker compose down -v` se quiser preservar o banco, pois o parâmetro `-v` remove o volume de dados.

O arquivo `.env` e os backups temporários `.env.backup-*` não devem ser commitados. O `.gitignore` do projeto já protege esses arquivos.

## Diagnóstico

Verifique o container e os logs com:

```powershell
docker ps
 docker logs urban-docs-mysql
```

Se a porta `3306` já estiver ocupada, pare o serviço que a utiliza ou altere o mapeamento no arquivo `docker-compose.local.yml` e a porta correspondente na `DATABASE_URL`.
