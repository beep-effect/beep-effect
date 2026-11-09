#!/usr/bin/env bash
# Retained entry point for an obsolete manual-runner experiment.
set -euo pipefail
cat >&2 <<'NOTICE'
This teardown command is retired and performs no AWS or GitHub mutations.
Its old tag selector also matched active AMI builders. Do not reuse it.

For an attended, exact-resource cleanup or a bounded controller burst, follow:
  docs/runbooks/aws-cost-operations.md
  docs/runbooks/ci-runner-reliability.md

Preserve active builders and controller workers. Restore a temporary cap from
its captured current baseline, never from this historical experiment's code.
NOTICE
exit 1
