# Deploy no Oracle Cloud

Este diretório contém a automação para publicar o Urban Docs Generator em uma VM Oracle Linux que tenha acesso privado ao MySQL da mesma VCN.

## Pré-requisitos

A VM precisa estar em execução, ter acesso à internet para clonar o repositório e conseguir alcançar o MySQL privado na porta `3306`. A porta `22` deve estar liberada para o seu IP. Para expor a aplicação diretamente durante o primeiro teste, a porta `3000` também precisa estar liberada na Security List ou no Network Security Group da VM.

O banco deve ter um schema `urban_docs` e um usuário da aplicação, por exemplo:

```sql
CREATE DATABASE urban_docs
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'urban_docs_app'@'%' IDENTIFIED BY 'SENHA_FORTE';
GRANT ALL PRIVILEGES ON urban_docs.* TO 'urban_docs_app'@'%';
FLUSH PRIVILEGES;
```

Não use a senha do administrador do MySQL na aplicação.

## Execução inicial

Depois de conectar à VM por SSH como `opc`, execute:

```bash
sudo dnf install -y git
rm -rf /tmp/urban-docs-generator
cd /tmp
git clone --depth=1 --branch main https://github.com/thiagobernardiutfpr/urban-docs-generator.git
cd urban-docs-generator
sudo bash deploy/oracle/provision-and-deploy.sh
```

O script instala dependências, seleciona Podman ou Docker, cria `/opt/urban-docs-generator`, solicita `DATABASE_URL` de forma interativa, cria um `JWT_SECRET`, constrói a imagem, aplica `pnpm db:push`, cria um serviço systemd e inicia a aplicação.

A configuração é salva somente em:

```text
/etc/urban-docs/urban-docs.env
```

Esse arquivo recebe permissão `600` e não é commitado no Git.

## Variáveis opcionais

A aplicação consegue iniciar sem OAuth, mas os uploads e os documentos gerados precisam de armazenamento. Para habilitar o storage existente, exporte as variáveis antes de executar o script ou informe-as quando solicitado:

```bash
export BUILT_IN_FORGE_API_URL="https://SEU_ENDPOINT_DE_STORAGE"
export BUILT_IN_FORGE_API_KEY="SUA_CHAVE_DE_STORAGE"
sudo --preserve-env=BUILT_IN_FORGE_API_URL,BUILT_IN_FORGE_API_KEY bash deploy/oracle/provision-and-deploy.sh
```

A chave não deve aparecer em comandos registrados no histórico ou em tickets. Se preferir, execute o script sem exportar e informe os valores nos prompts interativos.

## Atualização da aplicação

Depois de uma nova alteração publicada na branch `main`, execute novamente:

```bash
cd /opt/urban-docs-generator
sudo bash deploy/oracle/provision-and-deploy.sh
```

A rotina faz `fetch`, troca para `main`, reconstrói a imagem, aplica o esquema e reinicia o serviço. Ela não remove o arquivo de configuração em `/etc/urban-docs/urban-docs.env`.

## Operação

```bash
sudo systemctl status urban-docs-generator
sudo journalctl -u urban-docs-generator -f
sudo systemctl restart urban-docs-generator
```

Durante o primeiro teste, acesse:

```text
http://IP_PUBLICO_DA_VM:3000/
```

Para produção, recomenda-se colocar Nginx ou Caddy na frente do container, abrir somente as portas `80` e `443` e configurar HTTPS. A porta `3306` deve continuar privada e não deve ser aberta para `0.0.0.0/0`.
