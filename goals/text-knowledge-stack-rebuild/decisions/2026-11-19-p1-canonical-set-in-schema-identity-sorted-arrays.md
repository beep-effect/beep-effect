---
title: "P1: CanonicalHashSet lives in @beep/schema; @beep/identity uses strictly ascending sorted arrays (withdraws design D5)"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Move CanonicalHashSet into @beep/identity by a decision file, keeping @beep/identity effect-only, and swap the sorted arrays for it."
---

P1 ruling 8, withdrawing D5 of the registry-first design, which put CanonicalHashSet, CanonicalHashSetBy and sortedMembers in a new @beep/identity/CanonicalSet. CanonicalHashSet stays in @beep/schema, as decision 2026-11-19-p0-l0-split-by-dependency and the L0.digest.ts owner line say: a HashSet when decoded, a deduplicated array sorted by the encoded string when encoded (the set-codec amendment of decision 2026-11-19-p0-items4-6-9-annotation-document-shape). @beep/identity imports effect only, so its snapshot and registry collections (TermSnapshot terms, namespaces, bindings and deprecations; RegistryShard and RegistryTable members) are strictly ascending sorted arrays whose schema check rejects an out-of-order or duplicate member. That keeps the committed snapshot byte-deterministic without a HashSet: S.HashSet and S.HashMap encode in iteration order, so a TermSnapshot with S.HashSet fields (L0.identity.ts:111-117) would not be deterministic.
