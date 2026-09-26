#!/usr/bin/env bash
# Publica o CRM (pasta crm/) em crm.assessoriatracto.com.br (repo assessoriatracto/crm, GitHub Pages).
# Roda sozinho no GitHub Actions a cada push (.github/workflows/publicar-crm.yml), com a chave de deploy
# CRM_DEPLOY_KEY. Pra rodar à mão: tools/publicar-crm.sh (usa a conta "assessoriatracto" do gh).
# Os módulos compartilhados (banco, formulários, config, fontes) vêm de assessoriatracto.com.br.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="https://assessoriatracto.com.br"
DOMAIN="crm.assessoriatracto.com.br"
REPO="https://github.com/assessoriatracto/crm.git"
GH_USER="${GH_USER:-assessoriatracto}"
DEST="$(mktemp -d)/crm"

if [ -n "${CRM_DEPLOY_KEY:-}" ]; then
  # GitHub Actions: chave de deploy com escrita só no repo do CRM
  KEYFILE="$(mktemp)"; printf '%s\n' "$CRM_DEPLOY_KEY" > "$KEYFILE"; chmod 600 "$KEYFILE"
  export GIT_SSH_COMMAND="ssh -i $KEYFILE -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  REPO="git@github.com:assessoriatracto/crm.git"
  cred() { git "$@"; }
else
  TOKEN="$(gh auth token --user "$GH_USER")"
  cred() { git -c credential.helper= -c "credential.helper=!f() { echo username=x-access-token; echo password=$TOKEN; }; f" "$@"; }
fi

cred clone --quiet --depth 1 "$REPO" "$DEST" 2>/dev/null || { mkdir -p "$DEST"; git -C "$DEST" init --quiet -b main; git -C "$DEST" remote add origin "$REPO"; }
find "$DEST" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

cp "$ROOT"/crm/index.html "$ROOT"/crm/crm.css "$ROOT"/crm/*.js "$DEST"/
# caminhos ../assets/ viram o domínio principal (CSS, fontes, logo, config e o import map @shared/)
VER="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || date +%s)"
perl -pi -e "s#\.\./assets/#$SITE/assets/#g; s#\?v=dev#?v=$VER#g" "$DEST/index.html"
# versão também nos módulos do próprio CRM (evita misturar arquivos novos e antigos em cache)
perl -pi -e "s#\.js\?v=\d+#.js?v=$VER#g; s#crm\.css\?v=\d+#crm.css?v=$VER#g" "$DEST"/*.js "$DEST/index.html"
echo "$DOMAIN" > "$DEST/CNAME"
touch "$DEST/.nojekyll"
printf 'User-agent: *\nDisallow: /\n' > "$DEST/robots.txt"
cat > "$DEST/README.md" <<'MD'
# CRM Tracto (gerado automaticamente)

Este repositório é só a publicação de crm.assessoriatracto.com.br.
O código fica em **assessoriatracto/tracto**, pasta `crm/`, e é publicado aqui pelo GitHub Actions a cada push.
Não edite nada neste repositório: qualquer mudança é sobrescrita na próxima publicação.
MD

cd "$DEST"
git add -A
if git diff --cached --quiet; then echo "CRM já está atualizado."; exit 0; fi
git -c user.name="Tracto" -c user.email="assessoriatracto@users.noreply.github.com" \
  commit --quiet -m "Publica CRM ($(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local)) a partir de assessoriatracto/tracto"
cred push --quiet origin HEAD:main
echo "Publicado: https://$DOMAIN"
