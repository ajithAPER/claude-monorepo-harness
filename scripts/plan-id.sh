#!/usr/bin/env bash
# Generate a unique plan ID: PLAN-{hex_epoch}-{4_hex_random}
# Same format as task IDs but with PLAN- prefix.
set -euo pipefail
printf 'PLAN-%x-%s\n' "$(date +%s)" "$(head -c 2 /dev/urandom | xxd -p)"
