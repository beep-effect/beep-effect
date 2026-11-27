---
title: Prove executable-relative resolution with a neutral host environment
date: 2026-11-26
reversal: Inherit bundle overrides, NODE_PATH and the extension working directory in smoke runs.
governs:
  - src/smoke.ts#compiledHostEnv
  - src/bin.ts#check
  - src/smoke.ts#runCompiledHost
enforcedBy: []
---

Run every compiled smoke leg from a neutral directory after dropping PRACTICE_KG_BUNDLE_DIR, PRACTICE_KG_CORPUS_ROOT and ambient NODE_PATH. Each leg sets BUNDLE_DIR for the staged bundle; only the manifest leg supplies NODE_PATH explicitly.
Reason: higher-precedence ambient overrides can open another bundle and falsely certify a staged artifact. Desktop does not launch inside the extension directory.
Rejected: inherited environment or cwd-adjacent resolution. Install the DuckDB resolver before other host imports so the sidecar resolves beside the executable.
