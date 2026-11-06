---
title: "Align only producer setup with the inspected Python bytecode policy"
date: 2026-11-06
lane: "codex/cache-producer-install-parity-20261106"
reversal: "Remove the producer setup step environment and its scope assertions. Retain historical guarded observations and require fresh independent source/profile approval."
---

Two real source-only observations at df3ccd1b77aba565a72abd63c910ef3edde23929 agree across all raw dependency and source hashes under the inspection import-bytecode guard. Producer execution uses the same setup action without that policy, so the guarded inspection pair cannot prove equivalent producer installation.

Set PYTHONDONTWRITEBYTECODE=1 only on Setup pinned toolchain without trial capabilities. Preserve the existing job environment, remote-cache/app-secret disablement, selection/approval gates, permissions, timeouts and independently scoped issuer/trial/publication steps. Keep the flag absent at global and producer-job scope. Extend the existing hosted CI security assertion to require the exact setup environment and make it the only producer step carrying the flag.

This prepares matching install policy; it does not prove actual producer equality or authorize execution. Obtain hosted source/scope proof, primary acceptance, fresh current source inspection and independent source/tool/profile approval before the protected trial. No secret, selection variable, signing setting, storage grant, deployment or whole-goal acceptance changes. No manual local verify, publish, tests, check, docgen or package-quality suite; hosted CI is authoritative.
