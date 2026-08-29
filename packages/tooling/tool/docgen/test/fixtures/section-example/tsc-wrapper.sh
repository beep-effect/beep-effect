#!/usr/bin/env bash
set -euo pipefail

touch .tmp-docgen/tsc-ran
find .tmp-docgen/examples -type f -print > .tmp-docgen/example-files
exec ../../../../../../../node_modules/.bin/tsc "$@"
