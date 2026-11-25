---
title: "P8 SPEC amendment: the L0 exit's 'path-derived IRIs are gone' reads 'no published IRI is path-derived'"
date: 2026-11-25
lane: "goals/text-knowledge-stack-rebuild-p7-retirement"
reversal: "Restore the SPEC wording and delete the composer IRI surface from Id.ts by a decision that accepts one CiRunners handler redeploy, as decision 2026-11-20-p1-composer-stays-registry-free names"
---

SPEC.md:398-404 (L0) says path-derived IRIs are gone. Decision 2026-11-20-p1-composer-stays-registry-free kept the composer deriving its IRI, because `@beep/identity` is bundled into the CI runner Lambda handlers and removing `.iri` from `Id.ts` changes every handler code hash. It deferred the deletion and did not amend the SPEC; the closeout acceptance check found the contradiction. What L0 delivers is the property the clause protects: every published IRI comes from a registry binding. The kept read sites read `@beep/identity/Registry`, `IdentityEntry.fromComposer` is deleted so an entry is built only from a binding, the test runner and research library read the registry, and `TermStability.test.ts` (L0-3) proves a module rename changes no published IRI. The clause therefore reads: no published IRI is path-derived; the composer's derived IRI stays as an internal, unpublished surface until a decision accepts the handler redeploy. The other L0 subclauses are unchanged.
