#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
clap_node="${NODE_BIN:-$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node}"
if [ ! -x "$clap_node" ]; then clap_node="$(command -v node)"; fi
if [ ! -d node_modules/ws ]; then echo '请先运行 npm ci 或 pnpm install --frozen-lockfile'; exit 1; fi
exec "$clap_node" --env-file-if-exists=.env server/index.js
