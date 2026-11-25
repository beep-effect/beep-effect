---
title: "P1 bootstrap identities use generated literals without importing the registry"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p1c-bindings"
reversal: "Move the runner above identity in the dependency graph and replace the generated literals with registry lookups."
---

The test runner is a bootstrap dependency and cannot import @beep/identity. The registry generator projects the vitest shard into the runner as literals; parity tests verify the annotations against the registry. Rejected: a runtime dependency from the runner to identity, which would reverse the bootstrap dependency boundary.
