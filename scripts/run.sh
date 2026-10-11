#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
bobo_node="${NODE_BIN:-}"
if [ -z "$bobo_node" ]; then
  bobo_node="$(command -v node || true)"
fi
if [ -z "$bobo_node" ]; then
  bobo_node="/Users/mio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [ ! -x "$bobo_node" ]; then
  echo "需要 Node.js 22 或更高版本。"
  exit 1
fi
if [ ! -d node_modules/ws ]; then
  echo "请先运行 pnpm install --frozen-lockfile（或 npm install）。"
  exit 1
fi
exec "$bobo_node" --env-file-if-exists=.env server/index.js
