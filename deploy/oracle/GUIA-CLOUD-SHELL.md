# Publicação do Urban Docs Generator no Oracle Cloud

Este guia descreve o procedimento completo para publicar o Urban Docs Generator em uma VM Oracle Cloud, conectada ao MySQL privado do Oracle MySQL HeatWave. O Oracle Cloud Shell será usado como ponto de controle; a aplicação ficará executando na VM.

> **Regra de segurança:** nunca envie senhas, tokens do GitHub, chaves privadas SSH ou o conteúdo de `authorized_keys` em mensagens, arquivos públicos ou commits.

## 1. Arquitetura final

A publicação terá esta estrutura:

| Componente | Localização | Função |
|---|---|---|
| Cloud Shell | Oracle Cloud | Executar o OCI CLI e o script de provisionamento |
| Compute VM | Oracle Cloud, mesma VCN do banco | Executar Node.js, Podman/Docker e o Urban Docs |
| MySQL DB System | Oracle MySQL HeatWave | Guardar usuários, solicitações, auditoria e metadados |
| Armazenamento de objetos | S3-compatible ou serviço configurado | Guardar uploads, DOCX, PDFs e arquivos assinados |
| Navegador | Internet | Acessar `http://IP_PUBLICO_DA_VM:3000/` durante o primeiro teste |

O banco usa o endereço privado `10.0.1.62`. A VM precisa estar na mesma VCN para conseguir acessá-lo. A porta `3306` não deve ser aberta para a internet.

## 2. Pré-requisitos

Antes de começar, confirme que:

1. O MySQL DB System está com estado `Active`.
2. O DB System foi criado na forma marcada como **Always Free**, quando aplicável.
3. Você possui acesso ao Oracle Cloud Console e ao Cloud Shell.
4. O repositório GitHub está acessível à sua conta.
5. O Cloud Shell está aberto na região do banco, por exemplo `sa-saopaulo-1`.
6. O MySQL possui um schema chamado `urban_docs` e um usuário de aplicação, preferencialmente `urban_docs_app`.

Se ainda não existir o usuário de aplicação, crie-o usando o usuário administrativo do MySQL a partir de uma máquina que consiga alcançar o banco pela VCN:

```sql
CREATE DATABASE IF NOT EXISTS urban_docs
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'urban_docs_app'@'%'
  IDENTIFIED BY 'SENHA_FORTE_DO_USUARIO_DA_APLICACAO';

GRANT ALL PRIVILEGES ON urban_docs.*
  TO 'urban_docs_app'@'%';

FLUSH PRIVILEGES;
```

A senha deve conter caracteres seguros para uma URL ou ser codificada corretamente. Nunca use a senha do usuário administrativo no código.

### Uso temporário do usuário administrativo

Se o usuário `urban_docs_app` ainda não existir e você não conseguir criá-lo antes da VM, o primeiro teste pode usar temporariamente a URL do usuário administrativo para aplicar o esquema. Depois crie o usuário de aplicação, altere `/etc/urban-docs/urban-docs.env` e reinicie o serviço. Para produção, não deixe o aplicativo usando o usuário administrativo.

## 3. Obter os OCIDs no Oracle Cloud

O script solicitará três OCIDs.

### 3.1 OCID da tenancy

No Oracle Cloud Console, abra o menu do perfil no canto superior direito e entre em **Tenancy information**. Copie o campo **OCID** da tenancy.

### 3.2 OCID do compartment

Abra:

```text
Identity & Security → Compartments
```

Selecione o compartimento onde a VM deverá ser criada e copie o campo **OCID**. Se você só utiliza o compartimento raiz, copie o OCID do compartimento raiz/tenancy conforme indicado pelo Console.

### 3.3 OCID do MySQL DB System

Abra:

```text
MySQL HeatWave → DB Systems → seu DB System
```

Copie o campo **OCID**. Não confunda o OCID do DB System com o IP `10.0.1.62`.

## 4. Preparar o Cloud Shell

Abra o **Cloud Shell** pelo Console Oracle. Confirme que o prompt é semelhante a:

```text
thiagohber@cloudshell:~$
```

O Cloud Shell é diferente do PowerShell do Windows e diferente do terminal SSH da VM.

Verifique os comandos básicos:

```bash
oci --version
jq --version
gh --version
ssh -V
```

O OCI CLI já costuma estar disponível no Cloud Shell. O script também precisa de `jq`, `ssh`, `ssh-keygen`, `scp`, `curl` e `nc`.

## 5. Autenticar o GitHub

O repositório `thiagobernardiutfpr/urban-docs-generator` é privado. Por isso, um download direto por `raw.githubusercontent.com` retorna `404` mesmo quando o arquivo existe.

No Cloud Shell, execute:

```bash
gh auth login
```

Escolha as opções abaixo quando forem apresentadas:

```text
GitHub.com
HTTPS
Login with a web browser ou código de dispositivo
```

Conclua a autenticação no navegador. Depois confirme:

```bash
gh auth status
```

O comando deve informar que a conta está autenticada.

## 6. Baixar o script de forma autenticada

Crie uma pasta de trabalho e baixe o script pela API autenticada do GitHub:

```bash
mkdir -p ~/urban-docs-deploy
cd ~/urban-docs-deploy
rm -f cloud-shell-deploy.sh
gh api -H 'Accept: application/vnd.github.raw' \
  '/repos/thiagobernardiutfpr/urban-docs-generator/contents/deploy/oracle/cloud-shell-deploy.sh?ref=main' \
  > cloud-shell-deploy.sh
chmod 700 cloud-shell-deploy.sh
```

Confirme que o arquivo foi baixado:

```bash
ls -lh cloud-shell-deploy.sh
bash -n cloud-shell-deploy.sh
```

Se `bash -n` não mostrar nada, a sintaxe está correta. Se aparecer `404`, execute novamente `gh auth status`; o problema é autenticação ou permissão de leitura do repositório.

Não digite os caracteres `>` ou `>>` que aparecem como prompt de continuação do terminal. Se aparecer `>>`, pressione `Ctrl+C` e cole uma linha por vez.

## 7. Restringir o acesso SSH

O script abre a porta 22 na regra de rede para permitir o acesso inicial à VM. O padrão é `0.0.0.0/0`, que é conveniente para teste, mas menos seguro.

Descubra o IP público de saída do Cloud Shell:

```bash
curl -4 -fsSL https://ifconfig.me
```

Supondo que o resultado seja `203.0.113.25`, restrinja o SSH assim:

```bash
export SSH_SOURCE_CIDR="203.0.113.25/32"
```

Se ainda não souber o IP, use temporariamente:

```bash
export SSH_SOURCE_CIDR="0.0.0.0/0"
```

Depois que o acesso funcionar, altere a regra no Oracle Cloud para o seu IP real.

A porta da aplicação continuará pública para o primeiro teste:

```bash
export APP_SOURCE_CIDR="0.0.0.0/0"
```

## 8. Escolher o nome da VM

Para criar uma VM nova somente quando você não tiver uma VM existente, não defina `TARGET_PUBLIC_IP`. No cenário atual, a VM existente deve ser reutilizada pelo IP público `137.131.140.39`:

```bash
export TARGET_PUBLIC_IP="137.131.140.39"
```

Se você deseja reutilizar a VM criada anteriormente pelo script, mantenha:

```bash
export TARGET_PUBLIC_IP="137.131.140.39"
```

Quando `TARGET_PUBLIC_IP` é informado, o script reutiliza a VM localizada pelo IP. Sem essa variável, ele reutiliza uma instância encontrada pelo `INSTANCE_NAME`; não use o mesmo nome de uma VM antiga que você pretende abandonar.

## 9. Executar o provisionamento

Como a VM já possui o IP público `137.131.140.39`, informe esse endereço para que o script a localize e reutilize. Isso evita que uma segunda VM seja criada:

```bash
export TARGET_PUBLIC_IP="137.131.140.39"
```

O script também configurará o Network Security Group na VNIC encontrada. Se o endereço não for encontrado na VCN do banco, o processo será interrompido em vez de criar uma VM duplicada.

Execute:

```bash
cd ~/urban-docs-deploy
./cloud-shell-deploy.sh
```

O script seguirá estas etapas:

1. Verificará `oci`, `jq`, `ssh`, `ssh-keygen`, `scp`, `curl` e `nc`.
2. Usará a sessão autenticada do GitHub para baixar o código e o script remoto.
3. Gerará uma nova chave em `~/.ssh/urban_docs_cloudshell`.
4. Consultará o DB System MySQL.
5. Descobrirá a subnet e a VCN do banco.
6. Selecionará uma subnet pública na mesma VCN para a VM.
7. Verificará a rota para um Internet Gateway.
8. Criará ou reutilizará um Network Security Group.
9. Liberará TCP 22 para o CIDR do SSH e TCP 3000 para o acesso à aplicação.
10. Restringirá a entrada TCP 3306 do banco ao CIDR da subnet da aplicação.
11. Criará ou reutilizará a VM `VM.Standard.A1.Flex`, com 1 OCPU e 6 GB de memória por padrão.
12. Aguardará o SSH e o cloud-init.
13. Enviará o código compactado à VM, sem exigir clone privado dentro dela.
14. Solicitará a configuração do banco e do armazenamento.
15. Construirá a imagem de produção.
16. Aplicará `pnpm db:push`.
17. Criará um serviço systemd.
18. Abrirá a porta 3000 no firewall interno da VM.
19. Verificará a resposta local da aplicação.

O script exibirá um plano antes de criar recursos. Leia a VCN, subnet, forma, CIDRs e nome da VM. Digite:

```text
CREATE
```

somente se tudo estiver correto.

## 10. Informar a conexão do banco

Depois que a VM for criada e acessível, o script solicitará `DATABASE_URL`. Informe:

```text
mysql://opc:SUA_SENHA@10.0.1.62:3306/urban_docs
```

Substitua `SUA_SENHA` pela senha real. Ela não aparecerá enquanto você digita.

Não inclua espaços nem quebras de linha. Se a senha tiver caracteres como `@`, `:`, `/`, `?` ou `#`, faça URL encoding ou use uma senha forte que não contenha esses caracteres especiais para o primeiro teste.

O arquivo final ficará na VM em:

```text
/etc/urban-docs/urban-docs.env
```

com permissão `600`. O arquivo não é commitado no GitHub.

## 11. Configurar armazenamento de arquivos

O aplicativo também precisa armazenar uploads, DOCX, PDFs e PDFs assinados. Quando o script solicitar:

```text
BUILT_IN_FORGE_API_URL
BUILT_IN_FORGE_API_KEY
```

informe os valores somente se o serviço de armazenamento estiver configurado para o ambiente externo. Se deixar vazio, o servidor poderá abrir e processar partes do fluxo, mas uploads e geração de arquivos poderão falhar.

Para produção externa, configure um armazenamento S3-compatible, como Cloudflare R2, Backblaze B2 ou Amazon S3, e adapte as variáveis do aplicativo conforme a implementação do projeto.

## 12. Abrir o Urban Docs

Ao terminar, o script exibirá algo semelhante a:

```text
Deploy concluído.
URL inicial: http://IP_PUBLICO_DA_VM:3000/
```

Copie a URL completa e abra no navegador. Por exemplo:

```text
http://137.131.140.39:3000/
```

O endereço pode ser acessado por qualquer usuário se `APP_SOURCE_CIDR` estiver em `0.0.0.0/0` e as regras de segurança estiverem corretas.

## 13. Validar a aplicação

No Cloud Shell, substitua `IP_PUBLICO_DA_VM` pelo IP exibido no final:

```bash
curl -I --max-time 20 http://IP_PUBLICO_DA_VM:3000/
```

O esperado é uma resposta HTTP, normalmente `200` ou um redirecionamento do frontend.

Para acompanhar a aplicação pela VM:

```bash
ssh -o IdentitiesOnly=yes \
  -i "$HOME/.ssh/urban_docs_cloudshell" \
  opc@IP_PUBLICO_DA_VM
```

Dentro da VM:

```bash
sudo systemctl status urban-docs-generator --no-pager
sudo journalctl -u urban-docs-generator -n 100 --no-pager
sudo podman ps
```

Se Docker for usado em vez de Podman, troque `podman` por `docker`.

Teste a porta do banco a partir da VM:

```bash
nc -vz 10.0.1.62 3306
```

O teste deve indicar que a porta está aberta. Se falhar, ajuste a regra de entrada TCP 3306 no Security List ou Network Security Group do DB System, permitindo o CIDR da subnet da VM.

## 14. Testar a criação anônima

No navegador:

1. Abra a URL pública.
2. Confirme que a interface informa acesso público sem login.
3. Abra **Nova solicitação**.
4. Preencha protocolo, inscrição imobiliária, interessado e objeto.
5. Avance até registrar a solicitação.
6. Atualize a página e confirme que a sessão anônima continua associada ao navegador.
7. Abra uma janela anônima separada e confirme que ela não enxerga as solicitações da primeira janela.

Para o fluxo completo, configure também o armazenamento de arquivos e os serviços de geração de documentos.

## 15. Atualizar o aplicativo posteriormente

No Cloud Shell, mantenha a chave e a sessão do GitHub. Baixe a versão atual do script novamente:

```bash
cd ~/urban-docs-deploy
gh api -H 'Accept: application/vnd.github.raw' \
  '/repos/thiagobernardiutfpr/urban-docs-generator/contents/deploy/oracle/cloud-shell-deploy.sh?ref=main' \
  > cloud-shell-deploy.sh
chmod 700 cloud-shell-deploy.sh
```

Use novamente o IP público da VM:

```bash
export TARGET_PUBLIC_IP="137.131.140.39"
./cloud-shell-deploy.sh
```

A configuração existente em `/etc/urban-docs/urban-docs.env` é preservada por padrão. Para substituir explicitamente a configuração, use:

```bash
export FORCE_CONFIG="YES"
./cloud-shell-deploy.sh
```

Não use `FORCE_CONFIG=YES` sem ter os valores corretos de `DATABASE_URL`, `JWT_SECRET` e armazenamento.

## 16. Diagnóstico de erros

| Mensagem | Causa provável | Correção |
|---|---|---|
| `404` ao usar `curl` em `raw.githubusercontent.com` | Repositório privado | Use `gh auth login` e `gh api` |
| `cloud-shell-deploy.sh: No such file` | O download falhou | Execute `ls -lh` e refaça o download autenticado |
| `oci: command not found` | OCI CLI indisponível | Reabra o Cloud Shell Oracle ou confirme a imagem do ambiente |
| `Não foi possível descobrir a subnet` | OCID incorreto ou permissão insuficiente | Confirme o OCID do DB System e o compartment |
| `Não existe subnet pública` | VCN do banco só possui subnets privadas | Crie uma subnet pública na mesma VCN ou informe `APP_SUBNET_ID` |
| `SSH não ficou acessível` | Rota, Public IP ou porta 22 | Confira subnet pública, Internet Gateway, NSG e Security List |
| `Permission denied (publickey)` | Chave incompatível ou usuário errado | Use a chave em `~/.ssh/urban_docs_cloudshell` e o usuário `opc` |
| `banner exchange timeout` | `sshd` não responde na VM | Reinicie a VM ou repare `sshd` pelo Console Connection |
| `Can't connect to MySQL` | Regra 3306 ou usuário incorreto | Teste `nc` dentro da VM e ajuste o CIDR do banco |
| Aplicação abre, mas upload falha | Armazenamento não configurado | Configure o serviço S3-compatible e as variáveis necessárias |
| Aplicação reinicia continuamente | Falha no ambiente ou migração | Use `journalctl -u urban-docs-generator -n 100` |

## 17. Segurança após o primeiro teste

Depois de confirmar que o site funciona:

1. Restrinja a porta 22 ao seu IP público.
2. Mantenha a porta 3306 privada.
3. Não use o usuário administrativo do MySQL na aplicação.
4. Configure armazenamento persistente externo.
5. Configure domínio e HTTPS usando Caddy, Nginx ou um balanceador.
6. Faça backup do banco e dos documentos.
7. Remova chaves privadas antigas ou expostas.
8. Revogue tokens do GitHub que tenham sido compartilhados.
9. Monitore os custos e os limites Always Free no Oracle Cloud.

A automação cria o primeiro acesso HTTP na porta 3000. Para um site público definitivo, o próximo passo é configurar um domínio, HTTPS e uma política de backup.

## Referências

[1]: [Oracle Cloud — Launching Your First Linux Instance](https://docs.oracle.com/iaas/Content/Compute/tutorials/first-linux-instance/overview.htm)

[2]: [Oracle Cloud — Always Free Resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

[3]: [Oracle MySQL HeatWave — Creating an Always Free DB System](https://docs.oracle.com/en-us/iaas/mysql-database/doc/creating-always-free-db-system.html)

[4]: [GitHub CLI — gh auth login](https://cli.github.com/manual/gh_auth_login)

[5]: [GitHub CLI — gh api](https://cli.github.com/manual/gh_api)
