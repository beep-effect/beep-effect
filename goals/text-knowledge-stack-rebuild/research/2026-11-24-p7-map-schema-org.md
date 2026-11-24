# P7 map: retiring the whole `@beep/schema-org` package

Measured at commit f30c183f20a (this lane's HEAD). P6 lane consulted at head f30c183f20a with an uncommitted tree (rows 4 onward in progress: `nlp-processing/src/Activity.ts`, `jsonc/src/ActivityRecord.ts` and their regenerated aliases); none of its staged or untracked paths names `@beep/schema-org`, and the P6 design and its three maps never mention the package, so nothing P6 lands changes this map.

Read-only measurement. No source was edited. Paths are repo-relative; `so/` abbreviates `packages/foundation/modeling/schema-org/`. The only command run beyond `rg`/`git` was `bun run beep delete-package @beep/schema-org --dry-run` (read-only: the handler returns before `executePlan` when `--dry-run` is set, `packages/tooling/tool/cli/src/commands/DeletePackage/DeletePackage.command.ts:881`); the tree stayed clean. This map writes no Effect code, so it relies on no Effect API. Census rows quoted from `research/consumer-census.md:206-226` were measured at P0 base f9982f3b5e6; every count below is re-measured on this head, and where they differ this map wins.

## 1. Verdict in one paragraph

`@beep/schema-org` has **zero consumers**: no TS import outside its own tree (`rg "from [\"']@beep/schema-org"` outside `so/` returns nothing), no `package.json` dependent (the only manifest naming it is its own, `so/package.json:2`), no scratchpad use. Every facet's replacement is therefore **deletion**, with no consumer migration. What the retirement PR has to touch is registration and fixture residue: 12 live `file-path` hits that `delete-package` refuses until they are edited or acknowledged, the generated surfaces `delete-package` rebuilds itself, one retired-name registry row, and the cache baselines that `beep cache baseline` drops. Stored schema.org bytes elsewhere in the repo do not depend on this package and keep reading unchanged.

## 2. Owner tree

`so/`: 15 src files, 7,896 lines (`src/internal/vocabulary.ts` 4,794 of them); 28 test files, 2,549 lines (the census's "25 test files", `consumer-census.md:209`, counted only the top level; `test/internal/` holds three more). Non-source: `AGENTS.md`, `KNOWLEDGE.md` (663 lines, verbatim upstream bundle), `README.md` (155), `LICENSE`, `docgen.json`, `package.json`, `tsconfig{,.check,.test}.json`, `vitest.config.ts`.

Dependencies (`so/package.json`): `@beep/identity`, `@beep/schema`, `effect`; dev `@beep/fc-runs`, `@effect/vitest`, `@types/node`, `bun-types`, `vitest`. `private: true`, so `delete-package` emits no deletion changeset ("private deletion emits no changeset", dry-run plan line `pending-changesets`).

## 3. Every export

Two entrypoints: `.` (`so/src/index.ts:38-52`) and `./conformance-entry` (`so/src/conformance-entry.ts:39-66`), plus the wildcard `./*` and `./internal/*` subpaths (`so/package.json` `exports`).

| Module | Export | Evidence | Kind | External consumers | Replacement |
| --- | --- | --- | --- | --- | --- |
| `Thing.ts` | `ThingFields` | `so/src/Thing.ts:45` | field record | 0 | delete |
| `CreativeWork.ts` | `CreativeWorkFields`, `CreativeWork` | `so/src/CreativeWork.ts:53`, `:134` | field record, `S.Opaque` | 0 | delete |
| `Person.ts` | `Person` | `so/src/Person.ts:44` | `S.Opaque` | 0 | delete |
| `Organization.ts` | `Organization` | `so/src/Organization.ts:43` | `S.Opaque` | 0 | delete |
| `SoftwareSourceCode.ts` | `SoftwareSourceCode` | `so/src/SoftwareSourceCode.ts:50` | `S.Opaque` | 0 | delete |
| `TechArticle.ts` | `TechArticleFields`, `TechArticle` | `so/src/TechArticle.ts:38`, `:89` | field record, `S.Opaque` | 0 | delete |
| `APIReference.ts` | `APIReference` | `so/src/APIReference.ts:42` | `S.Opaque` | 0 | delete |
| `NodeRef.ts` | `InvalidNodeIdError` | `so/src/NodeRef.ts:48` | `S.TaggedError` | 0 | delete |
| | `NodeId` / type | `:127`, `:148` | checked string | 0 | delete |
| | `NodeRef` (statics `to` `:220`, `toCheckedResult` `:245`, `toChecked` `:268` (`Effect.fn` span `NodeRef.toChecked`), `isValidId` `:287`) | `:188` | `S.Opaque` | 0 | delete |
| | `HasNodeId` (type) | `:302` | type | 0 | delete |
| | `isNodeRef` | `:324` | `S.is` guard | 0 | delete |
| `JsonLdDocument.ts` | `DuplicateNodeIdError`, `ConflictingTermError` | `so/src/JsonLdDocument.ts:55`, `:110` | `S.TaggedError` | 0 | delete |
| | `JsonLdNode` / type | `:164`, `:180` | union of the seven node classes | 0 | delete |
| | `referencesOf` | `:264` | function | 0 | delete |
| | `JsonLdDocument` (statics `buildResult` `:413`, `build` `:444` (span `JsonLdDocument.build`); getters `nodeIds` `:468`, `nodeIdsInOrder` `:491`, `danglingReferences` `:525`; `toJsonLd` `:576`, `toScriptBody` `:645`) | `:362` | `S.Class` | 0 | delete |
| `Conformance.ts` | `TermKind` / type | `so/src/Conformance.ts:48`, `:59` | `LiteralKit` | 0 | delete |
| | `UnknownTerm`, `PropertyNotOnType`, `DeprecatedType`, `DeprecatedProperty`, `DanglingReference` | `:89`, `:157`, `:218`, `:271`, `:337` | `S.TaggedClass` | 0 | delete |
| | `ConformanceIssue` / type | `:405`, `:420` | union | 0 | delete |
| | `NonConformantGraphError` | `:445` | `S.TaggedError` | 0 | delete |
| | `ConformanceOptions` (+ namespace `:560`) | `:519` | `S.Opaque` | 0 | delete |
| | `Conformance` (statics `check` `:707`, `validateResult` `:785`, `validate` `:842` (span `Conformance.validate`)) | `:670` | class | 0 | delete |
| `Vocabulary.ts` | `Vocabulary` (statics `version` `:162`, `hasType` `:179`, `hasProperty` `:198`, `ancestorsOf` `:230`, `ancestorsInOrder` `:249`, `propertiesOf` `:282`, `propertiesInOrder` `:303`, `isPropertyOn` `:340`, `supersededBy` `:379`) | `so/src/Vocabulary.ts:140` | class | 0 | delete |
| `internal/vocabulary.ts` | `VOCABULARY_VERSION` (`"30.0"`), `TYPE_NAMES`, `PROPERTY_NAMES`, `SUB_CLASS_OF`, `DOMAIN_PROPERTIES`, `SUPERSEDED_TYPES`, `SUPERSEDED_PROPERTIES`, `FOREIGN_PREFIXES`, `FOREIGN_PREFIX_SET`, `TYPE_INDEX`, `PROPERTY_INDEX`, `SUPERSEDED_TYPE_MAP`, `SUPERSEDED_PROPERTY_MAP` | `so/src/internal/vocabulary.ts:41`, `:62`, `:1019`, `:2567`, `:3529`, `:4484`, `:4520`, `:4617`, `:4714`, `:4734`, `:4754`, `:4774`, `:4794` | `@internal` tables | 0 | delete |
| `internal/rows.ts` | `decodeRow`, `decodePairs` | `so/src/internal/rows.ts:25`, `:54` | `@internal` functions | 0 | delete |
| `conformance-entry.ts` | re-exports of `Conformance.ts` values, `JsonLdDocument`, `Vocabulary`; type-only re-exports of the node classes, options and errors | `so/src/conformance-entry.ts:39-66` | barrel | 0 | delete |

Kept-package neighbours, checked present on this head. None is a migration target, since nothing migrates. They are listed so that the retirement's "semantic loss: none" stays honest and a later need has a place to start.

| Retired facet | Nearest kept symbol | Evidence | Gap the retirement accepts |
| --- | --- | --- | --- |
| Typed graph (`JsonLdDocument`, `JsonLdNode`) | `@beep/rdf/JsonLd` `JsonLdDocument`, `JsonLdNodeObject`, `JsonLdContext`, `JsonLdPropertyValue` | `packages/foundation/modeling/rdf/src/JsonLd.ts:452`, `:414`, `:150`, `:369` | no typed schema.org node union, no duplicate-`@id` or term-conflict errors |
| `NodeRef`, `NodeId` | `@beep/rdf/JsonLd` `JsonLdReferenceValue`, `JsonLdNodeIdentifier`; `@beep/identity/Iri` `IRIReference`, `IRI` | `rdf/src/JsonLd.ts:289`, `:238`; `packages/foundation/modeling/identity/src/Iri.ts:824`, `:946` | none for consumers (there are none) |
| `toScriptBody` (escapes `<`, `>`, `&`) | `@beep/html/Html.script` `ScriptDataBlockMimeType` (admits `application/ld+json`) | `packages/foundation/modeling/html/src/Html.script.ts:140`, `:132` | no shared escaped JSON-LD serializer; escaping parity remains unmeasured (`consumer-census.md:707`) |
| Node classes (`Person`, `Organization`, `CreativeWork`, `Thing`) as terms | registry shard `schema` (12 terms: `CreativeWork`, `Event`, `Organization`, `Person`, `SportsTeam`, `Thing`, `URL`, `birthDate`, `knows`, `memberOf`, `name`, `url`); `RegistryVocab` export; `@beep/rdf/Vocab/SchemaOrg` `SCHEMA_ORG_NAMESPACE`, `SCHEMA_ORG_TERMS`, `SCHEMA_NAME`, `SCHEMA_PERSON`, `SCHEMA_THING`, `canonicalizeSchemaOrgIri` | `packages/foundation/modeling/identity/registry/namespaces/schema.json:1-21`, `identity/src/internal/generated/Registry.data.ts:635-651`, `identity/src/Registry.ts:73`; `rdf/src/Vocab/SchemaOrg.ts:32`, `:49`, `:66`, `:83`, `:124`, `rdf/src/Vocab/generated/SchemaOrg.terms.ts:28`, `:44` | `SoftwareSourceCode`, `TechArticle`, `APIReference` are not registry terms; no one needs them |
| Vocabulary tables, `Conformance` (offline legality check, 933 classes, 1,521 properties) | the pinned schema.org 30.1 Turtle source in `@beep/rdf`'s namespace pins (`rdf/src/NamespacePin.ts:88`, `namespacePins` `:182`; row `rdf/src/Vocab/generated/namespace-pins.data.json:250-266`; writer `packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/PinnedVocabularies.ts:712-735`) | as listed | no offline domain/range check remains anywhere. Note the version skew: the package vendors v30.0 (`so/src/internal/vocabulary.ts:41`); the pin is v30.1 |
| P5 L3 modules (`@beep/ontology` `ConceptScheme`, `ClassificationRegistry`, `Mapping`, `Gufo`, `TaxonomyLoader`) | `packages/foundation/modeling/ontology/src/index.ts:13-83` | | no schema.org facet maps onto them. They model SKOS schemes, mappings and gUFO typing, not schema.org node shapes, so none of them stands in for a retired export |

The census rule-2 sums are 0 covered and 0 uncovered for every facet (`consumer-census.md:215-220`), and the disposition is already recorded in `decisions/2026-11-19-p0-census-dispositions.md` ("retire the whole package in P7; it has no importer and no package.json dependent, so no facet is rehomed"). Chapter 11 rule 2 therefore retires every facet; rule 3 (same PR, no alias) is satisfied trivially; rule 6 needs no row because no consumer's code changes meaning.

Candidate consumer that does **not** use the package: `apps/oip-web/src/content/OipSeo.ts:40-77` builds a schema.org graph by hand (`@type` values `Person`, `LegalService`, `AdministrativeArea`, `Country`, `WebSite`; four of these five are not among the package's node classes), serialized at `apps/oip-web/src/app/page.tsx:30` (`safeJsonScript`: `encodeUnknownJsonSync`, then `<` replaced by `<`) and rendered at `:132-139`. Escaping `<` alone already keeps `</script` and `<!--` out of the body. The `&` escape matters only for XHTML. So this site is not a defect the retirement leaves behind, and adopting the package there would add a consumer rather than migrate one.

## 4. Every reference outside the owner tree

Exhaustive `rg -n --hidden "@beep/schema-org|schema-org|SchemaOrg"` over the whole checkout except `node_modules`, `.git`, `.repos` and `so/`, classified. `SchemaOrg` hits inside `@beep/rdf` (`rdf/src/Vocab/SchemaOrg.ts`, `generated/SchemaOrg.terms.ts`, `rdf/test/SchemaOrg.test.ts`, `rdf/test/VocabDrift.test.ts:14,67`) and the sync target `packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/VocabTerms.ts:55` are the rdf `schema` namespace module, not this package; they stay and are not touched.

### 4.1 Live `file-path` hits that `delete-package` refuses (12, all must be cleared for the `rg -l "@beep/schema-org" packages apps` exit)

From the dry-run (`[delete-package] REFUSE [dependent/hard] 12 unacknowledged production/test/script/path dependent hit(s); only file-path and script hits can be acknowledged.`). All 12 are `file-path` kind, so each can be either edited away or acknowledged. Only editing clears the PLAN exit rg, though.

| # | File:line | What it is | Action |
| --- | --- | --- | --- |
| 1 | `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts:619` | member of partition `unit-a` (`:593`, `weightSeconds: 594`) | delete the entry; see S4 on the weight |
| 2 | `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts:452` | `COVERAGE_TASK_WEIGHT_SECONDS` row `"@beep/schema-org": 3` (map at `:295`) | delete the row |
| 3-7 | `packages/tooling/tool/cli/test/delete-package.test.ts:1297`, `:1300`, `:1307`, `:1310`, `:1354` | changeset-pruning fixtures that need a sibling whose name *extends* `@beep/schema` | rename the sibling to a fictional name that still extends `@beep/schema` (S2) |
| 8 | `packages/tooling/tool/cli/test/fixtures/dependency-review/manifest-inventory.json:698` | dated GitHub dependency-graph capture of 2026-10-21 ("Rows are trimmed, never edited", `test/fixtures/dependency-review/README.md:17-25`) | keep as history and acknowledge it, or trim the row and adjust the count in `test/ci-dependency-review.test.ts:337-345` (S3). It does not affect the exit rg (the path needle, not `@beep/schema-org`) |
| 9-11 | `packages/tooling/library/repo-cli-kit/src/WholeToken.ts:9`, `:54`, `:64` | JSDoc prose and an example that use `@beep/schema-org` as the textbook "near-miss token" | rewrite to the same fictional sibling as rows 3-7 (S2); the docgen example output stays `false` |
| 12 | `turbo.json:410` | `//#lint:policy-fingerprint` inputs (`:210`, `:213`) list `so/package.json` | remove the line (mirrored by `standards/policy-tools.fingerprint.json:655`, regenerated) |

### 4.2 Registrations `delete-package` removes or rebuilds itself (dry-run inverse plan)

| Surface (plan id) | Current residue |
| --- | --- |
| `owned-tree` | `so/` recursively, including ignored artifacts |
| `workspace-literal` | none: root `package.json:472` uses the covering glob `packages/foundation/modeling/*`, which is preserved |
| `identity-segment` | `packages/foundation/modeling/identity/src/packages.ts:220` (slug `"schema-org"`), `:3209-3224` (`$SchemaOrgId` and JSDoc); no shape row (`identity/test/shape-stable.test.ts` has none) |
| `tsconfig-sync` | `tsconfig.json:2059-2065` (3 aliases: `.`, `./*`, `./internal/*`), `tsconfig.packages.json:441-443`; `syncpack.config.ts` names nothing. Also `vitest.aliases.generated.json:1906-1912` (3 aliases) |
| `lockfile` | `bun.lock:3275-3276`, `:5733` |
| `fallow-boundaries` | `standards/fallow.boundaries.generated.jsonc:1077-1079` (zone), `:5583-5595` (rule); `fallow.boundaries.provenance.jsonc` has none |
| `coverage-baseline` | `standards/coverage.regression-baseline.jsonc:53938-54132` (package block, 15 file rows at 100%) |
| `fallow-health-baseline`, `fallow-dead-code-baseline`, `test-typecheck-baseline` | no rows for the package today |
| `schema-first-inventory` | `standards/schema-first.inventory.jsonc:1048-1057` (one exception: `Person.email`, `SFV4-precision-audit`) |
| `schema-catalog` | `standards/schema-catalog/@beep/schema-org.generated.jsonc` (22 rows, 21 with an identity) |
| `instrumentation-catalog` | `standards/instrumentation-catalog/@beep/schema-org.generated.jsonc` (3 spans: `Conformance.validate`, `JsonLdDocument.build`, `NodeRef.toChecked`) |
| `pending-changesets` | none: `.changeset/` holds only `config.json` and `README.md` |
| `runtime-artifacts` | 3 globs purged, mirrors invalidated |

### 4.3 Surfaces outside `delete-package`'s writers

| Surface | Evidence | Action |
| --- | --- | --- |
| Cache baselines | `standards/cache-baseline/@beep/schema-org.json` (16 lines name the package), `standards/cache-baseline/_root.json:2228` (root inputs list, `:2024`) | P2 precedent (`decisions/2026-11-22-p2-cache-request-names-the-retired-package-in-previous-only.md`): a `beep cache baseline` request lists only subjects still in the task graph (here `//`), keeps the retired file's digest in `previous`, and the command drops `@beep/schema-org.json` as a subject that left the graph. Never delete the file by hand, and never write the package name into the request's review reason, because that reason is copied into every stamped subject (`decisions/2026-11-22-p2-retired-name-leaves-live-standards.md`) |
| `_typos.toml` | `:14-17` (comment and `fnd` extend-word; `raison` is shared with `@beep/commands` and stays), `:118-120` (exclude of `so/src/internal/vocabulary.ts`) | delete the exclude and the `fnd` word with its comment clause. The only other `fnd` occurrence is under `explorations/**`, which `_typos.toml:164` already excludes |
| Retired-name registry | `standards/changesets.retired-packages.json` | add a `@beep/schema-org` row (P2 added `@beep/provenance` with a "recover the source from commit ..." rationale) |
| Root `docs/` (live) | none outside `docs/reports/` | none |
| `standards/architecture/*.md` (live chapters, glossary) | none; `16-knowledge-stack.md`, `GLOSSARY.md`, `docs/PROSE_TO_PROOF_VISION.md` and `nlp/THEORY.md` never name the package | none |
| `.github/`, `lefthook.yml`, `biome.jsonc`, `.oxlintrc*`, `.gitleaks*`, `syncpack.config.ts` | none | none |
| Upstream knowledge bundles that name the *upstream* `@effected/schema-org` | `packages/drivers/github-actions/KNOWLEDGE.md:1168`, `packages/tooling/library/repo-workspaces/KNOWLEDGE.md:2546-2631`, `packages/foundation/modeling/package-json/KNOWLEDGE.md:304` | keep: these are verbatim upstream text about another package and do not contain `@beep/schema-org` |

### 4.4 Historical records (kept; the doctor classifies them as history)

The dry-run lists 334 `historical-doc` hits and 7 `packet` hits. The `historical-doc` hits fall under `HISTORICAL_RECORD_GLOBS` (`packages/tooling/tool/cli/src/commands/DeletePackage/internal/RegistrationGeometry/RegistrationGeometry.plan.ts:50-64`): `goals/**` (for example `goals/turborepo-task-qualification/research/schema-org-406-baseline-*`, `goals/turborepo-quality-cache-adoption/research/*.json`, `goals/declaration-only-builds/research/*.tsv`), `explorations/**` record files, the 13 `docs/reports/*` cache requests and reviews, and `standards/architecture/DECISIONS.md:3214` (the 2026-11-19 scoped chapter-11 amendment names `@beep/schema-org` among its packages, and that dated entry stays as written). The 7 `packet` hits are this packet's own `PLAN.md:31`, `README.md:91`, `SPEC.md:82`, `:221`, `:471`, `:590` and `decisions/2026-11-19-p0-census-dispositions.md:8`. These produce the soft refusal `packet-claim`, which P2 passed with `--allow-stale-packets`.

## 5. Vendored data, licenses and attribution

| Material | Where | License / attribution | What retirement requires |
| --- | --- | --- | --- |
| schema.org v30.0 vocabulary, generated literals (933 classes, 1,521 properties, superseded maps, 72 foreign prefixes) | `so/src/internal/vocabulary.ts:1-21` header: "Vendored schema.org v30.0 vocabulary (CC-BY-SA-3.0), generated by `lib/scripts/generate-data.ts` from `lib/data/schemaorg-current-https.jsonld`" | CC-BY-SA-3.0, attributed only in that header comment | delete with the tree. The generator and the source JSON-LD were never ported (`rg generate-data` finds them only in the spdx package's notes), so no tool or data file outside `so/` is orphaned. No `VENDORED.md` exists for it (the repo's six `VENDORED.md` files are in markdown, sbom and yaml) |
| Upstream code: `@effected/schema-org` 0.7.0 at `af7566a9da2eff169cb74955efcc5ede1e5de9f8` | `so/LICENSE` (MIT, beep-effect notice plus the upstream author's notice), `so/README.md:116-128` (port notes and attribution), `so/KNOWLEDGE.md:1-12` (provenance) | MIT | deleting every copy ends the notice duty. `THIRD_PARTY_NOTICES.md` (1,002 lines) has no entry for either the upstream package or the schema.org data (`grep -ci effected` returns 0, and no schema.org section exists), so nothing there is removed |
| schema.org vocabulary as a pinned namespace (kept) | `rdf/src/Vocab/generated/namespace-pins.data.json:250-266` (`license: "CC-BY-SA-3.0"`, attribution sentence, v30.1, digests), `PinnedVocabularies.ts:712-735` | CC-BY-SA-3.0, attributed in the pin row | unaffected. After the retirement this is the repo's only schema.org-derived material: 12 curated term names. Whether it also needs a `THIRD_PARTY_NOTICES.md` section is S6 |

## 6. Stored formats and fixtures that mention schema.org IRIs

The package owns no table, column, served payload or golden fixture outside its own tree: no consumer means no stored row was ever produced from its encoders. Its own fixtures (`so/test/sources.ts`, 7 schema.org IRI lines across `so/src` and `so/test`) go with it. The stored-format law and chapter 11 rule 5 (`standards/architecture/11-evolution-and-deprecation.md:158-166`) therefore constrain nothing in this retirement.

The following bytes mention schema.org IRIs, do not depend on the package, and must keep reading unchanged (none is touched):

| Bytes | Evidence | Why they must keep reading |
| --- | --- | --- |
| Registry shard and term snapshot | `packages/foundation/modeling/identity/registry/namespaces/schema.json`, `identity/registry/term-snapshot.json:126-127` (14 schema.org IRI lines) | term-stability gate: a pinned term is never silently dropped |
| Generated projections of that shard | `identity/src/internal/generated/Registry.data.ts:635-651`, `rdf/src/Vocab/generated/vocab-terms.data.json:320-321`, `SchemaOrg.terms.ts:28,44` | regenerated from the shard, not from this package |
| Namespace pin | `rdf/src/Vocab/generated/namespace-pins.data.json:250-266` | L3-4 pinned-edition immutability |
| Served JSON-LD | `apps/oip-web/src/content/OipSeo.ts:41` (`"@context": "https://schema.org"`) | served payload, rule 5 |
| Test fixtures | `packages/ontology/server/test/fixtures/base-prefix/round-trip.ttl:2`; `packages/drivers/rdf-canonize/test/CanonicalizationIntegration.test.ts:25,28,86` and `CanonicalizationSecurity.test.ts`; `packages/foundation/modeling/identity/test/RegistryData.test.ts:46-47`, `identity/test/Iri.test.ts`; `rdf/test/Rdf.test.ts`, `rdf/test/SchemaOrg.test.ts`; `ontology/test/Fold.test.ts`; `semantic-web/test/ServicesAndSurface.test.ts`; `epistemic/server/test/BoundedShaclValidator.test.ts` | independent fixtures |
| Source constants | `ontology/src/Fold.models.ts:37,393`; `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts:110,119`; `rdf/src/JsonLd.ts:99-139`, `rdf/src/Rdf.ts:1000-1056`; `epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts:49`; `semantic-web/src/services/shacl-validation.ts:90` | JSDoc examples and allowlists, unrelated to the package |

## 7. S31 inventories against the P0 base

Entry counts from the census table (`consumer-census.md:545-560`) at f9982f3b5e6, re-measured here. Every inventory that names the package can only shrink:

| Inventory | P0 base | Now | After retirement |
| --- | --- | --- | --- |
| `standards/coverage.regression-baseline.jsonc` (lines naming `so/`) | 15 | 15 | 0 |
| `standards/schema-first.inventory.jsonc` | 1 | 1 | 0 |
| `_typos.toml` excludes | 1 | 1 | 0 (plus one extend-word, `fnd`, removed) |
| in-package suppressions (`so/src/internal/vocabulary.ts:1` `biome-ignore-all`, `so/src/JsonLdDocument.ts:278`, `:280`) | 3 | 3 | 0 |
| every other inventory and allowlist in the census table | 0 | 0 | 0 |

The renamed fixture strings (section 4.1 rows 3-11) touch no inventory. No new src file is added, so the 100%-new-file coverage law does not apply.

## 8. Retirement sequence this map implies (for the P7 design)

1. Edit the 12 `file-path` hits of 4.1 (rows 1-7 and 9-12; row 8 per S3), then run `delete-package @beep/schema-org --dry-run` until the hard refusal is gone.
2. `bun run beep delete-package @beep/schema-org --allow-stale-packets` (P2's flag set; the packet hits are this packet's own plan text). Baseline writers, tsconfig-sync, lockfile and mirrors run inside it.
3. Add the `standards/changesets.retired-packages.json` row; edit `_typos.toml`.
4. Cache-baseline request for `//` with the retired subject's digest in `previous` and no package name in the review reason; `beep cache audit` and `beep quality cache-policy` read 0 blocking findings.
5. `bun run beep delete-package @beep/schema-org --allow-stale-packets --check` prints clean; `rg -l "@beep/schema-org" packages apps` is empty; `bun run beep lint identity-registry`, `lint package-scripts` and `lint schema-first` pass.
6. Update `research/consumer-census.md` section c with the disposition "retired in P7 at <commit>", and the packet's `SPEC.md` relationship line `:221` through a decision file, not by appending to the Decision log tail.

## 9. Open questions

- **S1. Same PR as the `@beep/nlp` retirement, or its own commit/PR first?** The PLAN row names one cut-over. Schema-org has no consumer and no coupling to nlp (`research/2026-11-23-p5-map-stored-and-consumers.md:305-307`), so it can land as the first commit of the P7 PR, or as a separate small PR that keeps the nlp diff readable. Both meet chapter 11 rule 3. Recommendation: first commit of the P7 PR, gated on step 5 of section 8.
- **S2. Which fictional sibling name replaces `@beep/schema-org` in the `delete-package.test.ts` fixtures and the `WholeToken.ts` JSDoc?** It must extend `@beep/schema` as a prefix and must not be a real or retired workspace name. `@beep/schema-extras` matches no manifest today. Both files have to change in the same commit, or the exit rg stays red.
- **S3. Is `cli/test/fixtures/dependency-review/manifest-inventory.json:698` acknowledged as a dated capture, or trimmed?** Its README forbids editing rows and the test pins counts. Acknowledging keeps the record true, and the row does not block the PLAN exit rg (it carries the path, not the package name). Recommendation: acknowledge via `--acknowledge <file>` and record a decision file.
- **S4. Does `unit-a`'s `weightSeconds: 594` (`CiLanePartitions.ts:593-596`) drop with the package?** The P2 precedent changed only the member list (`git show --stat 010f21e3934`: `CiLanePartitions.ts` 4 lines). Re-measure only if the partition-balance test asks for it.
- **S5. Does the retirement need its own dated `DECISIONS.md` entry?** Chapter 11's slice procedure (`11-evolution-and-deprecation.md:15`) asks for one, while the upstream-first rules (`:109-181`) put the census in the goal packet's decision log, where `decisions/2026-11-19-p0-census-dispositions.md` already holds it. P2 relied on goal decision files plus the retired-package registry.
- **S6. After the retirement, should the kept schema.org namespace pin (CC-BY-SA-3.0, 12 term names, `namespace-pins.data.json:250-266`) get a `THIRD_PARTY_NOTICES.md` section like the W3C artifacts (`THIRD_PARTY_NOTICES.md:255`)?** This gap exists today and does not come from the retirement. If it counts as a defect, the "fix where found" law calls for its own small PR.
- **S7. Is losing the offline schema.org conformance check accepted as "semantic loss: none"?** No consumer runs it, but `apps/oip-web/src/content/OipSeo.ts` is a live, hand-written schema.org graph that nothing validates. The census marked the loss "none (no consumer)". Confirm that no P7 or later goal plans JSON-LD validation for that app. If one does, it would start from the pinned 30.1 Turtle in `@beep/rdf`, not the 30.0 table.
- **S8. Should the package's v30.0 versus the pin's v30.1 skew be recorded anywhere?** It disappears with the deletion. Recommendation: one clause in the census disposition, and no separate decision.
