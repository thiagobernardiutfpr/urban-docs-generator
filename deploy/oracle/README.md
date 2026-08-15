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


## Provisionamento completo pelo Oracle Cloud Shell

O arquivo `cloud-shell-deploy.sh` automatiza a criação da VM e o deploy sem exigir que você copie comandos manualmente entre o PowerShell e a VM. Ele deve ser executado no **Oracle Cloud Shell**, não no PowerShell local e não dentro de uma sessão SSH da VM.

O script consulta o MySQL DB System pelo OCID, descobre a VCN e a subnet do banco, reutiliza uma subnet pública da mesma VCN, verifica a rota para Internet Gateway, cria ou reutiliza um Network Security Group dedicado, abre TCP 22 e TCP 3000 para a VM e autoriza TCP 3306 no banco somente a partir do CIDR da subnet da aplicação. Regras existentes da Security List do banco são preservadas.

### Pré-requisitos do Cloud Shell

O OCI CLI precisa estar autenticado e ter permissão para consultar o MySQL, criar Compute Instances, ler a rede, criar NSGs e atualizar a Security List do banco. O usuário também precisa possuir ou conseguir criar recursos dentro da cota Always Free.

Tenha em mãos o OCID do **compartment** onde a VM será criada, o OCID da tenancy e o OCID do DB System MySQL. O OCID do DB System pode ser copiado na página **MySQL HeatWave → DB Systems → seu banco → OCID**.

### Execução no Cloud Shell

Abra o Oracle Cloud Shell e execute:

```bash
mkdir -p ~/urban-docs-deploy
cd ~/urban-docs-deploy
curl -fsSLO https://raw.githubusercontent.com/thiagobernardiutfpr/urban-docs-generator/main/deploy/oracle/cloud-shell-deploy.sh
chmod 700 cloud-shell-deploy.sh
./cloud-shell-deploy.sh
```

O script solicitará os OCIDs e exibirá um plano antes de criar recursos. Digite `CREATE` somente depois de confirmar que a VCN, a subnet pública, a forma Always Free e os CIDRs estão corretos.

No final, ele solicita `DATABASE_URL` de forma silenciosa. Para o banco atualmente informado, a URL terá estrutura semelhante a:

```text
mysql://urban_docs_app:SENHA@10.0.1.190:3306/urban_docs
```

Não coloque a senha no comando de execução, no histórico do Cloud Shell, no GitHub ou em mensagens. O script envia o arquivo de ambiente por SCP e o instala na VM como `/etc/urban-docs/urban-docs.env` com permissão `600`.

### Parâmetros opcionais

Para evitar prompts repetidos, os parâmetros podem ser fornecidos como variáveis de ambiente. Os valores abaixo são exemplos e não contêm credenciais:

```bash
export COMPARTMENT_ID="ocid1.compartment.oc1..EXEMPLO"
export TENANCY_ID="ocid1.tenancy.oc1..EXEMPLO"
export DB_SYSTEM_ID="ocid1.mysqldbsystem.oc1..EXEMPLO"
export INSTANCE_NAME="urban-docs-app"
export VM_SHAPE="VM.Standard.A1.Flex"
export OCPUS=1
export MEMORY_GB=6
export SSH_SOURCE_CIDR="SEU_IP_PUBLICO/32"
export APP_SOURCE_CIDR="0.0.0.0/0"
./cloud-shell-deploy.sh
```

Se `APP_SUBNET_ID` não for informado, o script procura automaticamente a primeira subnet pública da mesma VCN. Para escolher uma subnet específica, informe seu OCID:

```bash
export APP_SUBNET_ID="ocid1.subnet.oc1..EXEMPLO"
```

A primeira execução cria uma chave em `~/.ssh/urban_docs_cloudshell` no Cloud Shell. A chave privada permanece no Cloud Shell e não é enviada ao repositório. O script usa essa chave para o SCP e o SSH do deploy.

### Reexecução e preservação

Executar novamente com o mesmo `INSTANCE_NAME` reutiliza a VM e o NSG existentes. A configuração de ambiente existente na VM é preservada por padrão. Para substituir explicitamente a configuração, use:

```bash
FORCE_CONFIG=YES ./cloud-shell-deploy.sh
```

O script não encerra nem remove automaticamente recursos em caso de erro. Isso evita destruição acidental e permite corrigir rede, quota ou permissões e executar novamente. Os OCIDs da VM e do NSG são exibidos no final; se for necessário remover recursos, faça isso conscientemente no Console Oracle ou usando o OCI CLI.

### Configuração posterior de domínio e HTTPS

O deploy inicial publica a aplicação na porta `3000`, por exemplo `http://PUBLIC_IP:3000/`. Para produção, configure um domínio, um reverse proxy Nginx ou Caddy e HTTPS nas portas `80` e `443`. A porta `3306` deve permanecer privada.

O script não cria o bucket de documentos. Para uploads, DOCX e PDFs em uma hospedagem Oracle externa, configure um armazenamento S3-compatible e informe `BUILT_IN_FORGE_API_URL` e `BUILT_IN_FORGE_API_KEY` quando solicitado.

### Recuperação de acesso SSH

Se o SSH falhar após a criação, não envie chaves privadas. Use o Console Connection da VM somente para corrigir `/home/opc/.ssh/authorized_keys`. A chave pública a ser cadastrada começa com `ssh-ed25519`; a chave privada correspondente fica no Cloud Shell em `~/.ssh/urban_docs_cloudshell`.
