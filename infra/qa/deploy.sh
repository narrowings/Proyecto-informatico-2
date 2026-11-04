#!/usr/bin/env bash
# Despliegue de QA por "pull": el servidor revisa main cada pocos minutos y, si hay un commit nuevo con
# el CI en verde, reconstruye y levanta el ambiente. No necesita puertos abiertos, runner ni secretos en GitHub.
# Lo ejecuta el timer de systemd (infra/qa/systemd). Para forzar un despliegue: FORCE=1 bash deploy.sh
set -euo pipefail

# Todo va dentro de main: bash lee la función completa antes de ejecutarla, así que el `git checkout`
# que actualiza este mismo archivo no afecta la ejecución en curso.
main() {
  QA_HOME="${QA_HOME:-/opt/red-qa}"
  REPO_DIR="${REPO_DIR:-$QA_HOME/repo}"
  ENV_FILE="${ENV_FILE:-$QA_HOME/qa.env}"
  STATE_FILE="$QA_HOME/ultimo-intento"
  BRANCH="${BRANCH:-main}"
  GITHUB_REPO="${GITHUB_REPO:-narrowings/Proyecto-informatico-2}"
  COMPOSE=(docker compose -p red-qa -f infra/qa/docker-compose.qa.yml --env-file "$ENV_FILE")

  log() { echo "$(date '+%F %T') $*"; }

  # Un solo despliegue a la vez.
  exec 9>"$QA_HOME/deploy.lock"
  flock -n 9 || { log "Ya hay un despliegue en curso"; exit 0; }

  set -a
  # shellcheck source=/dev/null
  . "$ENV_FILE"
  set +a

  cd "$REPO_DIR"
  git fetch --quiet origin "$BRANCH"
  TARGET="$(git rev-parse "origin/$BRANCH")"
  LAST="$(cat "$STATE_FILE" 2>/dev/null || true)"

  if [ "${FORCE:-0}" != "1" ] && [ "$TARGET" = "$LAST" ]; then
    exit 0
  fi

  # Compuerta: solo se despliega si todos los checks del commit terminaron en verde.
  if [ "${REQUIRE_CI:-true}" = "true" ] && [ "${FORCE:-0}" != "1" ]; then
    CI_STATE="$(curl -fsS -H 'Accept: application/vnd.github+json' \
      "https://api.github.com/repos/$GITHUB_REPO/commits/$TARGET/check-runs?per_page=100" |
      python3 -c '
import json, sys
runs = json.load(sys.stdin).get("check_runs", [])
if not runs or any(r["status"] != "completed" for r in runs):
    print("pending")
elif all(r["conclusion"] in ("success", "skipped", "neutral") for r in runs):
    print("success")
else:
    print("failure")
')" || CI_STATE="pending"

    case "$CI_STATE" in
      pending)
        log "CI de ${TARGET:0:7} sin terminar; se reintenta en el próximo ciclo"
        exit 0
        ;;
      failure)
        log "CI de ${TARGET:0:7} en rojo; no se despliega"
        echo "$TARGET" >"$STATE_FILE"
        exit 0
        ;;
    esac
  fi

  log "Desplegando ${TARGET:0:7} ($(git log -1 --format=%s "$TARGET"))"
  echo "$TARGET" >"$STATE_FILE"
  # Este clon es solo para QA: se descarta cualquier cambio local.
  git checkout --quiet --detach "$TARGET"

  "${COMPOSE[@]}" up -d --build --remove-orphans

  # Prueba de humo: la API responde y tiene base de datos.
  for _ in $(seq 1 36); do
    if curl -fsS "http://127.0.0.1:${API_PORT:-3101}/v1/health" >/dev/null 2>&1; then
      log "QA arriba con ${TARGET:0:7}"
      docker image prune -f --filter "label=red.project=red-oportunidades" >/dev/null
      exit 0
    fi
    sleep 5
  done

  log "La API no respondió después del despliegue. Últimos logs:"
  "${COMPOSE[@]}" logs --tail 50 api
  exit 1
}

main "$@"
