#!/usr/bin/env bash
# ask_astra.sh — 项目级检查入口（astra 循环第 4 步：机器自检）
set -u

case "${1:-}" in
  check)
    script_root="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)" || exit 1
    cd "$script_root" || exit 1
    exec bash .astra/harness/check.sh
    ;;
  *)
    printf '%s\n' 'Usage: bash ask_astra.sh check' >&2
    exit 2
    ;;
esac
