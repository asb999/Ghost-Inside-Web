#!/usr/bin/env bash
#!/usr/bin/env bash
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
