# P1A Vocab / CURIE / PN_LOCAL Evidence

## Files Touched

- `packages/foundation/modeling/identity/src/Vocab.ts`
- `packages/foundation/modeling/identity/src/Curie.ts`
- `packages/foundation/modeling/identity/src/PnLocal.ts`
- `packages/foundation/modeling/identity/src/index.ts`
- `packages/foundation/modeling/identity/test/Vocab.test.ts`
- `packages/foundation/modeling/identity/test/Curie.test.ts`
- `packages/foundation/modeling/identity/test/PnLocal.test.ts`
- `packages/foundation/modeling/rdf/src/Vocab/Dcterms.ts`
- `packages/foundation/modeling/rdf/src/Vocab/Owl.ts`
- `packages/foundation/modeling/rdf/src/Vocab/Rdf.ts`
- `packages/foundation/modeling/rdf/src/Vocab/Rdfs.ts`
- `packages/foundation/modeling/rdf/src/Vocab/Skos.ts`
- `packages/foundation/modeling/rdf/test/VocabDrift.test.ts`
- `goals/identity-iri-core/history/p1a-vocab-codecs-evidence.md`

## Gate Summary

- `bunx turbo run check --filter @beep/identity --filter @beep/rdf`: green.
  - Turbo summary: 6 successful, 6 total.
- `bunx turbo run docgen --filter @beep/identity --filter @beep/rdf --concurrency=1`: green.
  - `@beep/identity`: 6 modules, 144 examples, docs generation succeeded.
  - `@beep/rdf`: 17 modules, 196 examples, docs generation succeeded.
  - Turbo summary: 6 successful, 6 total.
- `bunx biome check <touched files>`: green.
  - 13 files checked, no fixes applied.
- `bunx vitest run` in `packages/foundation/modeling/identity`: green.
  - 5 test files, 47 tests passed.
- `bunx vitest run test/VocabDrift.test.ts` in `packages/foundation/modeling/rdf`: green.
  - 1 test file, 1 test passed.
- `bunx vitest run` in `packages/foundation/modeling/rdf`: not used as proof.
  - The new `test/VocabDrift.test.ts` passed, but the existing `test/Rdf.test.ts` failed on an unrelated `SemanticSchemaMetadata` error-message assertion: expected text containing `Expected SemanticSchemaMetadataKind`, received text containing `Expected @beep/rdf/semantic-schema-metadata/SemanticSchemaMetadataKind`.

## Blocked / External Gate Notes

- `bunx turbo run test --filter @beep/identity --filter @beep/rdf`: blocked by the package scripts' Bun-backed Vitest worker startup.
  - Both package scripts run `bunx --bun vitest run`.
  - Vitest reported `Failed to start forks worker` and `Timeout waiting for worker to respond`.
  - It failed before loading tests: `Test Files no tests`, `transform 0ms`, `import 0ms`.
  - The same worker timeout reproduced on a single identity test file with `bunx --bun vitest run test/Vocab.test.ts --pool=forks --maxWorkers=1`.
  - The same identity tests pass under the Node-backed runner (`bunx vitest run`), and the new RDF drift test passes under the Node-backed runner.
- `bun run docgen:local`: blocked by unrelated repo-wide docgen metadata debt after selecting the touched packages.
  - It reported unrelated failures in `packages/drivers/box`, `packages/drivers/ecfr`, `packages/drivers/govinfo`, `packages/foundation/capability/api-transport`, UI/editor packages, `packages/law-practice/domain`, and `packages/tooling/policy-pack/repo-configs`.
  - The package-scoped docgen fallback for `@beep/identity` and `@beep/rdf` is green.

## Deviations From Donor Prototype

- `CoreVocab` uses the full `03-vocabularies.md` registry for `rdf`, `rdfs`, `skos`, `owl`, and `dcterms`; the scratchpad donor carried only the smaller proof subset.
- RDF vocabulary modules now expose static term-list constants, plus a new `Dcterms.ts`, so the drift test can compare namespace and term inventories without making `@beep/identity` depend on `@beep/rdf`.
- No composer behavior was ported in part A, and `packages/foundation/modeling/identity/src/Id.ts` plus `src/packages.ts` were not edited.
