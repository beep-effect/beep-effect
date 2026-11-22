---
title: "P1: the seven test-runner IRIs are re-minted from the registry with deprecation rows, and their code ids become @beep/test-runner (amends design D9)"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Restore the hand-written test-runner pins at their pre-P1 values and the @beep/test-utils code ids by a decision file; the P1 deprecation rows stay, since deprecations only grow."
---

P1 ruling 5, amending D9 of the registry-first design. The 7 test-runner pinned IRIs (Vitest.errors.ts:23,55,65,121,131,141,151) spell the module path test-utils/Vitest/<Name>. They are re-minted from the registry under a stable term name, vitest/<Name> in a vitest namespace, and each old value gets a deprecation row naming its replacement. Their code ids are corrected from @beep/test-utils/Vitest/<Name> to @beep/test-runner/Vitest/<Name>: @beep/test-utils is a different live package, so the old identifier claimed an owner it does not have. Kept from D9: @beep/test-runner cannot import @beep/identity, because all 14 identity test files import @beep/test-runner, so the registry generator writes a projection test-runner/src/internal/generated/RegistryTerms.ts from the shards that declare projection @beep/test-runner, with identifier, iri and curie per row as plain literals. The RetiredIriAuthorities.model.ts allowlist entry moves to that file with its reason updated; it is a rename and the count stays 1 (decision 2026-11-19-p1-s31-rows-move-with-the-file). Breaking: @beep/test-runner published identifiers and IRIs; no changeset is written.
