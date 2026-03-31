#!/usr/bin/env bash
# Generate a unique task ID: TASK-{hex_epoch}-{4_hex_random}
# Conflict-free across concurrent contributors.
# Sortable by creation time (hex epoch sorts lexicographically).
set -euo pipefail
printf 'TASK-%x-%s\n' "$(date +%s)" "$(head -c 2 /dev/urandom | xxd -p)"
