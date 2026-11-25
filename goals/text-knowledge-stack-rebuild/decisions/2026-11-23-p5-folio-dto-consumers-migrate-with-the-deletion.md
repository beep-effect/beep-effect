---
title: "P5: the FOLIO DTOs are deleted with a test-owned fold fixture, a scratchpad-local http URL refinement and identity test paths rewritten to a live module"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Keep HttpUrl in a foundation package by a decision file naming a production consumer"
---

Map questions T6, S13 and S16, and census row 244. `Ontology.models.ts` and `Ontology.models.test.ts` are deleted, with the barrel's `Ontology` namespace export (`ontology/src/index.ts:53`) and the 14 schema-catalog rows.

`Fold.test.ts`'s "FOLIO-derived module" case (`:947-976`) used `OWLClass` only as a convenient class to fold. It is rewritten over a schema the test declares, bound to a declared term of a test namespace the fold tests already use, so its "byte-identical through all projections" claim becomes a `toDataset` determinism assertion.

The two tracked `@beep/scratchpad` files that import `HttpUrl` (`scratchpad/effect-ontology/Domain/Schema/LinkIngestion.ts:8`, `test/Domain/Schema/PublicSchemas.test.ts:1`) switch to a refinement declared in `LinkIngestion.ts`: `URLStr` from `@beep/schema/URL` (`schema/src/URL.ts:52`), restricted by a filter to the http and https schemes, which the test already imports through the file's re-export (`:21`). `@beep/schema` has `HttpsUrl` but no http-or-https schema, and a scratchpad consumer does not justify widening the shared package.

The identity tests that build the composer path `$OntologyId.create("Ontology.models")` (`identity/test/IriBinding.test.ts:53-71,97-120`, `Identity.test.ts:215,253-258`, `shape-stable.test.ts:416-442`) and the `Ontology.models/HttpUrl` strings (`identity/test/PnLocal.test.ts:57,74,142-146`, `identity/src/PnLocal.ts:259-474`) import nothing. They would stay green, but they would name a deleted module. The paths are rewritten to `Classification.models/ClassificationPin`, a live module and symbol with the same lexical shape (a dot and a slash), in the deletion commit. `identity/src/Id.ts:403,1422` is left untouched (amended after review): `Id.ts` is one of the five identity sources inside the CiRunners handler bundles (`packages/tooling/infra/ci-runners/test/HandlerBundles.test.ts:21-31` on `origin/main`), whose source maps embed module text, so a JSDoc edit would redeploy every handler; its strings are lexical examples of slug shape that the deletion does not make wrong. The FOLIO vendor-alignment rows and their `SemanticFoundation.test.ts` cases are a separate facet and stay.
