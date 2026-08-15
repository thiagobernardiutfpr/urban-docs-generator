#!/usr/bin/env bash
set -Eeuo pipefail

# Provisiona uma VM Oracle Linux e publica o Urban Docs Generator.
# As credenciais são lidas interativamente pelo /dev/tty e gravadas somente
# em /etc/urban-docs/urban-docs.env com permissão 600.

REPO_URL="${REPO_URL:-https://github.com/thiagobernardiutfpr/urban-docs-generator.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/urban-docs-generator}"
CONFIG_DIR="${CONFIG_DIR:-/etc/urban-docs}"
ENV_FILE="${CONFIG_DIR}/urban-docs.env"
IMAGE="${IMAGE:-urban-docs-generator:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-urban-docs-generator}"
SERVICE_NAME="${SERVICE_NAME:-urban-docs-generator}"
APP_PORT="${APP_PORT:-3000}"

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

  if [[ -z "$database_url" ]]; then
    database_url="$(read_tty 'DATABASE_URL (mysql://urban_docs_app:SENHA@10.0.1.190:3306/urban_docs): ')"
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

checkout_application() {
  log "Baixando ou atualizando o repositório"
  mkdir -p "$(dirname "$APP_DIR")"

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
ExecStart=${runtime_path} run --name ${CONTAINER_NAME} --env-file ${ENV_FILE} -p ${APP_PORT}:${APP_PORT} ${IMAGE}
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
