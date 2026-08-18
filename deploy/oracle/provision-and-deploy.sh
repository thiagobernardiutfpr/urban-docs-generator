#!/usr/bin/env bash
set -Eeuo pipefail

# Provisiona uma VM Oracle Linux e publica o Urban Docs Generator.
# As credenciais são lidas interativamente pelo /dev/tty e gravadas somente
# em /etc/urban-docs/urban-docs.env com permissão 600.

REPO_URL="${REPO_URL:-https://github.com/thiagobernardiutfpr/urban-docs-generator.git}"
BRANCH="${BRANCH:-main}"
SOURCE_ARCHIVE_FILE="${SOURCE_ARCHIVE_FILE:-}"
APP_DIR="${APP_DIR:-/opt/urban-docs-generator}"
CONFIG_DIR="${CONFIG_DIR:-/etc/urban-docs}"
ENV_FILE="${CONFIG_DIR}/urban-docs.env"
IMAGE="${IMAGE:-urban-docs-generator:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-urban-docs-generator}"
SERVICE_NAME="${SERVICE_NAME:-urban-docs-generator}"
APP_PORT="${APP_PORT:-3000}"
LOCAL_STORAGE_DIR="${LOCAL_STORAGE_DIR:-/var/lib/urban-docs/storage}"
SPATIAL_DATA_DIR="${SPATIAL_DATA_DIR:-/var/lib/urban-docs/data/spatial}"
DEFAULT_SPATIAL_SOURCE_PATH="${DEFAULT_SPATIAL_SOURCE_PATH:-${SPATIAL_DATA_DIR}/GEOPACKAGE_22-10-25.gpkg}"
TERRITORIAL_CADASTRO_PATH="${TERRITORIAL_CADASTRO_PATH:-${SPATIAL_DATA_DIR}/Lotes-cadastro.xlsx}"
TERRITORIAL_NUMERACAO_PATH="${TERRITORIAL_NUMERACAO_PATH:-${SPATIAL_DATA_DIR}/Lotes-NumQgis.xlsx}"
TERRITORIAL_ZONEAMENTO_PATH="${TERRITORIAL_ZONEAMENTO_PATH:-${SPATIAL_DATA_DIR}/LotesxZoneamento.xlsx}"
SPATIAL_UPLOAD_DIR="${SPATIAL_UPLOAD_DIR:-}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
  printf '\nERRO: %s\n' "$*" >&2
  exit 1
}

trap 'fail "Falha na linha ${LINENO}. Consulte a mensagem acima."' ERR

[[ "$(id -u)" -eq 0 ]] || fail "Execute como root: sudo bash deploy/oracle/provision-and-deploy.sh"

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

install_packages() {
  log "Instalando pacotes básicos"
  dnf install -y git curl ca-certificates openssl firewalld podman
  systemctl enable --now firewalld
}

select_runtime() {
  if command -v docker >/dev/null 2>&1; then
    RUNTIME="$(command -v docker)"
    RUNTIME_KIND="docker"
    systemctl enable --now docker || true
  elif command -v podman >/dev/null 2>&1; then
    RUNTIME="$(command -v podman)"
    RUNTIME_KIND="podman"
  else
    fail "Nenhum runtime de containers disponível após a instalação."
  fi
  log "Runtime selecionado: ${RUNTIME_KIND} (${RUNTIME})"
}

read_configuration() {
  mkdir -p "$CONFIG_DIR"
  chmod 700 "$CONFIG_DIR"

  local database_url="${DATABASE_URL:-}"
  local forge_url="${BUILT_IN_FORGE_API_URL:-}"
  local forge_key="${BUILT_IN_FORGE_API_KEY:-}"
  local jwt_secret="${JWT_SECRET:-}"
  local local_storage_dir="${LOCAL_STORAGE_DIR}"
  local spatial_data_dir="${SPATIAL_DATA_DIR}"
  local spatial_source_path="${DEFAULT_SPATIAL_SOURCE_PATH}"
  local territorial_cadastro_path="${TERRITORIAL_CADASTRO_PATH}"
  local territorial_numeracao_path="${TERRITORIAL_NUMERACAO_PATH}"
  local territorial_zoneamento_path="${TERRITORIAL_ZONEAMENTO_PATH}"

  # Em atualizações, preserve valores já configurados. O arquivo não é
  # carregado como código shell porque URLs e segredos podem conter caracteres
  # que tenham significado especial para o Bash.
  if [[ -f "$ENV_FILE" ]]; then
    [[ -n "$database_url" ]] || database_url="$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | head -n 1)"
    [[ -n "$forge_url" ]] || forge_url="$(sed -n 's/^BUILT_IN_FORGE_API_URL=//p' "$ENV_FILE" | head -n 1)"
    [[ -n "$forge_key" ]] || forge_key="$(sed -n 's/^BUILT_IN_FORGE_API_KEY=//p' "$ENV_FILE" | head -n 1)"
    [[ -n "$jwt_secret" ]] || jwt_secret="$(sed -n 's/^JWT_SECRET=//p' "$ENV_FILE" | head -n 1)"
    [[ -n "$(sed -n 's/^LOCAL_STORAGE_DIR=//p' "$ENV_FILE" | head -n 1)" ]] && local_storage_dir="$(sed -n 's/^LOCAL_STORAGE_DIR=//p' "$ENV_FILE" | head -n 1)"
    [[ -n "$(sed -n 's/^SPATIAL_DATA_DIR=//p' "$ENV_FILE" | head -n 1)" ]] && spatial_data_dir="$(sed -n 's/^SPATIAL_DATA_DIR=//p' "$ENV_FILE" | head -n 1)"
    [[ -n "$(sed -n 's/^DEFAULT_SPATIAL_SOURCE_PATH=//p' "$ENV_FILE" | head -n 1)" ]] && spatial_source_path="$(sed -n 's/^DEFAULT_SPATIAL_SOURCE_PATH=//p' "$ENV_FILE" | head -n 1)"
    [[ -n "$(sed -n 's/^TERRITORIAL_CADASTRO_PATH=//p' "$ENV_FILE" | head -n 1)" ]] && territorial_cadastro_path="$(sed -n 's/^TERRITORIAL_CADASTRO_PATH=//p' "$ENV_FILE" | head -n 1)"
    [[ -n "$(sed -n 's/^TERRITORIAL_NUMERACAO_PATH=//p' "$ENV_FILE" | head -n 1)" ]] && territorial_numeracao_path="$(sed -n 's/^TERRITORIAL_NUMERACAO_PATH=//p' "$ENV_FILE" | head -n 1)"
    [[ -n "$(sed -n 's/^TERRITORIAL_ZONEAMENTO_PATH=//p' "$ENV_FILE" | head -n 1)" ]] && territorial_zoneamento_path="$(sed -n 's/^TERRITORIAL_ZONEAMENTO_PATH=//p' "$ENV_FILE" | head -n 1)"
  fi

  if [[ -z "$database_url" ]]; then
    database_url="$(read_tty 'DATABASE_URL (mysql://opc:SENHA@10.0.1.62:3306/urban_docs): ')"
  fi
  [[ -n "$database_url" ]] || fail "DATABASE_URL não pode ficar vazio."

  if [[ -z "$forge_url" ]]; then
    forge_url="$(read_tty 'BUILT_IN_FORGE_API_URL (deixe vazio se ainda não configurou): ')"
  fi
  if [[ -z "$forge_key" && -n "$forge_url" ]]; then
    forge_key="$(read_secret_tty 'BUILT_IN_FORGE_API_KEY: ')"
  fi
  if [[ -n "$forge_url" && -z "$forge_key" ]]; then
    fail "BUILT_IN_FORGE_API_KEY é obrigatório quando BUILT_IN_FORGE_API_URL é informado."
  fi

  if [[ -z "$jwt_secret" ]]; then
    jwt_secret="$(openssl rand -hex 32)"
  fi

  umask 077
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=${APP_PORT}
DATABASE_URL=${database_url}
JWT_SECRET=${jwt_secret}
LOCAL_STORAGE_DIR=${local_storage_dir}
SPATIAL_DATA_DIR=${spatial_data_dir}
DEFAULT_SPATIAL_SOURCE_PATH=${spatial_source_path}
TERRITORIAL_CADASTRO_PATH=${territorial_cadastro_path}
TERRITORIAL_NUMERACAO_PATH=${territorial_numeracao_path}
TERRITORIAL_ZONEAMENTO_PATH=${territorial_zoneamento_path}
EOF

  if [[ -n "$forge_url" ]]; then
    printf 'BUILT_IN_FORGE_API_URL=%s\n' "$forge_url" >> "$ENV_FILE"
    printf 'BUILT_IN_FORGE_API_KEY=%s\n' "$forge_key" >> "$ENV_FILE"
  else
    log "AVISO: armazenamento de uploads não configurado; uploads e PDFs podem falhar."
  fi

  chmod 600 "$ENV_FILE"
  log "Configuração gravada em ${ENV_FILE} com permissão restrita"
}

prepare_persistent_directories() {
  log "Preparando diretórios persistentes de uploads e fontes territoriais"
  install -d -m 755 "$LOCAL_STORAGE_DIR" "$SPATIAL_DATA_DIR"

  if [[ -n "$SPATIAL_UPLOAD_DIR" ]]; then
    [[ -d "$SPATIAL_UPLOAD_DIR" ]] || fail "SPATIAL_UPLOAD_DIR não existe: $SPATIAL_UPLOAD_DIR"
    local uploaded=0
    local source_name source_path
    while IFS='|' read -r source_name source_path; do
      if [[ -s "$SPATIAL_UPLOAD_DIR/$source_name" ]]; then
        install -o root -g root -m 644 "$SPATIAL_UPLOAD_DIR/$source_name" "$source_path"
        uploaded=$((uploaded + 1))
        log "Fonte territorial instalada: $source_path"
      fi
    done <<EOF
GEOPACKAGE_22-10-25.gpkg|$DEFAULT_SPATIAL_SOURCE_PATH
Lotes-cadastro.xlsx|$TERRITORIAL_CADASTRO_PATH
Lotes-NumQgis.xlsx|$TERRITORIAL_NUMERACAO_PATH
LotesxZoneamento.xlsx|$TERRITORIAL_ZONEAMENTO_PATH
EOF
    rm -rf "$SPATIAL_UPLOAD_DIR"
    log "$uploaded arquivo(s) territorial(is) recebido(s) pelo Cloud Shell"
  fi
}

checkout_application() {
  log "Preparando o código da aplicação"
  mkdir -p "$(dirname "$APP_DIR")"

  if [[ -n "$SOURCE_ARCHIVE_FILE" ]]; then
    [[ -s "$SOURCE_ARCHIVE_FILE" ]] || fail "SOURCE_ARCHIVE_FILE não existe ou está vazio: $SOURCE_ARCHIVE_FILE"
    rm -rf "$APP_DIR"
    mkdir -p "$APP_DIR"
    tar -xzf "$SOURCE_ARCHIVE_FILE" --strip-components=1 -C "$APP_DIR"
    rm -f "$SOURCE_ARCHIVE_FILE"
    log "Código recebido do Cloud Shell instalado em $APP_DIR"
    return
  fi

  log "Baixando ou atualizando o repositório"
  if [[ -d "$APP_DIR/.git" ]]; then
    git -C "$APP_DIR" fetch --depth=1 origin "$BRANCH"
    git -C "$APP_DIR" checkout -q "$BRANCH"
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
    # Não remover arquivos não rastreados: a atualização deve ser reversível e não
    # deve apagar artefatos locais ou dados que eventualmente estejam no diretório.
  else
    rm -rf "$APP_DIR"
    git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
}

build_image() {
  log "Construindo a imagem de produção"
  "$RUNTIME" build --pull -t "$IMAGE" "$APP_DIR"
}

run_migrations() {
  log "Aplicando o esquema Drizzle no MySQL"
  "$RUNTIME" run --rm --env-file "$ENV_FILE" "$IMAGE" pnpm db:push
}

write_systemd_unit() {
  local runtime_path="$RUNTIME"
  local unit_path="/etc/systemd/system/${SERVICE_NAME}.service"

  cat > "$unit_path" <<EOF
[Unit]
Description=Urban Docs Generator
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=10
ExecStartPre=-${runtime_path} rm -f ${CONTAINER_NAME}
ExecStart=${runtime_path} run --name ${CONTAINER_NAME} --env-file ${ENV_FILE} -v ${LOCAL_STORAGE_DIR}:${LOCAL_STORAGE_DIR}:Z -v $(dirname "${SPATIAL_DATA_DIR}"):$(dirname "${SPATIAL_DATA_DIR}"):ro,Z -p ${APP_PORT}:${APP_PORT} ${IMAGE}
ExecStop=${runtime_path} stop -t 15 ${CONTAINER_NAME}
ExecStopPost=-${runtime_path} rm -f ${CONTAINER_NAME}

[Install]
WantedBy=multi-user.target
EOF

  chmod 644 "$unit_path"
  systemctl daemon-reload
  systemctl enable --now "${SERVICE_NAME}.service"
}

configure_firewall() {
  log "Abrindo somente a porta HTTP inicial ${APP_PORT}"
  firewall-cmd --permanent --add-port="${APP_PORT}/tcp"
  firewall-cmd --reload
}

health_check() {
  log "Verificando o serviço"
  sleep 5
  systemctl --no-pager --full status "${SERVICE_NAME}.service" || true
  if curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:${APP_PORT}/" >/dev/null; then
    log "Aplicação respondeu localmente em http://127.0.0.1:${APP_PORT}/"
  else
    log "AVISO: a aplicação ainda não respondeu. Consulte: journalctl -u ${SERVICE_NAME} -n 100 --no-pager"
  fi
}

main() {
  log "Iniciando deploy do Urban Docs Generator"
  install_packages
  select_runtime
  read_configuration
  checkout_application
  prepare_persistent_directories
  build_image
  run_migrations
  write_systemd_unit
  configure_firewall
  health_check

  cat <<EOF

Deploy concluído.

Aplicação: http://IP_PUBLICO_DA_VM:${APP_PORT}/
Serviço: systemctl status ${SERVICE_NAME}
Logs: journalctl -u ${SERVICE_NAME} -f
Configuração: ${ENV_FILE}

Para atualizar depois:
  sudo bash ${APP_DIR}/deploy/oracle/provision-and-deploy.sh

Não abra a porta 3306 publicamente. O banco deve continuar acessível somente pela rede privada da VCN.
EOF
}

main "$@"
