#!/usr/bin/env bash
set -euo pipefail

# Codex cloud setup script for this repository.
# Paste or call this from the Codex environment "setup script" field.
# It installs the pinned Node package manager and project dependencies, then
# runs a lightweight compile check so the cached image starts from a known-good
# dependency state.

cd "${CODEX_WORKSPACE:-$PWD}"

if [[ -f .nvmrc ]] && command -v nvm >/dev/null 2>&1; then
  nvm install
  nvm use
fi

corepack enable
corepack prepare pnpm@10.34.1 --activate
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

pnpm typecheck
