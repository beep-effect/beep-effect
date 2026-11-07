---
title: "Port the #2850 cache-pilot scripts into beep ci commands in PR 2"
date: 2026-11-07
lane: "goals/scripts-to-beep-cli-p2"
reversal: "Restore the four scripts/ci-cache-* files and their heavy.yml calls from #2850"
---

#2850 (e9187a295fe) added `ci-cache-native-sandbox.sh`, `ci-cache-pilot-cleanup.sh`, `ci-cache-pilot-inputs.sh` and `ci-cache-local-summary.py` (with a Python test) under scripts/ after PR 1 branched. SPEC acceptance requires scripts/ to hold only `cloud/bootstrap.sh` and the tracked-shell law rejects them, so PR 2 ports each to a `beep ci` subcommand with identical behaviour, moves the Python test to vitest, and switches heavy.yml to `bun --no-env-file run beep ci <command>`. Every call runs after `setup-monorepo-ci`, and the pinned CI binary predates the new commands, so they run from the checkout; `cache-sandbox` and `cache-pilot-cleanup` are also registered in the bootstrap set, so a later pin bump can move them onto the binary. Their workflow semantics stay owned by the cache-pilot lane.
