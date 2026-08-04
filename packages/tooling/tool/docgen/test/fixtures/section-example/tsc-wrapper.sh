#!/usr/bin/env bash
set -euo pipefail

touch .tmp-docgen/tsc-ran
exec ../../../../../../../node_modules/.bin/tsc "$@"
