#!/usr/bin/env bash
set -euo pipefail

# Codex cloud maintenance script for this repository.
# Paste or call this from the Codex environment "maintenance script" field.
# Codex runs this when it resumes a cached container on a task branch. Keep it
# faster than setup: refresh dependencies from the checked-out branch and run a
# cheap typecheck to catch cache drift.

cd "${CODEX_WORKSPACE:-$PWD}"

if [[ -f .nvmrc ]] && command -v nvm >/dev/null 2>&1; then
  nvm use || nvm install
fi

corepack enable
corepack prepare pnpm@10.34.1 --activate
if [[ -f pnpm-lock.yaml ]]; then
  pnpm install --frozen-lockfile
else
  pnpm install
fi

pnpm typecheck
