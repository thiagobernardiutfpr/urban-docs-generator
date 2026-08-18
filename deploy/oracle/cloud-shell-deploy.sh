#!/usr/bin/env bash
set -Eeuo pipefail

# Provisiona uma Compute VM Oracle Linux na mesma VCN do MySQL e executa o
# deploy do Urban Docs Generator. O script deve ser executado no Oracle Cloud
# Shell, onde o OCI CLI já está autenticado.
#
# Credenciais nunca são colocadas na VM via user-data. DATABASE_URL e demais
# segredos são solicitados no Cloud Shell, enviados uma vez por SCP/SSH e
# gravados somente em /etc/urban-docs/urban-docs.env com modo 600.

REPO_URL="${REPO_URL:-https://github.com/thiagobernardiutfpr/urban-docs-generator.git}"
GITHUB_REPO="${GITHUB_REPO:-thiagobernardiutfpr/urban-docs-generator}"
BRANCH="${BRANCH:-main}"
DEPLOY_SCRIPT_URL="${DEPLOY_SCRIPT_URL:-https://raw.githubusercontent.com/thiagobernardiutfpr/urban-docs-generator/${BRANCH}/deploy/oracle/provision-and-deploy.sh}"
SOURCE_ARCHIVE_FILE="${SOURCE_ARCHIVE_FILE:-}"
SPATIAL_SOURCE_DIR="${SPATIAL_SOURCE_DIR:-}"
LOCAL_DEPLOY_SCRIPT_FILE=""
INSTANCE_NAME="${INSTANCE_NAME:-urban-docs-app-cloudshell}"
NSG_NAME="${NSG_NAME:-urban-docs-app-nsg}"
VM_SHAPE="${VM_SHAPE:-VM.Standard.A1.Flex}"
OCPUS="${OCPUS:-1}"
MEMORY_GB="${MEMORY_GB:-6}"
APP_PORT="${APP_PORT:-3000}"
SSH_USER="${SSH_USER:-opc}"
COMPARTMENT_ID="${COMPARTMENT_ID:-}"
TENANCY_ID="${TENANCY_ID:-}"
DB_SYSTEM_ID="${DB_SYSTEM_ID:-}"
APP_SUBNET_ID="${APP_SUBNET_ID:-}"
SSH_SOURCE_CIDR="${SSH_SOURCE_CIDR:-0.0.0.0/0}"
APP_SOURCE_CIDR="${APP_SOURCE_CIDR:-0.0.0.0/0}"
SSH_KEY_NAME="${SSH_KEY_NAME:-urban_docs_cloudshell}"
SSH_PRIVATE_KEY_FILE="${SSH_PRIVATE_KEY_FILE:-$HOME/.ssh/$SSH_KEY_NAME}"
SSH_PUBLIC_KEY_FILE="${SSH_PUBLIC_KEY_FILE:-${SSH_PRIVATE_KEY_FILE}.pub}"
AUTO_APPROVE="${AUTO_APPROVE:-NO}"
FORCE_CONFIG="${FORCE_CONFIG:-NO}"

TMP_DIR="$(mktemp -d)"
INSTANCE_ID="${INSTANCE_ID:-}"
TARGET_PUBLIC_IP="${TARGET_PUBLIC_IP:-${PUBLIC_IP:-}}"
PUBLIC_IP="${PUBLIC_IP:-}"
VNIC_ID=""
NSG_ID=""
DB_SUBNET_ID=""
DB_SUBNET_CIDR=""
APP_SUBNET_CIDR=""
VCN_ID=""

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  printf '\nERRO: %s\n' "$*" >&2
  exit 1
}

trap 'fail "Falha na linha ${LINENO}. Consulte a mensagem acima."' ERR

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Comando obrigatório não encontrado: $1"
}

read_tty() {
  local prompt="$1"
  local value=""
  if [[ -r /dev/tty ]]; then
    IFS= read -r -p "$prompt" value < /dev/tty
  else
    IFS= read -r -p "$prompt" value
  fi
  printf '%s' "$value"
}

read_secret_tty() {
  local prompt="$1"
  local value=""
  if [[ -r /dev/tty ]]; then
    IFS= read -r -s -p "$prompt" value < /dev/tty
    printf '\n' > /dev/tty || true
  else
    IFS= read -r -s -p "$prompt" value
    printf '\n' >&2 || true
  fi
  printf '%s' "$value"
}

require_inputs() {
  [[ -n "$COMPARTMENT_ID" ]] || COMPARTMENT_ID="$(read_tty 'OCID do compartment para VM/NSG: ')"
  [[ -n "$TENANCY_ID" ]] || TENANCY_ID="$(read_tty 'OCID da tenancy: ')"
  [[ -n "$DB_SYSTEM_ID" ]] || DB_SYSTEM_ID="$(read_tty 'OCID do MySQL DB System: ')"

  [[ "$COMPARTMENT_ID" == ocid1.* ]] || fail "COMPARTMENT_ID não parece um OCID válido."
  [[ "$TENANCY_ID" == ocid1.* ]] || fail "TENANCY_ID não parece um OCID válido."
  [[ "$DB_SYSTEM_ID" == ocid1.* ]] || fail "DB_SYSTEM_ID não parece um OCID válido."
}

download_github_assets() {
  LOCAL_DEPLOY_SCRIPT_FILE="$TMP_DIR/provision-and-deploy.sh"
  local need_source_archive="YES"
  if [[ -n "$SOURCE_ARCHIVE_FILE" && -s "$SOURCE_ARCHIVE_FILE" ]]; then
    need_source_archive="NO"
  fi

  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    log "Baixando o instalador privado do GitHub usando GITHUB_TOKEN"
    if [[ "$need_source_archive" == "YES" ]]; then
      log "Baixando o código privado do GitHub usando GITHUB_TOKEN"
      curl -fsSL \
        -H "Authorization: Bearer $GITHUB_TOKEN" \
        -H 'Accept: application/vnd.github+json' \
        "https://api.github.com/repos/${GITHUB_REPO}/tarball/${BRANCH}" \
        -o "$TMP_DIR/urban-docs-source.tar.gz"
    fi
    curl -fsSL \
      -H "Authorization: Bearer $GITHUB_TOKEN" \
      -H 'Accept: application/vnd.github.raw' \
      "https://api.github.com/repos/${GITHUB_REPO}/contents/deploy/oracle/provision-and-deploy.sh?ref=${BRANCH}" \
      -o "$LOCAL_DEPLOY_SCRIPT_FILE"
  elif command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    log "Baixando o instalador privado do GitHub usando a sessão do gh"
    if [[ "$need_source_archive" == "YES" ]]; then
      log "Baixando o código privado do GitHub usando a sessão do gh"
      gh api -H 'Accept: application/vnd.github+json' \
        "/repos/${GITHUB_REPO}/tarball/${BRANCH}" > "$TMP_DIR/urban-docs-source.tar.gz"
    fi
    gh api -H 'Accept: application/vnd.github.raw' \
      "/repos/${GITHUB_REPO}/contents/deploy/oracle/provision-and-deploy.sh?ref=${BRANCH}" \
      > "$LOCAL_DEPLOY_SCRIPT_FILE"
  else
    fail "O repositório GitHub é privado. No Cloud Shell, execute gh auth login ou exporte GITHUB_TOKEN com permissão somente de leitura do conteúdo do repositório antes de rodar este script."
  fi

  if [[ "$need_source_archive" == "YES" ]]; then
    SOURCE_ARCHIVE_FILE="$TMP_DIR/urban-docs-source.tar.gz"
    chmod 600 "$SOURCE_ARCHIVE_FILE"
  fi
  chmod 700 "$LOCAL_DEPLOY_SCRIPT_FILE"
}

ensure_ssh_key() {
  mkdir -p "$(dirname "$SSH_PRIVATE_KEY_FILE")"
  chmod 700 "$(dirname "$SSH_PRIVATE_KEY_FILE")"

  if [[ ! -s "$SSH_PRIVATE_KEY_FILE" || ! -s "$SSH_PUBLIC_KEY_FILE" ]]; then
    log "Gerando chave SSH dedicada no Cloud Shell: $SSH_PRIVATE_KEY_FILE"
    rm -f "$SSH_PRIVATE_KEY_FILE" "$SSH_PUBLIC_KEY_FILE"
    ssh-keygen -t ed25519 -f "$SSH_PRIVATE_KEY_FILE" -N '' -C "urban-docs-cloudshell" >/dev/null
  fi

  chmod 600 "$SSH_PRIVATE_KEY_FILE"
  chmod 644 "$SSH_PUBLIC_KEY_FILE"
}

load_network_from_db() {
  log "Lendo VCN e subnet do MySQL DB System"
  local db_json db_subnet_json
  db_json="$(oci mysql db-system get --db-system-id "$DB_SYSTEM_ID" --output json)"
  DB_SUBNET_ID="$(jq -r '.data["subnet-id"] // empty' <<<"$db_json")"
  [[ -n "$DB_SUBNET_ID" ]] || fail "Não foi possível descobrir a subnet do DB System."

  db_subnet_json="$(oci network subnet get --subnet-id "$DB_SUBNET_ID" --output json)"
  VCN_ID="$(jq -r '.data["vcn-id"] // empty' <<<"$db_subnet_json")"
  DB_SUBNET_CIDR="$(jq -r '.data["cidr-block"] // empty' <<<"$db_subnet_json")"
  [[ -n "$VCN_ID" && -n "$DB_SUBNET_CIDR" ]] || fail "Não foi possível descobrir a VCN/CIDR do banco."

  log "VCN do banco: $VCN_ID"
  log "Subnet do banco: $DB_SUBNET_ID ($DB_SUBNET_CIDR)"
}

discover_existing_instance() {
  [[ -n "$TARGET_PUBLIC_IP" ]] || return

  log "Procurando a VM existente pelo IP público $TARGET_PUBLIC_IP"
  local vnics attachments
  vnics="$(oci network vnic list --compartment-id "$COMPARTMENT_ID" --vcn-id "$VCN_ID" --all --output json)"
  VNIC_ID="$(jq -r --arg ip "$TARGET_PUBLIC_IP" '.data[]? | select(."public-ip" == $ip) | .id' <<<"$vnics" | head -n 1)"
  [[ -n "$VNIC_ID" ]] || fail "Não encontrei uma VNIC com o IP público $TARGET_PUBLIC_IP na VCN do MySQL. Verifique o IP ou informe INSTANCE_ID."

  APP_SUBNET_ID="$(jq -r --arg id "$VNIC_ID" '.data[]? | select(.id == $id) | ."subnet-id"' <<<"$vnics" | head -n 1)"
  [[ -n "$APP_SUBNET_ID" ]] || fail "Não foi possível descobrir a subnet da VM existente."

  attachments="$(oci compute vnic-attachment list --compartment-id "$COMPARTMENT_ID" --all --output json)"
  INSTANCE_ID="$(jq -r --arg vnic "$VNIC_ID" '.data[]? | select(."vnic-id" == $vnic) | ."instance-id"' <<<"$attachments" | head -n 1)"
  [[ -n "$INSTANCE_ID" ]] || fail "Não foi possível descobrir o OCID da VM associada ao IP $TARGET_PUBLIC_IP."

  PUBLIC_IP="$TARGET_PUBLIC_IP"
  log "VM existente encontrada: $INSTANCE_ID"
  log "Subnet da VM existente: $APP_SUBNET_ID"
}

select_public_subnet() {
  local subnets subnet_json app_vcn_id prohibit_public

  if [[ -n "$APP_SUBNET_ID" ]]; then
    subnet_json="$(oci network subnet get --subnet-id "$APP_SUBNET_ID" --output json)"
  else
    log "Procurando uma subnet pública existente na VCN do banco"
    subnets="$(oci network subnet list --compartment-id "$COMPARTMENT_ID" --vcn-id "$VCN_ID" --all --output json)"
    APP_SUBNET_ID="$(jq -r '.data[]? | select(.["prohibit-public-ip-on-vnic"] == false) | .id' <<<"$subnets" | head -n 1)"
    [[ -n "$APP_SUBNET_ID" ]] || fail "Nenhuma subnet pública foi encontrada na VCN. Crie uma subnet pública ou informe APP_SUBNET_ID."
    subnet_json="$(oci network subnet get --subnet-id "$APP_SUBNET_ID" --output json)"
  fi

  app_vcn_id="$(jq -r '.data["vcn-id"] // empty' <<<"$subnet_json")"
  APP_SUBNET_CIDR="$(jq -r '.data["cidr-block"] // empty' <<<"$subnet_json")"
  prohibit_public="$(jq -r '.data["prohibit-public-ip-on-vnic"] // true' <<<"$subnet_json")"

  [[ "$app_vcn_id" == "$VCN_ID" ]] || fail "APP_SUBNET_ID não pertence à mesma VCN do MySQL."
  [[ "$prohibit_public" == "false" ]] || fail "A subnet da aplicação é privada. Informe uma subnet pública da mesma VCN."
  [[ -n "$APP_SUBNET_CIDR" ]] || fail "Não foi possível descobrir o CIDR da subnet da aplicação."

  log "Subnet pública da aplicação: $APP_SUBNET_ID ($APP_SUBNET_CIDR)"
}

verify_public_route() {
  local subnet_json route_table_id route_json igw_ids target_id
  subnet_json="$(oci network subnet get --subnet-id "$APP_SUBNET_ID" --output json)"
  route_table_id="$(jq -r '.data["route-table-id"] // empty' <<<"$subnet_json")"
  [[ -n "$route_table_id" ]] || fail "A subnet da aplicação não possui Route Table associada."

  route_json="$(oci network route-table get --rt-id "$route_table_id" --output json 2>/dev/null || oci network route-table get --route-table-id "$route_table_id" --output json)"
  target_id="$(jq -r '.data["route-rules"][]? | select(.destination == "0.0.0.0/0") | .["network-entity-id"] // empty' <<<"$route_json" | head -n 1)"
  igw_ids="$(oci network internet-gateway list --compartment-id "$COMPARTMENT_ID" --vcn-id "$VCN_ID" --all --output json | jq -r '.data[]? | select(.["is-enabled"] == true) | .id')"

  [[ -n "$target_id" ]] || fail "A Route Table da subnet não possui rota 0.0.0.0/0."
  grep -Fxq "$target_id" <<<"$igw_ids" || fail "A rota 0.0.0.0/0 não aponta para um Internet Gateway habilitado."
  log "Rota pública confirmada via Internet Gateway: $target_id"
}

create_or_reuse_nsg() {
  local nsgs
  nsgs="$(oci network nsg list --compartment-id "$COMPARTMENT_ID" --vcn-id "$VCN_ID" --all --output json)"
  NSG_ID="$(jq -r --arg name "$NSG_NAME" '.data[]? | select(.["display-name"] == $name) | .id' <<<"$nsgs" | head -n 1)"

  if [[ -z "$NSG_ID" ]]; then
    log "Criando Network Security Group $NSG_NAME"
    NSG_ID="$(oci network nsg create --compartment-id "$COMPARTMENT_ID" --vcn-id "$VCN_ID" --display-name "$NSG_NAME" --query 'data.id' --raw-output)"
  else
    log "Reutilizando Network Security Group $NSG_ID"
  fi
}

nsg_has_tcp_rule() {
  local direction="$1" source="$2" port="$3"
  jq -e --arg direction "$direction" --arg source "$source" --argjson port "$port" '
    any(.data[]?;
      .direction == $direction and
      .protocol == "6" and
      .source == $source and
      (((.tcpOptions.destinationPortRange.min // -1) | tonumber) == $port)
    )
  ' <<<"$NSG_RULES_JSON" >/dev/null
}

add_nsg_tcp_rule() {
  local direction="$1" source="$2" port="$3" description="$4" rule_file
  if nsg_has_tcp_rule "$direction" "$source" "$port"; then
    return
  fi

  rule_file="$TMP_DIR/nsg-rule.json"
  jq -n --arg direction "$direction" --arg source "$source" --arg description "$description" --argjson port "$port" '
    [{
      direction: $direction,
      isStateless: false,
      protocol: "6",
      source: $source,
      sourceType: "CIDR_BLOCK",
      tcpOptions: { destinationPortRange: { min: $port, max: $port } },
      description: $description
    }]
  ' > "$rule_file"
  oci network nsg rules add --nsg-id "$NSG_ID" --security-rules "file://$rule_file" >/dev/null
  NSG_RULES_JSON="$(oci network nsg rules list --nsg-id "$NSG_ID" --all --output json)"
}

configure_nsg() {
  NSG_RULES_JSON="$(oci network nsg rules list --nsg-id "$NSG_ID" --all --output json)"
  add_nsg_tcp_rule INGRESS "$SSH_SOURCE_CIDR" 22 "Urban Docs SSH"
  add_nsg_tcp_rule INGRESS "$APP_SOURCE_CIDR" "$APP_PORT" "Urban Docs application"

  if ! jq -e 'any(.data[]?; .direction == "EGRESS" and .protocol == "all" and .destination == "0.0.0.0/0")' <<<"$NSG_RULES_JSON" >/dev/null; then
    jq -n '[{
      direction: "EGRESS",
      isStateless: false,
      protocol: "all",
      destination: "0.0.0.0/0",
      destinationType: "CIDR_BLOCK",
      description: "Urban Docs outbound"
    }]' > "$TMP_DIR/nsg-egress.json"
    oci network nsg rules add --nsg-id "$NSG_ID" --security-rules "file://$TMP_DIR/nsg-egress.json" >/dev/null
  fi
}

configure_database_ingress() {
  local db_subnet_json security_list_id db_sl_json ingress_file egress_file
  db_subnet_json="$(oci network subnet get --subnet-id "$DB_SUBNET_ID" --output json)"
  security_list_id="$(jq -r '.data["security-list-ids"][0] // empty' <<<"$db_subnet_json")"
  [[ -n "$security_list_id" ]] || fail "A subnet do banco não possui Security List para autorizar a VM."

  db_sl_json="$(oci network security-list get --security-list-id "$security_list_id" --output json)"
  ingress_file="$TMP_DIR/db-ingress.json"
  egress_file="$TMP_DIR/db-egress.json"

  jq --arg cidr "$APP_SUBNET_CIDR" '
    .data["ingress-security-rules"] as $rules |
    if any($rules[]?;
      .protocol == "6" and .source == $cidr and
      (((.tcpOptions.destinationPortRange.min // -1) | tonumber) == 3306)
    ) then $rules else $rules + [{
      isStateless: false,
      protocol: "6",
      source: $cidr,
      sourceType: "CIDR_BLOCK",
      tcpOptions: { destinationPortRange: { min: 3306, max: 3306 } },
      description: "Urban Docs application to MySQL"
    }] end
  ' <<<"$db_sl_json" > "$ingress_file"

  jq '.data["egress-security-rules"]' <<<"$db_sl_json" > "$egress_file"
  oci network security-list update \
    --security-list-id "$security_list_id" \
    --ingress-security-rules "file://$ingress_file" \
    --egress-security-rules "file://$egress_file" \
    --force >/dev/null

  log "Acesso MySQL autorizado somente a partir de $APP_SUBNET_CIDR"
}

select_availability_domain() {
  if [[ -z "${AVAILABILITY_DOMAIN:-}" ]]; then
    AVAILABILITY_DOMAIN="$(oci iam availability-domain list --compartment-id "$TENANCY_ID" --query 'data[0].name' --raw-output)"
  fi
  [[ -n "$AVAILABILITY_DOMAIN" ]] || fail "Não foi possível selecionar uma Availability Domain."
  log "Availability Domain: $AVAILABILITY_DOMAIN"
}

select_image() {
  local images
  log "Buscando a imagem Oracle Linux 9 compatível com $VM_SHAPE"
  images="$(oci compute image list \
    --compartment-id "$COMPARTMENT_ID" \
    --operating-system "Oracle Linux" \
    --shape "$VM_SHAPE" \
    --all \
    --sort-by TIMECREATED \
    --sort-order DESC \
    --output json)"

  IMAGE_ID="$(jq -r '([.data[]? | select(.["lifecycle-state"] == "AVAILABLE") | select((.["operating-system-version"] // "") | startswith("9"))] | .[0].id) // empty' <<<"$images")"
  [[ -n "$IMAGE_ID" ]] || IMAGE_ID="$(jq -r '([.data[]? | select(.["lifecycle-state"] == "AVAILABLE")] | .[0].id) // empty' <<<"$images")"
  [[ -n "$IMAGE_ID" ]] || fail "Não foi encontrada imagem Oracle Linux compatível com $VM_SHAPE. Defina IMAGE_ID manualmente."
  log "Imagem selecionada: $IMAGE_ID"
}

confirm_plan() {
  cat <<EOF

Recursos que serão usados ou criados:
  Região atual do OCI CLI: $(oci iam region-subscription list --tenancy-id "$TENANCY_ID" --output json 2>/dev/null | jq -r '.data[]? | select(.["is-home-region"] == true) | .region-name' | head -n 1 || true)
  VM: $INSTANCE_NAME
  Shape: $VM_SHAPE (${OCPUS} OCPU, ${MEMORY_GB} GB)
  VCN: $VCN_ID
  Subnet pública da VM: $APP_SUBNET_ID ($APP_SUBNET_CIDR)
  NSG: $NSG_NAME ($NSG_ID)
  Subnet do MySQL: $DB_SUBNET_ID ($DB_SUBNET_CIDR)
  SSH source CIDR: $SSH_SOURCE_CIDR
  Aplicação: TCP $APP_PORT a partir de $APP_SOURCE_CIDR
  MySQL: TCP 3306 somente a partir de $APP_SUBNET_CIDR

A porta 3306 não será aberta para a internet. A VM e o NSG podem consumir recursos da cota Always Free.
EOF

  if [[ "$AUTO_APPROVE" != "YES" ]]; then
    local answer
    answer="$(read_tty 'Digite CREATE para continuar: ')"
    [[ "$answer" == "CREATE" ]] || fail "Operação cancelada."
  fi
}

create_or_reuse_instance() {
  local instances source_details shape_config nsg_ids user_data_file

  if [[ -n "$INSTANCE_ID" ]]; then
    log "Reutilizando VM existente $INSTANCE_ID"
    return
  fi

  instances="$(oci compute instance list --compartment-id "$COMPARTMENT_ID" --all --output json)"
  INSTANCE_ID="$(jq -r --arg name "$INSTANCE_NAME" '.data[]? | select(.["display-name"] == $name) | .id' <<<"$instances" | head -n 1)"

  if [[ -n "$INSTANCE_ID" ]]; then
    log "Reutilizando VM existente $INSTANCE_ID"
    return
  fi

  [[ -z "$TARGET_PUBLIC_IP" ]] || fail "A VM com o IP público $TARGET_PUBLIC_IP não foi localizada. O script não criará uma VM duplicada."

  shape_config="$(jq -nc --argjson ocpus "$OCPUS" --argjson memory "$MEMORY_GB" '{ocpus:$ocpus,memoryInGBs:$memory}')"
  nsg_ids="$(jq -nc --arg id "$NSG_ID" '[$id]')"
  user_data_file="$TMP_DIR/cloud-init.yaml"
  cat > "$user_data_file" <<EOF
#cloud-config
package_update: true
packages:
  - git
  - podman
  - firewalld
runcmd:
  - [ systemctl, enable, --now, firewalld ]
  - [ firewall-cmd, --permanent, --add-service=ssh ]
  - [ firewall-cmd, --permanent, --add-port=${APP_PORT}/tcp ]
  - [ firewall-cmd, --reload ]
EOF

  log "Criando VM $INSTANCE_NAME"
  INSTANCE_ID="$(oci compute instance launch \
    --compartment-id "$COMPARTMENT_ID" \
    --availability-domain "$AVAILABILITY_DOMAIN" \
    --display-name "$INSTANCE_NAME" \
    --shape "$VM_SHAPE" \
    --shape-config "$shape_config" \
    --image-id "$IMAGE_ID" \
    --subnet-id "$APP_SUBNET_ID" \
    --assign-public-ip true \
    --nsg-ids "$nsg_ids" \
    --ssh-authorized-keys-file "$SSH_PUBLIC_KEY_FILE" \
    --boot-volume-size-in-gbs 50 \
    --user-data-file "$user_data_file" \
    --wait-for-state RUNNING \
    --query 'data.id' \
    --raw-output)"
}

get_public_ip() {
  local attachment_id
  if [[ -z "$VNIC_ID" ]]; then
    attachment_id="$(oci compute vnic-attachment list --compartment-id "$COMPARTMENT_ID" --instance-id "$INSTANCE_ID" --all --query 'data[0].id' --raw-output)"
    VNIC_ID="$(oci compute vnic-attachment get --vnic-attachment-id "$attachment_id" --query 'data."vnic-id"' --raw-output)"
  fi
  PUBLIC_IP="$(oci network vnic get --vnic-id "$VNIC_ID" --query 'data."public-ip"' --raw-output)"
  [[ -n "$PUBLIC_IP" && "$PUBLIC_IP" != "null" ]] || fail "A VM não recebeu Public IP."
  log "Public IP da VM: $PUBLIC_IP"
}

ensure_nsg_on_vnic() {
  local vnic_json attached_nsgs merged_nsgs
  vnic_json="$(oci network vnic get --vnic-id "$VNIC_ID" --output json)"
  attached_nsgs="$(jq -r '.data["nsg-ids"][]? // empty' <<<"$vnic_json")"
  if grep -Fxq "$NSG_ID" <<<"$attached_nsgs"; then
    return
  fi

  merged_nsgs="$(jq -c --arg nsg "$NSG_ID" '.data["nsg-ids"] // [] | . + [$nsg] | unique' <<<"$vnic_json")"
  oci network vnic update --vnic-id "$VNIC_ID" --nsg-ids "$merged_nsgs" >/dev/null
  log "NSG da aplicação associado à VNIC da VM"
}

wait_for_ssh() {
  local tries=0
  log "Aguardando a porta SSH da VM"
  until nc -z -w 3 "$PUBLIC_IP" 22 >/dev/null 2>&1; do
    tries=$((tries + 1))
    (( tries < 60 )) || fail "SSH não ficou acessível após 5 minutos. Verifique a subnet, rota e regras de TCP 22."
    sleep 5
  done
}

wait_for_cloud_init() {
  local -a opts
  mapfile -t opts < <(ssh_opts)
  log "Aguardando o cloud-init terminar a instalação inicial"
  ssh "${opts[@]}" "$SSH_USER@$PUBLIC_IP" \
    'if command -v cloud-init >/dev/null 2>&1; then sudo cloud-init status --wait || true; fi' >/dev/null
}

prepare_secret_file() {
  local database_url forge_url forge_key jwt_secret
  database_url="${DATABASE_URL:-}"
  forge_url="${BUILT_IN_FORGE_API_URL:-}"
  forge_key="${BUILT_IN_FORGE_API_KEY:-}"
  jwt_secret="${JWT_SECRET:-$(openssl rand -hex 32)}"

  [[ -n "$database_url" ]] || database_url="$(read_secret_tty 'DATABASE_URL (mysql://opc:SENHA@10.0.1.62:3306/urban_docs): ')"
  [[ "$database_url" == mysql://* ]] || fail "DATABASE_URL deve começar com mysql://"
  [[ "$database_url" == *"@10.0.1.62:3306/urban_docs" ]] || log "AVISO: confirme que a DATABASE_URL aponta para 10.0.1.62:3306/urban_docs."
  [[ "$database_url" != *$'\n'* ]] || fail "DATABASE_URL não pode conter quebra de linha."

  if [[ -z "$forge_url" ]]; then
    forge_url="$(read_tty 'BUILT_IN_FORGE_API_URL (deixe vazio se ainda não configurou): ')"
  fi
  if [[ -n "$forge_url" && -z "$forge_key" ]]; then
    forge_key="$(read_secret_tty 'BUILT_IN_FORGE_API_KEY: ')"
  fi
  if [[ -n "$forge_url" && -z "$forge_key" ]]; then
    fail "BUILT_IN_FORGE_API_KEY é obrigatório quando BUILT_IN_FORGE_API_URL é informado."
  fi

  umask 077
  {
    printf 'NODE_ENV=production\n'
    printf 'PORT=%s\n' "$APP_PORT"
    printf 'DATABASE_URL=%s\n' "$database_url"
    printf 'JWT_SECRET=%s\n' "$jwt_secret"
    if [[ -n "$forge_url" ]]; then
      printf 'BUILT_IN_FORGE_API_URL=%s\n' "$forge_url"
      printf 'BUILT_IN_FORGE_API_KEY=%s\n' "$forge_key"
    fi
  } > "$TMP_DIR/urban-docs.env"
}

ssh_opts() {
  printf '%s\n' \
    -o StrictHostKeyChecking=accept-new \
    -o IdentitiesOnly=yes \
    -o ConnectTimeout=30 \
    -i "$SSH_PRIVATE_KEY_FILE"
}

remote_has_config() {
  local -a opts
  mapfile -t opts < <(ssh_opts)
  ssh "${opts[@]}" "$SSH_USER@$PUBLIC_IP" 'sudo test -s /etc/urban-docs/urban-docs.env' >/dev/null 2>&1
}

upload_source_if_available() {
  [[ -n "$SOURCE_ARCHIVE_FILE" && -s "$SOURCE_ARCHIVE_FILE" ]] || return
  local -a opts
  mapfile -t opts < <(ssh_opts)
  log "Enviando o código da aplicação para a VM"
  scp "${opts[@]}" "$SOURCE_ARCHIVE_FILE" "$SSH_USER@$PUBLIC_IP:/tmp/urban-docs-source.tar.gz" >/dev/null
}

upload_spatial_if_available() {
  [[ -n "$SPATIAL_SOURCE_DIR" ]] || return
  [[ -d "$SPATIAL_SOURCE_DIR" ]] || fail "SPATIAL_SOURCE_DIR não existe: $SPATIAL_SOURCE_DIR"

  local -a opts
  local file uploaded=0
  mapfile -t opts < <(ssh_opts)
  ssh "${opts[@]}" "$SSH_USER@$PUBLIC_IP" 'sudo rm -rf /tmp/urban-docs-spatial && sudo install -d -m 700 /tmp/urban-docs-spatial && sudo chown "$(id -u):$(id -g)" /tmp/urban-docs-spatial' >/dev/null

  for file in GEOPACKAGE_22-10-25.gpkg Lotes-cadastro.xlsx Lotes-NumQgis.xlsx LotesxZoneamento.xlsx; do
    if [[ -s "$SPATIAL_SOURCE_DIR/$file" ]]; then
      log "Enviando fonte territorial: $file"
      scp "${opts[@]}" "$SPATIAL_SOURCE_DIR/$file" "$SSH_USER@$PUBLIC_IP:/tmp/urban-docs-spatial/$file" >/dev/null
      uploaded=$((uploaded + 1))
    fi
  done

  if [[ "$uploaded" -eq 0 ]]; then
    ssh "${opts[@]}" "$SSH_USER@$PUBLIC_IP" 'sudo rm -rf /tmp/urban-docs-spatial' >/dev/null
    log "AVISO: nenhum arquivo territorial encontrado em $SPATIAL_SOURCE_DIR"
    SPATIAL_SOURCE_DIR=""
  else
    log "$uploaded fonte(s) territorial(is) enviada(s) para a VM"
  fi
}

upload_config_if_needed() {
  local -a opts
  prepare_secret_file
  if [[ "$FORCE_CONFIG" != "YES" ]] && remote_has_config; then
    log "Configuração existente na VM preservada; FORCE_CONFIG=YES para substituir."
    return
  fi

  mapfile -t opts < <(ssh_opts)
  log "Enviando configuração protegida para a VM"
  scp "${opts[@]}" "$TMP_DIR/urban-docs.env" "$SSH_USER@$PUBLIC_IP:/tmp/urban-docs.env" >/dev/null
  ssh "${opts[@]}" "$SSH_USER@$PUBLIC_IP" \
    'sudo install -d -m 700 /etc/urban-docs && sudo install -o root -g root -m 600 /tmp/urban-docs.env /etc/urban-docs/urban-docs.env && rm -f /tmp/urban-docs.env'
}

run_remote_deploy() {
  local -a opts remote_command
  mapfile -t opts < <(ssh_opts)
  log "Executando o deploy remoto"
  if [[ -n "$SOURCE_ARCHIVE_FILE" && -n "$SPATIAL_SOURCE_DIR" ]]; then
    remote_command='sudo env SOURCE_ARCHIVE_FILE=/tmp/urban-docs-source.tar.gz SPATIAL_UPLOAD_DIR=/tmp/urban-docs-spatial bash -s'
  elif [[ -n "$SOURCE_ARCHIVE_FILE" ]]; then
    remote_command='sudo env SOURCE_ARCHIVE_FILE=/tmp/urban-docs-source.tar.gz bash -s'
  elif [[ -n "$SPATIAL_SOURCE_DIR" ]]; then
    remote_command='sudo env SPATIAL_UPLOAD_DIR=/tmp/urban-docs-spatial bash -s'
  else
    remote_command='sudo bash -s'
  fi
  ssh "${opts[@]}" -tt "$SSH_USER@$PUBLIC_IP" "$remote_command" < "$LOCAL_DEPLOY_SCRIPT_FILE"
  if [[ -n "$SOURCE_ARCHIVE_FILE" || -n "$SPATIAL_SOURCE_DIR" ]]; then
    ssh "${opts[@]}" "$SSH_USER@$PUBLIC_IP" 'sudo rm -f /tmp/urban-docs-source.tar.gz; sudo rm -rf /tmp/urban-docs-spatial' >/dev/null || true
  fi
}

main() {
  need_cmd oci
  need_cmd jq
  need_cmd ssh
  need_cmd ssh-keygen
  need_cmd scp
  need_cmd curl
  need_cmd nc

  require_inputs
  download_github_assets
  ensure_ssh_key
  load_network_from_db
  discover_existing_instance
  select_public_subnet
  verify_public_route
  create_or_reuse_nsg
  configure_nsg
  configure_database_ingress
  select_availability_domain
  select_image
  confirm_plan
  create_or_reuse_instance
  get_public_ip
  ensure_nsg_on_vnic
  wait_for_ssh
  wait_for_cloud_init
  upload_source_if_available
  upload_spatial_if_available
  upload_config_if_needed
  run_remote_deploy

  cat <<EOF

Deploy concluído.

URL inicial: http://${PUBLIC_IP}:${APP_PORT}/
SSH: ssh -i ${SSH_PRIVATE_KEY_FILE} ${SSH_USER}@${PUBLIC_IP}
VM OCID: ${INSTANCE_ID}
NSG OCID: ${NSG_ID}

A porta 3306 ficou restrita ao CIDR ${APP_SUBNET_CIDR}. Não a abra publicamente.
Para atualizar o aplicativo, execute novamente este script com o mesmo INSTANCE_NAME.
EOF
}

main "$@"
