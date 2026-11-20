---
title: "P1: the cross-check of identity version pattern and literal domains against @beep/schema runs in @beep/schema tests (design D12)"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Add a schema-free copy of SemanticVersion to the identity tests by a decision file and move the cross-check there."
---

P1 ruling 14, the same call as D12 of the registry-first design, and an amendment of decision 2026-11-19-p0-l0-split-by-dependency. @beep/identity keeps a local version pattern and S.Literals literal domains (the standing exception for the package @beep/schema depends on). The test that cross-checks them against @beep/schema SemanticVersion and LiteralKit lives in packages/foundation/modeling/schema/test/IdentityRegistryParity.test.ts, because a @beep/schema dev dependency in identity tests would close the workspace cycle identity to schema to identity, while schema to identity is the legal direction.
