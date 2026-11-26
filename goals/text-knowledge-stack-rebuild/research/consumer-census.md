# Consumer census: text-knowledge stack rebuild (P0)

The work list for every move, rename and deletion in this program, laid out in the
row schema of `standards/architecture/11-evolution-and-deprecation.md`
("Upstream-first retirement in `foundation/modeling`", rules 1, 2, 4 and 6). Every
number comes from the live tree at the base commit. Anything not measured is
marked `unmeasured` with the reason.

## Base and method

- Base commit: `f9982f3b5e65076be0cad0686deab3801cba99c9` (branch
  `goals/text-knowledge-stack-rebuild-p0-design`, measured 2026-11-19).
- Effect reference: installed `effect` 4.1.4 (`node_modules/effect/dist/*.d.ts`),
  cross-checked in `.repos/effect/packages/effect/src` at `4d9e66f559`.
- Scope of a consumer: tracked `*.ts *.tsx *.mts *.cts *.js *.mjs` files
  (`git ls-files`) outside the owning package directory, excluding `dist/` and
  `.repos/`. `scratchpad/` is counted on its own line and left out of every sum.
- Categories: `packages/**/src`, `packages/**/test` (with `dtslint`, `bench`),
  `packages/**` other (stories), `apps/**` (src and test split), config/docs.
- Import site: a file with an `import`/`export ... from "<pkg>[/sub]"` statement,
  including JSDoc `**Example**` imports (they migrate too). Import-statement
  lines are the lines those statements span.
- Usage line: a non-import line of a consumer file that names an imported
  binding (`\bName\b`, or `NS.member` for namespace imports, split by member).
  Per-file counts are unique lines; per-facet sums add symbol counts and can
  count one line twice when it names two facets of the same package.
- Construction line: a `<Schema>.make(` call (neutral under rule 2), counted with
  `rg -c` in the files that import the package.
- Covered / uncovered: covered means a public symbol of installed `effect` or of a
  kept package covers what the consumer reads (rule 1); uncovered sums are usage
  minus construction.
- Disposition: every row carries exactly one of retire, adapt or keep, with the
  decision files it comes from (under `goals/text-knowledge-stack-rebuild/decisions/`):
  [D] `2026-11-19-p0-census-dispositions`, [Q3]
  `2026-11-19-p0-rq3-external-vocabularies-as-adapters-confirmed`, [Q4]
  `2026-11-19-p0-rq4-occurrence-id-confirmed-mention-id-derives-from-it`, [A]
  `2026-11-19-p0-routing-annotation-asset-pack-and-write-tool-host`, [Q2]
  `2026-11-19-p0-rq2-assessments-confirmed-total-carrier-eight-sites`, [L0]
  `2026-11-19-p0-l0-homes-iri-in-identity-canonical-json-stays-in-jsonc`.

Commands (run from the repo root):

```sh
# file-level import sites (reproduces every "files" total below)
git ls-files -- '*.ts' '*.tsx' '*.mts' '*.cts' '*.js' '*.mjs' \
  | grep -v '^packages/foundation/modeling/<pkg>/' \
  | xargs rg -l -U "from\s*[\"']@beep/<pkg>(/[^\"']*)?[\"']"
# non-import string references (identity registry, CI tables, coverage weights)
rg -n "[\"']@beep/<pkg>(/[^\"']*)?[\"']" -g '*.{ts,tsx,mts,js,mjs}' \
  -g '!packages/foundation/modeling/<pkg>/**' | rg -v "from\s+[\"']@beep/<pkg>|import\("
# construction lines in importing files
<import-site file list> | xargs rg -c '\b(<Schema>)\.make\('
# config/docs
git ls-files '*package.json' | grep -v '^<owner>/' | xargs grep -l '"@beep/<pkg>"'
git ls-files '*tsconfig*.json' | grep -v '^<owner>/' | xargs grep -lE 'modeling/<pkg>("|/)'
git ls-files standards | xargs grep -lP '@beep/<pkg>(?![-\w])|modeling/<pkg>/'
git ls-files docs | xargs grep -lP '@beep/<pkg>(?![-\w])|modeling/<pkg>/'
```

The usage-line counter is a 140-line Node script that parses the import clause
(default, named with `as`, `* as NS`), drops import lines, de-duplicates a local
name imported twice, and counts lines per binding and per `NS.member`. It ran from
the session scratchpad and is not committed; any `rg` above reproduces file totals
exactly (provenance 159, nlp 46, schema-org 0, ontology 5 including scratchpad).

## Totals

| Package | Files (src / test / other / apps) | Import-statement lines | Usage lines | Scratchpad | package.json dependents | tsconfig files | standards files | docs files |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@beep/provenance` | 156 (64 / 68 / 1 / 23) | 354 | 1,100 | 3 files, 12 lines | 18 (incl. `scratchpad/package.json`) | 48 | 28 (19 cache baselines) | 14 (13 under `docs/reports`) |
| `@beep/nlp` | 45 (31 / 11 / 0 / 3) | 117 | 404 | 1 file, 1 line | 8 | 22 | 16 (9 cache baselines) | 14 (13 under `docs/reports`) |
| `@beep/schema-org` | 0 | 0 | 0 | 0 | 0 | 2 | 8 (2 cache baselines) | 13 (all `docs/reports`) |
| `@beep/ontology` | 3 (2 / 1 / 0 / 0) | 4 | 12 | 2 files, 9 lines | 2 (`packages/tooling/tool/cli`, scratchpad) | 6 | 11 | 16 |
| `@beep/rdf` | 91 (48 / 36 / 0 / 7) | 341 | 1,584 | 71 files, 899 lines | 19 | 51 | 27 | 16 |
| `@beep/epistemics` | 62 (35 / 17 / 2 / 8) | 115 | 173 | 37 files, 170 lines | 14 (incl. `scratchpad/package.json`) | 40 | 22 (15 cache baselines) | 10 (all `docs/reports`) |

Root aliases: `tsconfig.json` and `vitest.aliases.generated.json` each carry 2
alias entries per package (3 for schema-org, which also maps `./internal/*`).

---

## a. `@beep/provenance` (rename to `@beep/text`)

Owner `packages/foundation/modeling/provenance`: `src/index.ts` 29,
`SourceTextIdentity.ts` 152, `TextAnchor.ts` 246, `VerifiedTextAnchor.ts` 737
(1,164 lines, 4 files); 3 test files, 550 lines. Upstream coverage for all three
facets is none: no `effect` export models a pinned extracted-text identity, a
quote-checked UTF-16 anchor or a module-private verification token. Covered sums
are therefore 0 throughout; disposition is adapt (rename, shapes kept) per SPEC
item 10 and the L1 row.

P2 outcome: `@beep/text` (`packages/foundation/modeling/text`) was created through
`bun run beep create-package` and the three modules moved into it with their names; every
consumer below was migrated in the same commit and `@beep/provenance` was removed by
`bun run beep delete-package` with no alias (`rg -l "@beep/provenance" packages apps` is
empty; decision `2026-11-22-p2-package-move-mechanics`).

| Facet | Consumed surface | Upstream coverage | Covered | Uncovered | Construction (neutral) | Usage lines / files | Disposition | Semantic loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SourceTextIdentity` module | `SourceTextIdentity` 143, `SourceTextDigest` 62, `SourceTextExtractor` 56 | none | 0 | 120 | 141 (`SourceTextIdentity.make` 47, `SourceTextExtractor.make` 47, `SourceTextDigest.make` 47) | 261 / 77 | moved in P2 (commit 2) to `@beep/text` with its module name and shape; its string fields gained the well-formed-text check in commit 3 (note row below) [D] | none for the rename; `scopeRef` becomes part of `OccurrenceId` (see g) |
| `TextAnchor` module | `TextAnchor` 573, `TextAnchorFields`/`TextAnchorWidthCheck`/`isUtf16Boundary`/`isInternallyConsistent` 25 | none | 0 | 463 | 135 (`TextAnchor.make`: 31 src, 83 test, 21 apps) | 598 / 87 | moved in P2 (commit 2) to `@beep/text`, stored shape kept; `isWellOrdered` deleted in commit 3; `Position` (the `Selector` case) added beside it in commit 4, not a rename of it [D] | `TextAnchorWidthCheck` forbids empty ranges; `nlp` Handoff `Span` allows `start == end` (see f) |
| `VerifiedTextAnchor` module | `VerifiedSourceText` 63, `VerifiedTextAnchor` 19, receipt + `toTextAnchorVerificationReceipt` 61, `verify*` and their inputs 88, errors 17 | none | 0 | 185 | 63 (`TextAnchorVerificationReceipt.make` 22, `Verify*Input.make` 41) | 248 / 67 | moved in P2 (commit 2) to `@beep/text`, shape kept (SPEC L1) [D] | none |
| root barrel `@beep/provenance` (import path, not a facet) | 132 lines / 27 files import from the root: semantica 101 / 20, agent-memory-store 26 / 5, law-practice use-cases 3 / 1 (`IrToLaw.service.ts`), law-practice domain 2 / 1 (`Distinction.model.ts`); counted inside the three rows above | n/a | n/a | n/a | n/a | n/a | re-pointed in P2 (commit 2): every root import reads `@beep/text` [D] | none |
| `SourceTextIdentity` string fields (note, not a facet) | `scopeRef`, `sourceRef`, `extractor.name`, `extractor.version`, `normalizationVersion` (`S.NonEmptyString`) and `locator` (`PosixPath`, pattern `^[^\\]*$`) admit lone surrogates today: a value with an unpaired surrogate in every one of them decodes at the base; RFC 8785 requires well-formed Unicode and `@beep/jsonc/JsoncFingerprint` rejects such a value with `LoneSurrogate` (`JsoncFingerprint.ts:52,413,433`) | n/a | n/a | n/a | n/a | n/a | done in P2 (commit 3): the five strings are `WellFormedText` and `locator` is `SourceTextLocator`, on decode as well as construction (decision `2026-11-22-p2-source-identity-well-formed-on-decode`) [D] | a value holding a lone surrogate no longer decodes |

Consumers by package (files / src or other / test / usage lines):

| Consumer | Files | Src | Test | Usage lines |
| --- | --- | --- | --- | --- |
| `packages/law-practice/domain` | 48 | 19 | 29 | 497 |
| `packages/law-practice/server` | 37 | 17 | 20 | 189 |
| `apps/labs/semantica` | 20 | 12 | 8 | 99 |
| `packages/law-practice/use-cases` | 12 | 9 | 3 | 63 |
| `packages/foundation/capability/langextract` | 3 | 2 | 1 | 51 |
| `packages/tooling/library/agent-memory-store` | 5 | 2 | 3 | 30 |
| `packages/foundation/modeling/epistemics` | 5 | 3 | 2 | 24 |
| `packages/epistemic/domain` | 5 | 2 | 3 | 24 |
| `packages/workspace/server` | 2 | 1 | 1 | 24 |
| `packages/epistemic/use-cases` | 7 | 5 | 2 | 22 |
| `apps/professional-desktop` | 2 | 1 | 1 | 22 |
| `packages/epistemic/tables` | 2 | 1 | 1 | 16 |
| `packages/epistemic/server` | 2 | 1 | 1 | 12 |
| `packages/foundation/capability/file-processing` | 2 | 1 | 1 | 8 |
| `packages/epistemic/ui` (1 test, 1 story) | 2 | 1 | 1 | 12 |
| `apps/labs/lejeune-bolt-workbench` | 1 | 1 | 0 | 4 |
| `packages/tooling/tool/cli` (`Kb.service.ts`) | 1 | 1 | 0 | 3 |
| `scratchpad/effect-ontology` (excluded from sums) | 3 | 3 | 0 | 12 |

Non-import references to edit in the rename PR:
`packages/foundation/modeling/identity/src/packages.ts:459` (`$ProvenanceId`),
`packages/foundation/modeling/identity/test/shape-stable.test.ts:147`,
`packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts:422,833`,
`packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts:436`,
`packages/tooling/policy-pack/repo-configs/src/internal/laws/generated/EffectLawsAllowlistSnapshot.ts:113-116`,
`turbo.json:403`, `standards/architecture/GLOSSARY.md:433`, `standards/architecture/DECISIONS.md`,
`standards/schema-catalog/@beep/provenance.generated.jsonc` (10 rows),
`standards/instrumentation-catalog/@beep/provenance.generated.jsonc` (3 spans named
`VerifiedTextAnchor.*`). Persisted bytes that carry provenance shapes are listed under f.

---

## b. `@beep/nlp` (ADAPT under rule 2; facets rehome to `@beep/annotation` and `@beep/nlp-processing`)

Owner `packages/foundation/modeling/nlp`: 29 src files, 9,352 lines; 10 test files,
2,205 lines; `THEORY.md` 194 lines. The root barrel `@beep/nlp` has 0 importers;
every consumer imports a subpath. Totals exceed 100 consumer lines, so rule 4's
lines-and-files census applies. Handoff construction counts `Contract.<Member>.make(`
lines in the 9 langextract and semantica files that construct a member.

| Facet | Consumed surface (lines / files) | Upstream coverage that survives derivation | Covered | Uncovered | Construction (neutral) | Owner lines / files | Disposition | Semantic loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Handoff `Contract.Span` | 20 / 9 | none upstream; target `@beep/text` `Selector.Position` | 0 | 4 | 16 / 8 | `Handoff/Contract.ts` 553, `Handoff/index.ts` 44 | deleted in P3: replaced by annotation documents, kinds, readings and residuals | allows empty spans (`start <= end`, `Contract.ts:249-262`); `TextAnchor` requires `start < end` and a non-empty quote |
| Handoff `Contract.AnnotatedDocument` | 6 / 4 | none; target `@beep/annotation` `AnnotationDocument` | 0 | 2 | 4 / 4 | (same file) | deleted in P3: replaced by annotation documents, kinds, readings and residuals | ids re-minted from array index (`Handoff.behavior.ts:41-53,92`) |
| Handoff `Contract.Provenance` | 5 / 4 | none | 0 | 1 | 4 / 4 | (same file) | deleted in P3: replaced by annotation documents, kinds, readings and residuals | carries `confidence` (`THEORY.md:139`) |
| Handoff `Contract.Mention`, `MentionId` | 3 / 2 | none; target `@beep/annotation` | 0 | 1 | 2 / 1 | (same file) | deleted in P3: replaced by annotation documents, kinds, readings and residuals | none |
| Handoff `Contract.Entity`, `EntityId` | 3 / 2 | none | 0 | 1 | 2 / 1 | (same file) | deleted in P3: replaced by annotation documents, kinds, readings and residuals | every aligned label becomes an `Entity` |
| Handoff `Contract.TextChunk`, `ChunkId` | 3 / 2 | none; target `@beep/annotation` | 0 | 1 | 2 / 1 | (same file) | deleted in P3: replaced by annotation documents, kinds, readings and residuals | the handoff emits no whole-capture Chunk; the Chunk kind remains for chunking passes |
| Handoff `Contract.Relation` | 0 / 0 | none | 0 | 0 | 0 | (same file) | deleted in P3: replaced by annotation documents, kinds, readings and residuals | always emitted empty (`Handoff.behavior.ts:111`) |
| Handoff, all `Contract` members | 40 / 10 (langextract 36 / 9, semantica 4 / 1) | none | 0 | 10 | 30 / 9 | 597 / 2 | deleted in P3: replaced by annotation documents, kinds, readings and residuals | rows above |
| Handoff `UnitInterval` re-export | 24 / 8 (langextract 22 / 7, semantica 2 / 1) | covered: `@beep/schema/UnitInterval` (`Handoff/index.ts` re-exports it unchanged) | 3 | 0 | 21 / 8 | 1 line | deleted in P3: consumers use @beep/schema/UnitInterval | none |
| Graph `Schema` (`TextNode` 55, `POSNode` 22, `TextEdge` 21, `EntityNode` 19, `LemmaNode` 11, `RelationNode` 10, `DependencyNode` 8) | 147 / 10 (nlp-processing 138 / 6, wink 7 / 2, semantica 2 / 2) | none | 0 | 121 | 26 / 6 | `Graph/Schema.ts` 533 (re-measured at P6 design) | adapted in P6: moved with Core to @beep/nlp-processing by `git mv`; only its span changed in P3 | float span deleted in P3; optional Position resolves unique surfaces |
| Graph `Span` (`Schema.ts:358`) | 0 direct; embedded in `EntityNode` (`:391`) and `RelationParticipant` (`:511`) | none | 0 | 0 | 0 | (same file) | deleted in P3; optional Position on EntityNode and RelationParticipant | `S.Finite` offsets, no `start <= end` check |
| Graph `GraphOps` | 0 / 0 | `effect/Graph` (it is a layer over it, `GraphOps.ts:30`) | 0 | 0 | 0 | 1,184 / 1 | deleted in P6; `nlp-processing/src/Graph/EffectGraph.ts` is the surviving copy [D] | none |
| Ontology `Kind` | 0 / 0 | none | 0 | 0 | 0 | 714 / 2 | deleted in P3; containment levels belong to annotation kinds | Document, Token and Character have no successor or consumer |
| Operations (`Composable`, `Definition`) | 0 / 0 | none (`effect/Effect` Kleisli composition only) | 0 | 0 | 0 | 794 / 3 | deleted in P6 and replaced by `nlp-processing/src/Operation.ts`, not moved: 0 consumers (decision `2026-11-24-p6-nlp-operations-and-algebra-are-replaced-not-moved`) [D] | three overlapping operation models exist (see below) |
| Algebra `Monoid` | 0 / 0 | covered: `effect/Reducer` (`make`, `flip` for `Dual`), `effect/Combiner`, `Number.ReducerSum/Multiply/Max/Min`, `String.ReducerConcat`, `Boolean.ReducerAnd/Or`, `Array.makeReducerConcat`, `Option.makeReducer`, `Struct.makeReducer`, `Tuple.makeReducer` (all present in installed `dist/*.d.ts`). Uncovered: `SetUnion`, `SetIntersection`, `MultiSet` (no `HashSet`/`HashMap` reducer in 4.1.4), `VectorAdd`, `VectorAverage`, `StringDelimited`, `checkLaws` helpers | 0 | 0 | 0 | 882 / 1 | deleted in P6 (0 vs 0 consumers; rule 2) [D] | none |
| Algebra `NLPMonoid` | 0 / 0 | partly (string and array instances as above) | 0 | 0 | 0 | 873 / 1 (+37 index) | deleted in P6 (0 consumers; no P6 consumer needed an instance the Reducer census leaves uncovered) [D] | the non-associative instance (report §2.2 D7) disappears with it |
| Core `Document`, `DocumentId`, `Sentence`, `SentenceIndex`, `Token`, `TokenIndex` | 135 / 26 (`DocumentId` 53, `Document` 32, `Token` 29, `Sentence` 9, `SentenceIndex` 7, `TokenIndex` 5; 133 unique lines) | none | 0 | 71 | 64 / 24 | `Core/*` 3,137 / 10 | adapted in P6: moved to `@beep/nlp-processing` [D] | none |
| Core `CharPosition` | 6 / 3 (wink 2, nlp-processing 2, law-practice use-cases 2) | none; target `@beep/text` position | 0 | 0 | 6 / 3 | (in Core) | deleted in P6 in favour of the text position; `Token.span` is a `@beep/text` position [D] | `CharPosition` is a fourth offset type |
| Core `Similarity`, `Vectorization` | 68 / 10 (wink 61 / 5, nlp-processing 7 / 5) | none | 0 | 47 | 21 / 4 | (in Core) | adapted in P6: moved to `@beep/nlp-processing` with Core [D] | none |
| Core `Pattern*` | 8 / 3 (wink 7 / 2, nlp-processing 1 / 1) | none | 0 | 8 | 0 | (in Core) | adapted in P6: moved to `@beep/nlp-processing` with Core [D] | none |
| `IdentifierText`, `PathText`, `QueryText`, `VariantText` | 0 / 0 | none | 0 | 0 | 0 | 341 / 4 | retire in P7 (no consumer) [D] | none |
| `THEORY.md` | 0 inbound links outside this packet | n/a | n/a | n/a | n/a | 194 / 1 | retire: absorbed by the chapter and deleted with the package [D] | `:72` cites `src/Graph/TypeClass.ts`, which is in `nlp-processing` |

Facet totals: facet usage sums 428 (404 unique usage lines in 45 files; a line naming
two facets counts in both); construction 168; covered 3; uncovered 257 (Core 126,
Graph Schema 121, Handoff 10). Core construction is measured with
`rg -c '\b(<names>)\.make\('` over the 33 files that import `@beep/nlp/Core`: 70 lines in
24 files for the seven names, 64 / 24 without `CharPosition`, 6 / 3 for `CharPosition`.

Rule 2 verdict: the uncovered sum (257) exceeds the covered sum (3), so the `@beep/nlp`
concept is ADAPT, not retire [D]. The package name retires once its facets are
rehomed: Handoff is replaced by `@beep/annotation`, Ontology Kind is deleted, and
Graph Schema and Core moved to `@beep/nlp-processing` in P6, where `Operation.ts` replaced
Operations. Only the covered `UnitInterval` re-export retires
to its upstream, `@beep/schema/UnitInterval`.

Consumers by package (files / src / test / usage lines): nlp-processing 14 / 12 / 2 /
163; drivers/wink 10 / 8 / 2 / 134; langextract 15 / 10 / 5 / 82; law-practice
use-cases 2 / 1 / 1 / 12; semantica 2 / 1 / 1 / 11; law-practice server 1 / 0 / 1 / 1;
lejeune-bolt-workbench 1 / 1 / 0 / 1. package.json dependents: nlp-processing,
law-practice server, law-practice use-cases, drivers/wink, semantica, langextract,
lejeune-bolt-workbench, scratchpad.

Duplicates inside the target home (`packages/foundation/capability/nlp-processing`):
`src/Graph/TypeClass.ts` (1,031 lines, its own `makeOperation` at `:83`; only
`test/Graph/TypeClass.test.ts` imports it), `src/Graph/GraphOperations/Operation.ts`
(356), `src/Graph/EffectGraph.ts` (797). `src/internal/observability.ts:16` labels
nlp-processing spans with `package: "@beep/nlp"`.

Non-import references: `identity/src/packages.ts:774` (`$NlpId`),
`identity/test/shape-stable.test.ts:161`, `CiLanePartitions.ts:412,827`,
`CoverageScope.ts:394`, `cli/test/quality-tasks.test.ts:9343`, `turbo.json:396`.

---

## c. `@beep/schema-org` (retire the whole package in P7)

Owner `packages/foundation/modeling/schema-org`: 15 src files, 7,896 lines (4,794
vendored in `src/internal/vocabulary.ts`); 25 test files. TS import sites outside the
package: 0. package.json dependents: 0. Every sum is therefore 0 and rule 2 retires
each facet unless a consumer is named before the PR.

| Facet | Consumed surface | Upstream / kept-package coverage | Covered | Uncovered | Construction | Owner lines / files | Disposition | Semantic loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Typed graph construction (`JsonLdDocument`, `JsonLdNode`, `buildResult`) | 0 | partial: `@beep/rdf/JsonLd` (`JsonLdContext`, `JsonLdNodeIdentifier`, `JsonLdReferenceValue`); no typed schema.org node union | 0 | 0 | 0 | `JsonLdDocument.ts` 653 | retire in P7 with the whole package [D] | none (no consumer) |
| Node classes (`Thing`, `CreativeWork`, `Person`, `Organization`, `SoftwareSourceCode`, `TechArticle`, `APIReference`) | 0 | none | 0 | 0 | 0 | 696 / 7 | retire in P7 [D] | none |
| `NodeRef` (`NodeId`, `InvalidNodeIdError`, `HasNodeId`) | 0 | partial: `@beep/rdf` `IRIReference`, `JsonLdReferenceValue` | 0 | 0 | 0 | 324 / 1 | retire in P7 [D] | none |
| Serialization (`toScriptBody`, `JsonLdDocument.ts:553-640`) | 0 | partial: `@beep/html/Html.script` (`ScriptDataBlockMimeType` admits `application/ld+json`); escaping parity unmeasured (no shared test) | 0 | 0 | 0 | in `JsonLdDocument.ts` | retire in P7 [D] | none |
| Conformance entrypoint (`Conformance.ts`, `conformance-entry.ts`) | 0 | none | 0 | 0 | 0 | 926 / 2 | retire in P7 [D] | none |
| Vocabulary tables (`Vocabulary.ts`, `internal/vocabulary.ts`, `internal/rows.ts`) | 0 | partial: `@beep/rdf/Vocab/SchemaOrg` (`SCHEMA_ORG_NAMESPACE`, `SCHEMA_ORG_TERMS`) and `@beep/identity` `CoreVocab.schema` (`identity/src/Vocab.ts:393`) | 0 | 0 | 0 | 5,245 / 3 | retire in P7 (third copy of schema.org terms) [D] | none |

Candidate consumer that does not use the package: `apps/oip-web/src/content/OipSeo.ts:40-70`
hand-writes schema.org JSON-LD (`Person`, `LegalService`, `WebSite`) rendered at
`apps/oip-web/src/app/page.tsx:136`. Non-import references:
`identity/src/packages.ts:3099`, `CoverageScope.ts:453`, `CiLanePartitions.ts:619`,
`tsconfig.packages.json:439`, `turbo.json:407`, `_typos.toml:14,120`,
`standards/schema-first.inventory.jsonc:1073-1079`, string fixtures in
`packages/tooling/tool/cli/test/delete-package.test.ts:1117-1174`.

---

## d. `@beep/ontology` (legal seeds move out; FOLIO DTOs deleted)

External TS consumers (all facets): `packages/tooling/tool/cli/src/commands/Research/Library/Library.ontology.ts`
(`fold`, `toTurtle`, `AssembledClass`, `AssembledOntology`, `Triple`),
`Library.projection.ts` (`AssembledClass`), `cli/test/research-library-ontology.test.ts`
(`toTurtle`): 12 usage lines, 3 files. Scratchpad: 2 files (`Ontology.models#HttpUrl`, 9 lines).

| Facet | Consumed surface | Upstream coverage | Covered | Uncovered | Construction | Owner lines / files | Disposition | Semantic loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Vocabulary.seed.ts` (docketing, party-kind, legal-role schemes, MPEP source IRIs) | 0 outside package; inside: `VocabularyRegistry.ts`, `Vocabulary.models.ts`, root barrel | none | 0 | 0 | 0 | 514 / 1 | moved in P5 (row 11, 0ace3e35c3e): the schemes are JSON payloads under `packages/law-practice/domain/assets/vocabulary/` read through the pack manifest, IRIs and notations held by the row 1 freeze fixture [A, D] | IRIs and approval metadata must be preserved (SPEC L3 row) |
| `SemanticFoundation.seed.ts` | 0 outside; inside: `SemanticFoundation.models.ts`, `TaxonomyRegistry.ts`, `TaxonomyLoader.ts`, barrel | none | 0 | 0 | 0 | 145 / 1 | moved in P5 (row 11, 0ace3e35c3e): the intake taxonomy is `intake-taxonomy.json` in the same pack, modelled by the law-practice `IntakeTaxonomy` value [A, D] | same |
| `src/seed/*.ttl`, `*.jsonld` (docketing, legal-intake, party-roles) | 0; no code reads them; listed only in `package.json` `files` (`:47-48`) | none | 0 | 0 | 0 | 1,281 / 6 | moved in P5 (row 11, 0ace3e35c3e) byte-identical to `packages/law-practice/domain/assets/vocabulary/`, digests held by the row 1 freeze fixture [A, D] | none |
| `Ontology.models.ts` FOLIO HTTP DTOs (15 exported schemas) | 0 package consumers; 2 scratchpad files; its derived identifiers are pinned as strings in `identity/test/IriBinding.test.ts:58-75`, `Identity.test.ts:253-258`, `shape-stable.test.ts:440-442` | none | 0 | 0 | 0 | 911 / 1 | deleted in P5 (row 8, 530fb68c438) with their data; the identity tests pin a kept `ClassificationPin` identity instead [A, D] | the identity tests lose their example path; rewrite them on a registry term |
| Fold string serialization (`toTurtle` `Fold.projections.ts:640`, `toJsonLd` `:396`, `toMarkdown` `Fold.markdown.ts:299`) | `fold`, `toTurtle` 4 lines / 2 files (cli) | none (`@beep/rdf` `Dataset` exists but the fold does not use it: 0 matches for `Dataset` in `ontology/src`) | 0 | 4 | 0 | `Fold.*` 2,687 / 4 | adapted in P5 (row 9, 4e1d3059f33): the fold builds a `Dataset` only; the cli writes Turtle through the n3 serializer with the fold's prefix map [D] | Turtle text order and prefix choice change; cli `Library.ontology.ts:353` already builds a second, independent `Dataset` from its own quads |
| `TaxonomyLoader.ts` (manifested asset-pack protocol) | 0 outside; inside `ClassificationRegistry.ts` | none | 0 | 0 | 0 | 1,013 / 1 | keep (it is the loader the asset pack uses) [A] | none |
| Classification, registries (`Classification.models.ts`, `ClassificationRegistry.ts`, `TaxonomyRegistry.ts`, `VocabularyRegistry.ts`) | 0 outside | none | 0 | 0 | 0 | 1,067 / 4 | kept: `Classification.models.ts` and `ClassificationRegistry.ts`; `TaxonomyRegistry.ts` and `VocabularyRegistry.ts` (0 consumers) deleted in P5 (row 11, 0ace3e35c3e) [D] | none |
| `SkosMappingKind` (`SemanticFoundation.models.ts:148`, `LiteralKit(["exactMatch", "closeMatch"])`) | 0 outside the package (`T ontology \| xargs rg -l SkosMappingKind`: 0 files); inside: `ConceptAlignment.kind` (`SemanticFoundation.models.ts:194`), `TaxonomyLoader.ts:26,236` (3 lines / 2 files) | none | 0 | 0 | 0 | `SemanticFoundation.models.ts:140-169` | adapted in P5 (row 10, 76f8502e051) into the SSSOM `MappingPredicate`; row 13 (3d52b513d1e) adds the mapping sets that carry it [D] | none: both literals are SKOS mapping predicates the SSSOM `predicate_id` carries |

Asset-pack layout today: the only manifested pack read through `TaxonomyLoader` is
`explorations/legal-ontology-landscape/assets/` (`manifest.jsonl` 21 rows, `fetch.sh`,
`.gitignore` for vendor bytes, `README.md`), plus test fixtures
`packages/foundation/modeling/ontology/test/fixtures/vendor-manifest.jsonl` and
`test/fixtures/classification/manifest.jsonl`. No law-practice asset pack exists. The
nearest convention in the slice is `packages/law-practice/server/assets/<name>/`
(`citation`, `citation-diff`, `citation-html`, `citation-xml`), each with a
`build-receipt.json` and no `manifest.jsonl`. Slice re-declarations of the seed
vocabularies: `packages/documents/domain/src/values/Taxonomy/Taxonomy.seed.ts`,
`packages/law-practice/domain/src/values/LegalRole/LegalRole.model.ts`.

---

## e. `@beep/rdf`

Consumers (excluding scratchpad): 91 files, 1,584 usage lines. Owner src 7,221 lines in
the top-level and `Adapters/` files plus `Vocab/`.

| Facet | Consumed surface | Upstream coverage | Covered | Uncovered | Construction (neutral) | Owner lines / files | Disposition | Semantic loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Dataset` as a list (`Rdf.ts:798-800` `quads: S.Array(Quad)`) | `makeDataset`, `Dataset`, `sortDatasetQuads`, `areDatasetsEquivalent`: 232 lines / 59 files; `.quads` field reads 117 lines / 38 files outside rdf (name match, may include unrelated `.quads`) | none (`effect/HashSet` is a carrier, not a quotient up to blank-node isomorphism) | 0 | 96 | 136: `makeDataset(` 132 lines / 53 files outside rdf, 29 / 4 inside; `Dataset.make(` 4 / 2 outside (`rdf-canonize/test/CanonicalizationSecurity.test.ts`, `semantic-web/test/ServicesAndSurface.test.ts`), 2 / 2 inside | `Rdf.ts` 1,297 | adapted in P5 (row 2, 34c34d8bdba): `quads` is a `HashSet` with a sorted encoding; row 3 (78e937db873) adds the RDFC-1.0 digest and isomorphism; the gold projection regeneration is row 14, held on an operational C1 measure [D] | yes: order and duplicate multiplicity are lost; equality changes from lexical sort (`areDatasetsEquivalent`, `Rdf.ts:1289`) to isomorphism; `apps/labs/semantica/fixtures/gold/v1/g-projection.json` is regenerated |
| `Dataset` equality sites | `areDatasetsEquivalent`: 0 outside rdf; rdf tests `Rdf.test.ts:572-574`, `ProvRdf.test.ts:197,225,264,360,386,592`. `sortDatasetQuads` production: `apps/labs/semantica/src/layers/RdfProjectionLive.ts:114`, `packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:224`, `packages/tooling/tool/cli/src/commands/Research/Library/Library.projection.ts:301`, `Library.ontology.ts:353` | none | 0 | 4 | 0 | (in `Rdf.ts`) | adapted in P5 (row 2, 34c34d8bdba): ground comparisons use `Equal`, the rest `isIsomorphic`; `sortDatasetQuads` and `areDatasetsEquivalent` are deleted [D] | as above |
| `Literal` with language-tagged `xsd:string` (`Rdf.ts:484-500`, `makeLiteral` `:1027`) | 77 lines / 35 files (`makeLiteral` 69, `Literal` 5, `LanguageTag` 3); `makeLiteral(` 87 lines / 36 files repo-wide | none | 0 | 8 | `makeLiteral(` 69 lines / 33 files outside rdf | `Rdf.ts` | adapted in P5 (row 2, 34c34d8bdba) to three cases (`Simple`, `Typed`, `LangTagged`) [D] | yes: `xsd:string` + tag becomes `rdf:langString`; the byte form of stored literals changes |
| construction sites of tagged `xsd:string` | `rdf/test/Rdf.test.ts:475,550,551`; `rdf/test/ProvRdf.test.ts:336,443`; `semantic-web/test/IdentityRdfBindingCoverage.test.ts:130`; JSDoc `rdf/src/Rdf.ts:1014` | none | 0 | 0 | 7 `makeLiteral(` calls (1 outside rdf) | (in the `Literal` row) | adapt: rewrite each call to the language-tagged case [D] | as the `Literal` row |
| pass-through decoders (forward the source's language with any datatype) | `drivers/n3/src/N3.service.ts:211`, `drivers/oxigraph/src/Oxigraph.sparql.ts:147`, `drivers/rdf-canonize/src/adapters/canonicalization.ts:151`, `drivers/shacl/src/Shacl.validation.ts:216` | none | 0 | 0 | 4 `makeLiteral(` calls | (in the `Literal` row) | adapt to the three cases [D] | as the `Literal` row |
| already correct | `cli/test/knowledge-coverage-examples.test.ts:33-34` (`rdf:langString`) | none | 0 | 0 | 2 `makeLiteral(` calls | (in the `Literal` row) | keep | none |
| `rdf -> md` edge | `package.json:73` dependency; `src/Adapters/MdSections.ts` imports `@beep/md/Md.model` (`:8,14`); root barrel re-export `src/index.ts:19`; test `test/DocumentAnnotation.test.ts` | none | 0 | 0 outside rdf | 0 | 287 / 1 | removed in P5 (row 6, 2affeda13d9 and b9c1f1ff713): the fold and its test live in `@beep/md` [D] | none (0 consumers of `MdSections` outside rdf) |
| Hand-written `prov:`, `oa:`, `xsd:` constants | `Vocab/Prov.ts` (574 lines, 35 exports, `PROV_NAMESPACE` `:25`), `Vocab/Oa.ts` (77, 4, `:26`), `Vocab/Xsd.ts` (128, 7, `:27`); consumers via `@beep/rdf/Vocab/(Prov\|Oa\|Xsd)`: 80 lines / 25 files | none | 0 | 80 | 0 | 779 / 3 | adapt: register in the CURIE registry in P1 [Q3] | none |
| Namespace literals outside `rdf/src/Vocab` | `prov#`: `rdf/src/Adapters/DocumentAnnotation.ts:40,171`, `rdf/test/ProvRdf.test.ts` (16), `rdf/test/Rdf.test.ts` (1), `ontology/use-cases` `Session.validation.ts` and its test (1 each), `ontology/server/test/OntologyPublishTools.test.ts`, `professional-desktop/test/ontology-sidecar-registration.test.ts`, `cli/test/research-library-ontology.test.ts` (2), 25 lines / 8 files; `oa#`: `rdf/test/Rdf.test.ts` (1); `xsd#`: 26 lines / 14 files (`rdf/src/Rdf.ts` 8, `JsonLd.ts` 1, `semantica/src/layers/RdfProjectionLive.ts`, `ciops/src/projection/Turtle.ts`, `cli/src/commands/Kb/Kb.projection.ts`, `ontology/use-cases/.../Session.validation.ts`, tests); CURIE literals `"prov:..."`, `"oa:..."`, `"xsd:..."`: 22 lines / 7 files (`ProvRdf.ts` 8, `DocumentAnnotation.ts` 4, `party/domain/.../Provenance.model.ts` 3, `Prov.ts` 2, `nlp/Handoff/Contract.ts` 2, `professional-desktop/test/integration/ontology-mcp-http.test.ts` 2, `semantic-web/src/identity/IdentityRdfBinding.ts` 1) | none | 0 | 74 (namespace URI literals 52 lines / 17 files, CURIE literals 22 / 7; 74 unique lines in 23 files) | 0 | (none; literals) | adapt: replace with registry CURIEs after P1 registers the namespaces [Q3] | none |
| `nif:` and `gufo:` | 0 occurrences of a NIF or gUFO namespace in tracked TS (`rg -i 'nif-core\|nlp2rdf\|"nif:'`, `rg 'purl.org/nemo/gufo'`) | n/a | 0 | 0 | 0 | 0 | keep: nothing to migrate; the registry entries are new [Q3] | none |
| `Prov.ts` | production consumer: `ProvRdf.ts:36,78` (in package); tests: `test/Rdf.test.ts`, `ProvRdf.test.ts`, `ProvO.test.ts`, `InteropAndMetadata.test.ts`; 0 package or app consumers; scratchpad 6 files | none | 0 | 0 | 0 | 1,163 + 1,007 (`ProvRdf.ts`) | adapt: `prov:Entity` projection of `SourceTextIdentity` (SPEC item 6) | none |
| `Iri.ts` runtime `IRI` schema (`IRI` `:995`, `AbsoluteIRI` `:954`, `IRIReference`) | 273 lines / 16 files: `foundation/modeling/ontology` 10 src + 3 test files (`IRI` in `Fold.models.ts:17`, `Fold.assembly.ts:16`, `test/Fold.test.ts:6`; `IRIReference` in the other 8 src files and 2 tests), `documents/domain` 2 (`Taxonomy.model.ts`, `Taxonomy.seed.ts`, `IRIReference`), `ontology/client` 1 (`Session.atoms.ts:49`, `IRI`) | none | 0 | 85 | 188 / 10 (`IRIReference.make(` 187 / 9, `IRI.make(` 1 / 1; `Vocabulary.seed.ts` 114, `Taxonomy.seed.ts` 28) | `Iri.ts` 1,018 | adapt: move to `@beep/identity` before L0 (SPEC P0 item 8) [L0] | none |

Namespace-literal command (outside `rdf/src/Vocab`, `scratchpad/` and `goals/` excluded):
`git ls-files -- '*.ts' '*.tsx' '*.mts' '*.cts' '*.js' '*.mjs' | grep -v '^packages/foundation/modeling/rdf/src/Vocab/' | grep -vE '^(scratchpad|goals)/' | xargs rg -P -c '<pattern>'`
with `w3\.org/ns/prov#`, `w3\.org/ns/oa#`, `XMLSchema#` and ``["'`](prov|oa|xsd):[A-Za-z]``.
IRI construction: the same file list outside `rdf/` with
`rg -P -c '(?<![\w.])(IRIReference|IRI|AbsoluteIRI)\.make\('`.

Facet totals (adapt rows; the `Literal` sub-rows sit inside the `Literal` row, and the
4 equality lines are also inside the `Dataset` 232): facet usage sums 740 (`Dataset`
232, equality 4, `Literal` 77, constants 80, namespace literals 74, `IRI` 273);
construction 393 (`Dataset` 136, `Literal` 69, `IRI` 188); covered 0; uncovered 347
(`Dataset` 96, equality 4, `Literal` 8, constants 80, namespace literals 74, `IRI` 85).
Every adapt facet has no upstream coverage, so rule 2 keeps each one ADAPT.

---

## f. Anchor encodings

Canonical: `TextAnchor` (`packages/foundation/modeling/provenance/src/TextAnchor.ts:156`,
fields `startChar`, `endChar`, `quote`; glossary `standards/architecture/GLOSSARY.md:433`).

The five non-canonical encodings SPEC item 2 deletes are the five the report's D2
names beside the canonical one. Evidence: report §2.2 D2 lists exactly these six, and
L1's Selector is "the tagged union `rdf/Evidence.ts` already sketches", so the rdf
selector classes are replaced by `Selector` (the `oa:` wire codec stays in
`rdf/src/Adapters/WebAnnotation.ts`).

No anchor encoding has upstream coverage, so covered is 0 on every row and uncovered
is usage minus construction (`<Schema>.make(` lines in the consumer files).

| # | Encoding | Definition | Shape | Consumers outside owner (usage lines / files) | Upstream coverage | Covered | Uncovered | Construction (neutral) | Disposition | Semantic loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | rdf `TextQuoteSelector`, `TextPositionSelector` (union `EvidenceSelector` with `FragmentSelector`, carrier `EvidenceAnchor`) | `packages/foundation/modeling/rdf/src/Evidence.ts:78,122,164,204,290` | `exact/prefix/suffix`; `start/end` | 0 package or app imports; inside rdf: `Adapters/WebAnnotation.ts` (96 name lines), rdf tests. `WebAnnotation` itself: 1 line in `semantic-web/test/ServicesAndSurface.test.ts` | none | 0 | 0 | 0 | deleted in P2 (commit 9): `rdf/src/Evidence.ts`, its barrel line and the evidence codecs of `Adapters/WebAnnotation.ts` are gone, replaced by `@beep/text` `Selector`; the `oa:` codec stays. Narrowings: positions are non-empty and unit-tagged, `Fragment.conformsTo` is required, and the rdf `EvidenceAnchor` `id` and `note` have no L1 counterpart (the `WebAnnotation` DTO keeps `id` and `bodyValue`); the one consumer the census missed, `goals/trustgraph-doc-ontology/scripts/verify-artifacts.ts`, got a script-local schema (decision `2026-11-22-p2-rdf-evidence-module-deleted`) [D] | none |
| 2 | epistemics `EvidenceSpan` | `packages/foundation/modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:147` | `TextAnchorFields` + `confidence` | `EvidenceSpan` 22 / 10 (epistemic domain 11 / 3, tables 4 / 2, ui 2 / 2, use-cases 2 / 1, server 1 / 1, professional-desktop 2 / 1); `Confidence` from the same subpath 25 / 13 (semantica 13 / 6); internal: `ClaimEvidenceReview.model.ts`, `Contradiction.model.ts`, `ContradictionDetection.model.ts`, barrel | none | 0 | 13 | 9 / 6 (`EvidenceSpan.make(`) | deleted in P4 (row 5, b61b79aa79f): `EvidencePosition` holds a `TextAnchor` plus an extractor-confidence signal; the stored column keeps its bytes and the epistemic domain `EvidenceRow` reads current and legacy shapes [D] | confidence leaves the anchor; the stored `epistemic_evidence.span` jsonb holds an encoded `EvidenceSpan` (anchor fields plus `confidence`), not a bare `TextAnchor`, and is decoded today by `EvidenceSpan.make(` at `packages/epistemic/tables/src/entities/EvidenceVerification/EvidenceVerification.converters.ts:77` and `packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.repo.ts:645`; see section i |
| 3 | nlp Handoff `Span` | `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:249` | `start/end`, `start <= end` | 20 / 9 (langextract) | none | 0 | 4 | 16 / 8 (`Contract.Span.make(`) | deleted in P3: TextAnchor for aligned extractions; optional Position for Graph | empty spans allowed |
| 4 | nlp Graph `Span` | `packages/foundation/modeling/nlp/src/Graph/Schema.ts:358` | `S.Finite` start/end, no order check | 0 direct; inside `EntityNode`, `RelationParticipant` | none | 0 | 0 | 0 | deleted in P3: TextAnchor for aligned extractions; optional Position for Graph | floats admitted |
| 5 | party `EvidenceAnchor` (case `TextSpan`) | `packages/party/domain/src/entities/Provenance/Provenance.model.ts:413,470` | `occurrence`, `textDigest`, `start`, `end`, `quote` | 10 / 4 (party server: `ContactEvidence.behavior.ts` `RecordRow` 3, `MailIndex.behavior.ts` `HeaderField` 3 and `HeaderNamespace` 2, `ReviewLoop.model.ts` `EvidenceAnchor` 1, `test/ReviewLoop.test.ts` `RecordRow` 1); in-package 17 lines in `Claim.model.ts:97`, `Communication.model.ts:131,153`, `test/fixtures/acme.ts`, `test/Party.competency.test.ts` | none | 0 | 4 | 6 / 3 (`RecordRow.make(` 3 / 2, `HeaderField.make(` 3 / 1) | deleted in P2 (commit 10) for the `TextSpan` case: it is replaced by `TextOccurrence { occurrence: ArtifactOccurrenceId, anchored: Anchored }` over the `@beep/text` receipt, and old `TextSpan` JSON is refused; the union stays party-owned with the three non-text cases and `TextOccurrence` (decision `2026-11-22-p2-party-text-occurrence`) [D] | yes (below) |

Facet totals for the five: usage 52 lines, construction 31, covered 0, uncovered 21.

Non-text cases of `EvidenceAnchor`: `HeaderField` (`occurrence`, `namespace` from
`HeaderNamespace` `rfc5322 | mapi | x-header | load-file`, `field`), `MetadataTag`
(`occurrence`, `namespace`, `tag`), `RecordRow` (`occurrence`, `rowKey`). None has a
text range or quote. They need a non-text locator keyed by the artifact occurrence:
`@beep/text` `Selector.Fragment { conformsTo, value }` covers them only if a
`conformsTo` IRI per case is registered; otherwise they stay party values that
reference an `@beep/text` artifact identity. `party`'s own `OccurrenceId`
(`packages/party/domain/src/values/Ids/Ids.model.ts:139`, prefix `party-occ`),
`ActivityId` (`:164`, `party-act`) and `Digest` (`:391`, `^[0-9a-f]{8,64}$`) collide
with SPEC item 2 ("the only occurrence identity in the repository"). P2 (commit 10) renamed
the party record id to `ArtifactOccurrenceId`, after the `ArtifactOccurrence` entity it
keys; the `party-occ` prefix and every value stay. The non-text cases are unchanged and
no fragment specification IRI was registered for them. The party `ActivityId` and
`Digest` are decided with the claims layer in P4.

Further encodings the tree has that the five do not cover:

| Encoding | Definition | Consumers | Note | Disposition |
| --- | --- | --- | --- | --- |
| langextract `TextOffsetRange` (unit-tagged), `Utf16TextRange` | `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.model.ts:112,173` | `@beep/langextract/VerifiedSpan` 17 lines / 7 files (law-practice server `OccurrenceProjection.ts`, `CitationRegexInput.test.ts`; use-cases `CitationEngineLimits.test.ts`, `CitationPrerequisites.test.ts`; lejeune `Normalize.ts`, `Replay.ts`, `Rules.ts`); 2 goal ops scripts (`goals/citation-extraction-engine/ops/check-*.ts`) | SPEC L1: unit conversion moves into `@beep/text` | adapt: re-expressed on the text position in P2 and P3 [D] |
| law-practice `TextQuote`, `SourceRef` | `packages/law-practice/domain/src/values/SourceRef/TextQuote.model.ts:39`, `SourceRef.model.ts:226` | 4 lines / 2 files (`use-cases/src/ClaimSelfCheck.tools.ts`, `DocketIntake/DocketQuestions.schemas.ts`); in-domain `ReviewItem.model.ts`, `Question.model.ts` | report L1: projections of an occurrence; `SourceRef` also carries Box file, page and crop (non-text locator) | adapt: projections of an occurrence in P2 and P3 [D] |
| law-practice `SourceQuote` | `packages/law-practice/use-cases/src/internal/claimEvidence.ts:41` (`readonly [startChar, quote]`, `@internal`) | 10 lines, 1 file (itself) | tuple without `endChar` | adapt: projection of an occurrence in P2 and P3 [D] |
| agent-memory-store `OccurrenceAnchor`, `TextUnit` | `packages/tooling/library/agent-memory-store/src/SpanAnchor.models.ts:35,86` | 20 lines / 7 files inside the package | a second occurrence preimage (`SourceTextIdentity` + unit + `TextAnchor`); stored: the node events (`src/NodeEvent.events.ts`) persist an `OccurrenceAnchor` whose unit literal is `utf16` (`SpanAnchor.models.ts:35`) | adapt in P2: the stored events keep their bytes and P2 derives `OccurrenceId` from the stored anchor at read time, mapping `utf16` to `utf16-code-unit` [Q4] |
| cli Kb `Selector` (`TextQuote { exact, prefix, suffix, start, end }` + media interval) | `packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts:110` | `Kb.service.ts` | quote-and-position in one case; the `TextQuote` case is a text anchor | keep: repo tooling with no consumer in the stack; P7 re-checks it [D] |
| rdf `WebAnnotation*Selector` wire classes | `rdf/src/Adapters/WebAnnotation.ts:60,100,138,174` | in rdf only | the `oa:` codec target | keep [D]; P2 (commit 9) made `WebAnnotationTarget.selector` one or many (`S.ArrayEnsure`, at least one; a single-selector annotation keeps its wire bytes) and added `textAnchorToWebAnnotationTarget` and `webAnnotationTargetToTextAnchor` with the typed `WebAnnotationAnchorRefused` (decision `2026-11-22-p2-text-anchor-oa-codec`) |

---

## g. Identity

Facet table. Usage and construction follow the base method, measured with `rg` (commands
below the table) over tracked TS files outside the owning module, `scratchpad/` and
`.repos/` excluded, import lines (JSDoc `**Example**` imports included) dropped. For a
composer the construction line is a `$<Pkg>Id.create(` call, which mints a module
identity. Covered means a kept package already covers the read: `@beep/identity/Curie`
(`expandOption`, `contractOption`, `expandPredicate`, `makeCurieCodec`, the base of the
one registry codec) for CURIE reads, `@beep/jsonc/JsoncFingerprint` for the canonical-JSON
copies and the PartyKey v1 encoder; no `effect` export models an IRI identity or a CURIE codec. The last two rows sit
in slice packages, outside the `foundation/modeling` scope of rule 2: their dispositions
come from [L0] and the `canonical-digest-owner` encoder census, and their sums record
reach. The inventory after the table is reference detail for these rows.

| Facet | Consumed surface | Upstream / kept-package coverage | Covered | Uncovered | Construction (neutral) | Owner lines / files | Disposition | Semantic loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Path-derived IRIs (216 `$<Pkg>Id` composers exported by `identity/src/packages.ts`; `Id.ts:70-71`) | 3,263 lines / 3,117 files name a composer in files that import `@beep/identity` or `@beep/identity/packages` (`/src/` paths: 2,974 lines); the 46 non-construction lines are composer names in codegen and generator configs, string fixtures and JSDoc, plus direct reads (`.iri` at `apps/labs/semantica/src/layers/RdfProjectionLive.ts:26` and `packages/drivers/exiftool/test/Exiftool.models.test.ts:270`, one `annoteSchema`, one template-tag call, composer guards) | none | 0 | 46 | 3,217 / 3,109 (`$<Pkg>Id.create(`) | `Id.ts` 2,215, `packages.ts` 3,990 | adapt in P1: re-published from the registry (PLAN P1) [D] | none: the module-rename test proves no published IRI changes |
| Duplicate `Curie` types: identity `Curie<V>` (`identity/src/Vocab.ts:445`) with `CurieFromIri` (`identity/src/Curie.ts:454`), rdf branded `Curie` (`rdf/src/Rdf.ts:301`) | identity `Curie`: 2 lines / 1 file (`ontology/src/Fold.models.ts:85,124`, `Curie<CoreVocab>`); `CurieFromIri` 0; rdf `Curie` 0 outside rdf | kept: `@beep/identity/Curie` codec | 2 | 0 | 0 | `Vocab.ts` 598, `Curie.ts` 466, rdf `Curie` in `Rdf.ts` | retire in P1 into the one registry codec [D] | none |
| CURIE parsers (three): identity `expandOption`, `contractOption`, `expand`, `contract`, `expandPredicate`, `makeCurieCodec` (`identity/src/Curie.ts:113-411`); rdf `Curie` syntax check (`rdf/src/Rdf.ts:301`); ontology `registryPrefix` (`ontology/src/internal/Fold.ts:7`) | identity parsers: 15 lines / 4 files, all in `foundation/modeling/ontology/src` (`Fold.assembly.ts` 11, `Fold.models.ts` 2, `Fold.markdown.ts` 1, `Fold.projections.ts` 1); rdf check 0 outside rdf; `registryPrefix` 0 outside ontology (inside: `Fold.models.ts:188`, `Fold.assembly.ts:280`, migrated in the same PR) | kept: `@beep/identity/Curie` codec | 15 | 0 | 0 | `Curie.ts` 466, `internal/Fold.ts` 19 | retire in P1 into the one registry codec [D] | none |
| Slice-local canonical-JSON re-export copies (E1 aliases): `packages/epistemic/domain/src/values/internal/CanonicalJson.ts`, `packages/execution-authority/domain/src/internal/CanonicalJson.ts` | `canonicalJson`, `canonicalJsonResult`: 7 lines / 3 files (`ExecutionRecord.model.ts` 4, `Retention.behavior.ts` 2, `GrantSet.model.ts` 1) | kept: `@beep/jsonc/JsoncFingerprint` (the copies alias `canonicalDetectionJson`, which delegates to it) | 7 | 0 | 0 | 38 + 38 / 2 | retired in P1 (PR A commit 4): both copies deleted; `ExecutionRecord.model.ts` and `GrantSet.model.ts` import `JsoncFingerprint` (`canonicalizeResult`, `canonicalizeSchemaResult`) from `@beep/jsonc`, which moved from dev to runtime dependency while the now unused `@beep/epistemics` edge was dropped; `Retention.behavior.ts` imports `@beep/epistemics/ContradictionDetection`, which delegates to the owner. The third alias, the public `canonicalDetectionJson` re-export of `@beep/epistemic-domain/values/ContradictionDetection` (4 lines / 3 files), retired in the same commit with its consumers re-pointed to `@beep/epistemics/ContradictionDetection` (P1 ruling 7) [L0, D] | none (same bytes: seal goldens, canonical-digest-owner differential and replay) |
| Pinned historical encoders: E5 PartyKey v1 (`party/domain/src/values/PartyKey/PartyKey.behavior.ts:125,153`), E6 eyecite parity (`law-practice/server/src/internal/Citation/RuntimeHashEncoding.ts`, `PublicationResourceHash.ts`, `CaseResourceHash.ts`), the pipe-joined `LogicalEdgeIdentity` key stored in SQL (`foundation/modeling/epistemics/src/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:76,269`) | 39 lines / 4 files: E5 33 / 2 (`party/domain/test/PartyKey.test.ts` 31, `party/server/test/AdapterKeys.test.ts` 2); E6 4 / 1 outside its three files (`ResourceObjects.ts:204-222`); edge key 2 / 1 (`epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:21,243`) | partial: E5 equals `@beep/jsonc/JsoncFingerprint` on its domain (parity test in `PartyKey.test.ts`), so its 33 lines are covered; E6 differs from RFC 8785 on key sorting, ASCII escaping and code-point order, and the edge key is a pipe-joined string, not JSON | 33 | 4 | 2 (`CitationCaseResourceHashInput.make(`, `CitationPublicationResourceHashInput.make(`) | 268 + 419 + 309 / 5 | kept: recorded as pinned in the "Pinned encoders" section of `packages/foundation/modeling/jsonc/README.md`, with the E5 and E6 `biome-ignore` markers and a Gotchas note on `makeLogicalEdgeKey` as in-source anchors [L0] | none |

Facet totals: usage 3,326 lines (composers 3,263, `Curie` types 2, parsers 15, copies 7,
pinned 39); construction 3,219; covered 57; uncovered 50.

Commands (from the repo root; `T <owner>` lists tracked
`*.ts *.tsx *.mts *.cts *.js *.mjs` files outside `packages/foundation/modeling/<owner>/`,
`scratchpad/` and `.repos/`):

```sh
PAT=$(rg -o -P '^export const \$\K[A-Za-z0-9]+Id\b' packages/foundation/modeling/identity/src/packages.ts | sort -u | paste -sd'|')
T identity | xargs rg -l -U "from\s*[\"']@beep/identity(/packages)?[\"']" \
  | xargs rg -n -P "\\\$($PAT)\\b" \
  | rg -v -P '^[^:]+:\d+:\s*(\*\s*)?(import\b|\}\s*from\b|\$\w+Id,?\s*$)' > composer-lines.txt
wc -l < composer-lines.txt; rg -c -P "\\\$($PAT)\\.create\\(" composer-lines.txt
T identity | xargs rg -l -U -P "import\s+(type\s+)?\{[^}]*\b(<names>)\b[^}]*\}\s*from\s*[\"']@beep/identity(/[^\"']*)?[\"']" \
  | xargs rg -n -P '\b(<names>)\b'   # minus import lines; <names> per row
git ls-files -- 'packages/epistemic/domain/*.ts' 'packages/execution-authority/domain/*.ts' \
  | xargs rg -l -P "from\s*[\"'][./]+.*internal/CanonicalJson(\.ts)?[\"']" \
  | xargs rg -n -P '\bcanonicalJson(Result)?\b'
```

**Path-derived IRIs.** `IdentityAuthority = "https://beep-effect.com/ns/"`
(`packages/foundation/modeling/identity/src/Id.ts:77`); `$XId.create(segment).iri`
appends package and module segments (`Id.ts:70-71`). 201 composers in
`identity/src/packages.ts` (`rg -c 'IdentityComposer<"'`). `$...Id.create(` appears on
2,963 lines in 2,862 files under a `/src/` path, `scratchpad/` excluded:
`git grep -cE '\$[A-Za-z]+Id\.create\(' f9982f3b5e6 -- '*/src/*.ts' '*/src/*.tsx' ':!scratchpad'`
(3,257 lines in 3,101 files over every path, `scratchpad/` excluded). Target packages, `src/` only: provenance
3, nlp 13, schema-org 9, ontology 28, rdf 13, epistemics 52 (whole package: ontology 40,
epistemics 58, the rest unchanged). The pin test is `identity/test/IriBinding.test.ts:52-75`
(`@beep/ontology/Ontology.models/HttpUrl`). Related law:
`packages/tooling/tool/cli/src/commands/Laws/RetiredIriAuthorities.model.ts:252`.

**Namespace, prefix and CURIE registries.**

| # | Registry | Path | Namespaces |
| --- | --- | --- | --- |
| 1 | `CoreVocab` | `identity/src/Vocab.ts:130` | dcat, rdf, rdfs, skos, owl, dcterms, schema |
| 2 | `SemanticFoundationVocab` | `identity/src/Vocab.ts:548` | Core + `beep` |
| 3 | `SparVocab` / `SparTerms` | `identity/src/Vocab.ts:590`, `identity/src/internal/generated/SparTerms.ts:21` | Core + cito, deo, doco, fabio |
| 4 | generated rdf term tables | `rdf/src/Vocab/generated/*.terms.ts` (11 files) + `vocab-terms.data.json`, `spar-terms.data.json`; generators `cli/src/commands/SyncDataToTs/targets/VocabTerms.ts`, `SparTerms.ts` | projections of 1 and 3 |
| 5 | hand-written rdf constants | `rdf/src/Vocab/Prov.ts:25`, `Oa.ts:26`, `Xsd.ts:27` | prov, oa, xsd (not in 1-3) |
| 6 | schema.org vocabulary table | `schema-org/src/internal/vocabulary.ts`, `schema-org/src/Vocabulary.ts:140` | schema (third copy) |
| 7 | `IdentityRegistry` service | `identity/src/IdentityRegistry.ts` | runtime rows over composer identities |

Further prefix maps outside the seven: rdf `PrefixMap`/`NamespaceBinding` schemas
(`rdf/src/Rdf.ts:830,860`); JSON-LD context `rdf/src/Adapters/DocumentAnnotation.ts:36-45`;
`ontology/src/Fold.projections.ts:140-149` (rdfs/owl/skos string constants);
`ontology/use-cases/src/aggregates/Session/Session.validation.ts:840`;
`cli/src/commands/Research/Library/Library.ontology.ts:372-377`;
`apps/labs/semantica/src/schema/Reasoning.ts:33-39`; semantica's
`RdfProjectionLive.ts` `BASE`; `apps/labs/ciops/src/projection/Turtle.ts:17-18`
(`https://oip.law/ontology/ci-ops#`); `documents/domain/.../Taxonomy.seed.ts` (redefined
`beep:`); `law-practice/server/src/internal/Citation/SemanticVocabulary.ts:69,109` (asset-loaded).

**`Curie` types (two by that name).** `identity/src/Vocab.ts:445` (`type Curie<V>`) and
`rdf/src/Rdf.ts:301` (`Curie` branded schema); identity also exports `CurieFromIri`
(`identity/src/Curie.ts:454`).

**CURIE parsers (three).** `identity/src/Curie.ts` (`expandOption` `:113`, `expand`
`:266`, `contract` `:314`, closed-world, `makeCurieCodec` `:391`); `rdf/src/Rdf.ts:301`
(syntax check only); `ontology/src/internal/Fold.ts` `registryPrefix`.

**Canonical JSON.** One owner already exists: `@beep/jsonc/JsoncFingerprint`
(RFC 8785, `packages/foundation/modeling/jsonc`), produced by
`goals/canonical-digest-owner` (status `completed-retained`), guarded by the Biome rule
`no-hand-rolled-canonical-json` (`biome.jsonc:395-401`). Its census
(`goals/canonical-digest-owner/research/encoder-census.md`, 157 rows at `4f1ef2168f9`)
lists every encoder. Owner consumers: 53 lines / 20 files.

| Row | Encoder | Class |
| --- | --- | --- |
| E1 | `foundation/modeling/epistemics/src/internal/CanonicalJson.ts` (`canonicalDetectionJson`), aliased by `epistemic/domain/src/values/internal/CanonicalJson.ts` and `execution-authority/domain/src/internal/CanonicalJson.ts` | owner-backed |
| E2 | `cli/src/commands/Goals/PacketCore/PacketDigest.ts` `canonicalJsonText` | owner-backed |
| E3 | `apps/labs/semantica/src/corpus/Canonical.ts` | owner-backed |
| E4 | `foundation/modeling/md/src/Md.render.ts` `renderJson` | owner-backed |
| E5 | `party/domain/src/values/PartyKey/PartyKey.behavior.ts:125-133` | pinned (PartyKey v1) |
| E6 | `law-practice/server/src/internal/Citation/RuntimeHashEncoding.ts`, `PublicationResourceHash.ts`, `CaseResourceHash.ts` | pinned (eyecite parity) |
| E7-E12 | renderers (`PacketDigest` pretty, `OpenclawRender.ts`, `gov-legal-mcp` `ToolNames.ts`, package.json ordering, yaml, one-level sorts) | renderer |

Dependency note: `@beep/identity` has no workspace dependencies; `@beep/jsonc` depends
on identity, schema and utils. Canonical JSON in identity would invert that edge.

**Digest formats.**

| Format | Schema | Mint sites in the stack | Repo-wide use |
| --- | --- | --- | --- |
| `sha256:<64 hex>` | `Sha256PrefixedDigest` (`foundation/modeling/schema/src/Sha256.ts:132`) | provenance `SourceTextDigest` (`SourceTextIdentity.ts:30`; minted `VerifiedTextAnchor.ts:606`), file-processing `ContentDigest` (`Artifact.schema.ts:171`), law-practice `CanonicalSource.ts:146` | 17 lines / 7 files reference the schema; `sha256:` literal construction in 37 src files |
| bare 64 hex | `Sha256Hex` (`Sha256.ts:60`) | `cm1:`/`ca1:`/`cd1:`/`cl1:`/`cg1:` (`law-practice/domain/src/values/Citation/Citation.identity.ts:35,73,100,125,150`; `cm1:` minted `server/src/internal/Citation/MentionIdentity.ts:147`), epistemics `BasisDigest` (`Claim.model.ts:128`), agent-memory-store `ContentHash` (`NodeIdentity.models.ts:113`), law-practice `ContentHash` (`use-cases/src/DocumentIdentification/Identification.schemas.ts:189`) | 2,370 lines / 439 files |
| bare 8-64 hex | party `Digest` (`party/domain/src/values/Ids/Ids.model.ts:391`) | party ids | party slice |

**test-runner pinned IRIs.** `packages/tooling/test-kit/test-runner/src/Vitest.errors.ts`
names `test-utils` on 31 lines (`:16-24`, `:47-56`, through `:151`), as
`https://beep-effect.com/ns/test-utils/Vitest/...` and `beep:test-utils/...`; the
parity test `identity/test/VitestErrorsParity.test.ts:9-34` derives them from
`$TestUtilsId`. `@beep/test-utils` still exists as its own package
(`packages/tooling/test-kit/test-utils`).

---

## h. Pipeline seams

For a seam, usage is the lines outside the owning module that read the site (the
symbol or literal named in the Consumers cell, counted with `rg -n`, import lines
dropped); construction is the `<Schema>.make(` lines among them. No seam has upstream
coverage, so covered is 0 and uncovered is usage minus construction.

| Site | Path | Measured fact | Consumers | Upstream coverage | Covered | Uncovered | Construction (neutral) | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| langextract handoff | `packages/foundation/capability/langextract/src/Handoff/Handoff.behavior.ts` (114 lines), `Handoff.model.ts` (53) | verified capture, minted activity, ExtractionDocument, readings and residual; every parsed candidate retained including over-extraction-cap | IrToLaw and semantica read ExtractionHandoff; semantica grounds historical unmapped-predicate residuals without widening the registry | none | 0 | 0 outside the package (inside: 1 src line, 6 test lines) | 0 | implemented in P3 |
| langextract alignment | `src/Alignment/*` | aligned output carries TextAnchor; handoff verifies the aligner anchor without re-location | `@beep/langextract/Alignment` 6 lines / 4 files (semantica `ExtractorLive.ts`, `canary/RelationPreview.ts`; lejeune `server/provider-smoke.ts`; law-practice `IrToLaw.service.ts`) | none | 0 | 5 | 1 / 1 (`AlignmentSource.make(`) | implemented in P3; alignment keeps its work cap |
| `VerifiedSpan` | `src/VerifiedSpan/*` (with Alignment 3,560 lines) | offset types and conversion deleted; callers use text Position and convertPosition refusals | 17 lines / 7 files (f) | none | 0 | 14 | 3 / 2 (`TextOffsetRange.make(`) | implemented in P3; location remains in langextract |
| semantica projection | `apps/labs/semantica/src/layers/RdfProjectionLive.ts` | predicate IRI per claim `${BASE}predicate/${claim.id}` (`:79`); claim quads omit anchor, quote, receipt; sorts via `Rdf.sortDatasetQuads` (`:114`); reads semantica's `EvidenceBatch`, not `AnnotatedDocument` | `RdfProjectionLive` and `semanticaOntologyIri` 7 lines / 4 files (`src/runtime/Layer.ts:89`, `src/canary/RuntimeProbeChild.ts:67`, `src/layers/CanaryC2Live.ts:57`, `test/Projection.test.ts` 4); `ProjectionExpectation.test.ts` reads the gold fixture | none | 0 | 7 | 0 | adapt [D] |
| semantica `1` default | `apps/labs/semantica/src/layers/ExtractorLive.ts:238-239` (`O.getOrElse(() => 1)`) | `evidenceConfidence` is called at `:537` and `:628`; a second `O.getOrElse(() => 1)` at `:722` defaults pattern-wink entity confidence | `test/Extractor.test.ts` | none | 0 | 4 (`:239`, `:537`, `:628`, `:722`) | 0 | retire: delete, guard with `Extractor.signals.test.ts` |
| gold fixture | `apps/labs/semantica/fixtures/gold/v1/g-projection.json` | read by `src/schema/Projection.ts`, `src/layers/CanaryC1Live.ts`, `test/Projection.test.ts`, `test/ProjectionExpectation.test.ts` | 4 files; 2 lines read the file (`CanaryC1Live.ts:239`, `ProjectionExpectation.test.ts:22`) and do not change | none | 0 | 2 | 0 | adapt: regenerate after the `Dataset` quotient [D] |
| office-action `0.9` | `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:95` | `confidence: 0.9` | `server/src/Layer.ts` (`OfficeActionReviewLayer`), `server/test/LawPracticeServer.test.ts` | none | 0 | 1 (`:95`) | 0 | retire: delete, guard with `OfficeActionReview.signals.test.ts` |
| docket unavailable text | `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:278-286` | `isUnverifiable = hasDocuments && O.isNone(documentText)` (`:280`) short-circuits `citedSpanExists` (`:282-286`) | `DocketReview.policy.test.ts` | none | 0 | 2 (`:280`, `:283`) | 0 | adapt (three-valued result) |
| `IrToLaw` ports | `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:6-14` | checked ExtractionHandoff input; least Mention by position and id, first reading model text; error wire unchanged | office-action review constructs the capture; deterministic Tika scaffold declares text-scaffold/1 | none | 0 | 10 | 0 | implemented in P3 |
| citation mention identity | `packages/law-practice/server/src/internal/Citation/MentionIdentity.ts` (148 lines) | preimage tuple `citation-mention/v1`, `engineArtifact` (Sha256Hex), `semanticKind`, `scopeRef`, `sourceRef`, `locator`, `sourceDigest`, `textDigest`, extractor name and version, `normalizationVersion`, `startChar`, `endChar`, `quote` (schema `:86-108`, values `:127-142`); no offset unit; minted `cm1:${digest}` (`:147`) | `Document.ts:36,372`; ids typed by `CitationMentionId` (`domain/src/values/Citation/Citation.identity.ts:35`) across `CallbackSession.ts`, `CallbackObservations.ts`, `ResourceIdentity.ts`, `SessionDocument.ts`, `AuthorityIdentity.ts`; `makeCitationMentionId`, `CitationMentionIdentityInput` and `CitationMentionIdentityFailure` 27 lines / 4 files outside the file (`Document.ts` 1, `Mention.ts` 2, `test/CitationMentionIdentity.test.ts` 23, `test/CitationMention.test.ts` 1) | none | 0 | 25 | 2 / 1 (`CitationMentionIdentityInput.make(`) | adapt (P0 item 1) |
| citation resource identity | `server/src/internal/Citation/AuthorityIdentity.ts` (180 lines, `ca1:` at `:179`) | separate from occurrence identity | as above | n/a | n/a | n/a | n/a | keep |
| `cm1:` persistence | no database table, column or migration holds `cm1:` ids (0 matches in `packages/_internal/db-admin/drizzle`, `packages/*/tables`); they live in citation document receipts (`projectCitationDocumentReceipt` `Document.ts:340`, `restoreCitationDocument` `:395`; in-repo caller `SessionDocument.ts`) | fixtures: `use-cases/test/fixtures/eyecite/authority-identity-cases.json` (13 occurrences); tests: 7 server files (11 occurrences), 2 domain files (7) | `cm1:` literal lines: 31 / 10 files (the fixtures and tests to its left) | none | 0 | 31 | 0 | adapt: migrate fixtures and receipts in the P2 PR |

Seam totals (retire and adapt rows): usage 107 lines, construction 6, covered 0,
uncovered 101.

Persisted anchor-bearing columns (the persisted-bytes clause, chapter 11 rule 5):
`epistemic_evidence.span` jsonb (an encoded `EvidenceSpan`: anchor fields plus
`confidence`, not a bare `TextAnchor`; kept byte for byte when P4 deletes `EvidenceSpan`,
read through a declared read-time transform from the current and legacy stored shapes,
proved by a frozen old-row fixture [D]) and
`epistemic_evidence_verification.verified_anchor` jsonb
(`packages/_internal/db-admin/drizzle/20260813130540_baseline/migration.sql:267,284`);
`law_practice_legal_position_relator.grounding` and
`law_practice_patent_citation_event.grounding` jsonb (`:459,480`;
`TextAnchorVerificationReceipt`, `law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.model.ts:81`).
Stored outside the database: the agent-memory-store node events
(`packages/tooling/library/agent-memory-store/src/NodeEvent.events.ts:78`) persist an
`OccurrenceAnchor` with unit literal `utf16`; they keep their bytes and P2 derives
`OccurrenceId` from the stored anchor at read time [Q4]. The cli `Kb` and `Holds`
claim files persist `ClaimVersion` rows (section i).

---

## i. `@beep/epistemics` (facets moved, folded or retired)

Owner `packages/foundation/modeling/epistemics`: 16 subpath modules, 5,160 lines under
`src/*/`.
Consumers outside the package: 62 files (35 src, 17 test, 2 other, 8 apps), 115
import-statement lines, 173 usage lines; scratchpad 37 files, 170 lines. The facets
below are the ones P0 decisions move, fold or retire; every other export is kept and is
not listed. Counts use the same import-clause counter as the other sections.

| Facet | Consumed surface (lines / files) | Upstream coverage | Covered | Uncovered | Construction (neutral) | Owner lines / files | Disposition | Semantic loss |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Absent-value carrier: `makeSignal`, `AbsenceReason`, `Measurement` (`Claim/Claim.model.ts:39,69,94`) | 0 / 0 outside the package; inside: 13 code lines of `Claim.model.ts` (`makeClaimEnvelope` builds `EvidenceSignals` from them), 0 test lines | none (`effect/Option` has no reason-bearing absence) | 0 | 0 | 0 | `Claim.model.ts:24-110` | moved in P4 (row 2): `makeSignal`, `AbsenceReason` and `Measurement` ship from `@beep/schema/Signal` [D] | none |
| `StructuralVerdict` (`Claim.model.ts:157`) | 1 / 1 (`party/domain/test/Party.competency.test.ts:76`) | none upstream; kept-package target `ClaimGateResult` (`ClaimGate/ClaimGateResult.model.ts:135`) | 0 | 1 | 0 | `Claim.model.ts:140-168` | deleted in P4 (row 6): `ClaimGateResult` carries the same verdict with typed violations (`research/status-census.md`) [Q2, D] | yes: `_tag` `Admitted` / `ShapeRejected` becomes `verdict` `admitted` / `rejected`, and `violations` changes from a non-empty string array to an array of `ClaimGateViolation` |
| `ReviewTag` (`Claim.model.ts:186`) | 1 / 1 (`party/domain/src/policies/Projection/Projection.behavior.ts:50`) | none | 0 | 1 | 0 | `Claim.model.ts:170-196` | adapted in P4 (row 6): derived from the `ReviewState` union cases, selection only (`research/status-census.md`) [Q2] | none |
| `EvidenceSpan` (`EvidenceSpan/EvidenceSpan.model.ts:147`) | 22 / 10 (f, row 2) | none | 0 | 13 | 9 / 6 (`EvidenceSpan.make(`) | `EvidenceSpan.model.ts` 240 / 1 | deleted in P4 (row 5, b61b79aa79f) as an in-memory encoding; the stored-column reader is kept as `EvidenceRow` [D] | confidence leaves the anchor; stored `epistemic_evidence.span` holds an encoded `EvidenceSpan` (anchor fields plus `confidence`) and keeps its bytes; the epistemic tables package keeps a declared read-time transform from the current and legacy stored shapes to the text position plus an extractor-confidence signal, proved by a frozen old-row fixture. Today's readers: `EvidenceVerification.converters.ts:77` (tables) and `ContradictionTriage.repo.ts:645` (server) |
| `Confidence` (same subpath, `EvidenceSpan.model.ts:48`) | 25 / 13 (semantica 13 / 6) | none (an annotated `@beep/schema/UnitInterval`, `EvidenceSpan.model.ts:48`) | 0 | 9 | 16 / 11 | (in `EvidenceSpan.model.ts`) | kept: ships from `@beep/epistemics/Confidence` since P4 row 2, with `ReportedConfidence` | none |
| `makeClaimEnvelope` and its `ClaimVersion` (`Claim.model.ts:276`) | 10 / 3: `makeClaimEnvelope` 3 (`party/domain/src/entities/Claim/Claim.model.ts:13`, `cli/src/commands/Kb/Kb.schemas.ts:210`, `cli/src/commands/Holds/Holds.schemas.ts:407`) and envelope member reads 7 (party 5: `ClaimVersion`, `EvidenceSignals`, `ReviewState`, `DependenceAssessment`, `ReviewerDisposition`; `Kb.schemas.ts:232`, `Holds.schemas.ts:435`). Derived reach (rule 1): party-domain `ClaimVersion` 26 / 7 outside `party/domain` (construction 10 / 4), 29 lines inside it; cli `KbClaim` and `HoldClaimVersion` 74 lines / 11 files | none | 0 | 10 | 0 | `Claim.model.ts:240-371` | deleted in P4 (row 6, 2ced3e0a632): every consumer stores a `makeClaimCore` core plus separate records; stored `ClaimVersion` rows read through private format-named v1 readers [D] | `ClaimVersion` carries `supersedes`, which moves into the hashed claim core (item 3 amended); stored rows keep their bytes behind a read-time transform. No database column stores a `ClaimVersion` (0 matches for `claim_version` or `claimVersion` in `packages/_internal/db-admin/drizzle`); the stored rows are the cli `Kb` `claims.jsonl` (`Kb.service.ts:289`) and the `Holds` claims file (`Holds.service.ts:173,210`) |

Facet totals (retire and adapt rows): usage 34 lines (carrier 0, `StructuralVerdict` 1,
`ReviewTag` 1, `EvidenceSpan` 22, envelope 10); construction 9; covered 0; uncovered 25.
The kept `Confidence` row is outside the sums. `EvidenceSpan` is counted here and in f,
row 2; count it once.

---

## S31 inventories

Entry count is the number of lines in the file that name a path under the package
(`grep -cE "packages/foundation/<kind>/<pkg>/" <file>`); for the coverage baseline that
equals its per-file entries. Base commit as above.

| Inventory | provenance | nlp | schema-org | ontology | rdf | identity | epistemics | nlp-processing | langextract |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `standards/coverage.regression-baseline.jsonc` | 4 | 29 | 15 | 13 | 38 | 8 | 36 | 50 | 23 |
| `standards/schema-first.inventory.jsonc` | 0 | 1 | 1 | 5 | 0 | 0 | 1 | 2 | 0 |
| `standards/effect-laws.allowlist.jsonc` | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `packages/tooling/policy-pack/repo-configs/src/internal/laws/generated/EffectLawsAllowlistSnapshot.ts` (generated mirror) | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `standards/fallow.health.regression-baseline.jsonc` | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 1 | 0 |
| `standards/fallow.boundaries.provenance.jsonc` (one generated rule per package) | 1 | 1 | 0 | 1 | 1 | 1 | 0 | 1 | 1 |
| `.fallowrc.jsonc` | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 |
| `.gitleaks.toml` (allowlist) | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 0 |
| `_typos.toml` (excludes) | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `biome.identity.jsonc` (includes) | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| `packages/tooling/policy-pack/lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts:72-74` (per-file allowance) | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `standards/effect-vitest.inventory.jsonc` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `standards/fallow.dead-code.regression-baseline.jsonc`, `fallow.pilot.inventory.jsonc`, `check-census.regression-baseline.jsonc`, `jsdoc-totals.regression-baseline.jsonc`, `test-typecheck.blindspot-baseline.jsonc`, `entity-kit-freeze.baseline.jsonc`, `goals/knowledge-doctor.baseline.jsonc`, `.gitleaksignore`, `biome.jsonc`, `.oxlintrc*.json` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| in-package suppressions (`biome-ignore`, `oxlint-disable`, `@ts-expect-error`, `@ts-ignore`, `fallow-ignore`; move by rename) | 0 | 0 | 3 | 0 | 8 | 8 | 0 | 2 | 1 |

Reproduce a row: `grep -cE "packages/foundation/(modeling|capability)/<pkg>/" <file>`;
suppressions: `git ls-files packages/foundation/<kind>/<pkg> | xargs grep -cE "biome-ignore|oxlint-disable|eslint-disable|@ts-expect-error|@ts-ignore|fallow-ignore"`.
`standards/schema-first.inventory.jsonc` also keys entries by `"owner": "@beep/<pkg>"`
(same counts). `.beep/` holds no tracked files (`git ls-files .beep` is empty).

Generated per-package artefacts that a rename or deletion rewrites (not exception
lists; listed so they are regenerated, not hand-edited): `standards/cache-baseline/@beep/<pkg>.json`
(one per package; files naming the package: provenance 18, nlp 8, schema-org 1,
ontology 2, rdf 19, epistemics 14, nlp-processing 5, langextract 5, identity 200),
`standards/schema-catalog/@beep/<pkg>.generated.jsonc` (rows: provenance 10, nlp 67,
schema-org 22, ontology 66, rdf 98, identity 13, epistemics 14, nlp-processing 56,
langextract 44), `standards/instrumentation-catalog/@beep/<pkg>.generated.jsonc`
(present for all except rdf and epistemics), `standards/fallow.boundaries.generated.jsonc`
(owner references: provenance 40, nlp 20, schema-org 4, ontology 8, rdf 42, identity
402, epistemics 32, nlp-processing 14, langextract 12), `standards/policy-tools.fingerprint.json`,
`turbo.json` input lists, `tsconfig.packages.json`. Registration tables in code that
name packages: `cli/src/commands/Ci/CiLanePartitions.ts`, `cli/src/commands/Quality/internal/CoverageScope.ts`,
`identity/src/packages.ts`, `identity/test/shape-stable.test.ts`.

---

## Matter wall access-path map

Scope today is `SourceTextIdentity.scopeRef` ("opaque matter or tenant scope
reference", `provenance/src/SourceTextIdentity.ts:127-129`) plus `orgId` columns in a
few repositories. "Checked" below means the code compares a caller-independent
authority to the requested scope; equality between two caller-supplied values is
recorded as a consistency check.

| Access path | Owning code today | Matter or org scope | Test layer that would host the assertion |
| --- | --- | --- | --- |
| Source retrieval | port `SourceTextResolver` (`@beep/file-processing/SourceText`); implementation `packages/workspace/server/src/SourceText/WorkspaceSourceTextResolver.ts:152-207` (maps `scopeRef` `workspace:<id>` to a vault); law-practice callers `server/src/internal/Citation/SourceEvidence.ts`, `SourceRequest.ts`, `use-cases/src/CandorPolicy/CandorPolicy.service.ts:136`; Box reads `apps/practice-gateway/src/BoxDriveTools.ts` (path confined to the Box folder) | resolver checks that the scope names a workspace and a vault exists; no caller-principal check; Box tools confine paths, not matters; 0 scope matches in `SourceEvidence.ts` | server tests stub the port with `SourceTextResolver.of` (`server/test/CitationSourceEvidence.test.ts:27-38`); `LawPracticeServerLive` provides it through `FileProcessingLayer` (`server/src/Layer.ts:88`) |
| Anchor resolution | `provenance/src/VerifiedTextAnchor.ts:594` (`expectedSource.scopeRef` equals `source.scopeRef`), law-practice `server/src/internal/Citation/SourceResolution.ts`, `ResolutionInput.ts`, `OccurrenceProjection.ts` | consistency check only (both sides from the caller); 0 scope matches in `SourceResolution.ts` | citation tests call `verifyTextAnchor*` directly (`server/test/CitationMention.test.ts`, `CitationMentionIdentity.test.ts`, `CitationDocumentPersistence.test.ts`, `CitationResolve.fixtures.ts`); no server layer |
| Graph query | Practice KG over DuckDB: `server/src/PracticeKg.queries.ts`, `PracticeKg.tool-handlers.ts`, `PracticeKgHost/*`, served by `apps/practice-kg-mcp`; epistemic `packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.layer.ts` | Practice KG: none (0 matches for `scopeRef\|orgId\|matterId\|tenant\|authoriz` in `PracticeKg.queries.ts` and `PracticeKg.tool-handlers.ts`; matter is data, `kg_matter_lookup` resolves references); epistemic triage filters evidence by `ContradictionReviewScope.sourceScopeRef` and `orgId` (`ContradictionTriage.layer.ts:113-144`) | `server/test/PracticeKgHost.test.ts` composes `MemoryFileSystem.layer` + `BunPath.layer`; Practice KG is not in `LawPracticeServerLive` |
| Search and vector filtering | BM25 full text `server/src/PracticeKg.fts.ts`; vectors: absent in law-practice (no embedding or vector index under `packages/law-practice/**/src`); lab only `apps/labs/semantica/src/layers/VectorProjectionLive.ts` | none in `PracticeKg.fts.ts` (0 matches); semantica none | `server/test/PracticeKg.projections.test.ts` (the only test importing `buildDuckDb`/`GraphTextSourceSpec`) |
| Cache lookup | citation session caches `server/src/internal/Citation/Resolve.ts`, `SessionDocument.ts`, `RuntimeDictionary.ts`, `RuntimeSet.ts`; lab `apps/labs/semantica/src/services/ProviderCache.ts` | keyed by resource identity and content, no scope (0 matches in `Resolve.ts`, `SessionDocument.ts`, `ProviderCache.ts`) | `server/test/CitationEngineLayer.test.ts` composes `citationTokenizerTestLayer` + `BunCrypto.layer` (`:49,235`) |
| Draft assembly | `server/src/NoticeMailbox/NoticeMailbox.layer.ts:303` (`m365.createDraftMessage`), `server/src/MailTagging/MailTagging.mailbox.ts`, `server/src/DocketIntake/DocketIntake.graph.ts`, `use-cases/src/ClaimSelfCheck/ClaimSelfCheck.service.ts` | none in `NoticeMailbox.layer.ts` (0 matches); the mailbox identity is configuration | `server/test/NoticeMailbox.test.ts:62` composes `makeNoticeMailboxLayer(...)` with `fakeMailbox` |
| Provenance traversal | absent as a service: `rdf/src/Prov.ts` and `ProvRdf.ts` have no production consumer outside rdf (0 scope matches in `ProvRdf.ts`); nearest traversals are the epistemic evidence view (`ContradictionTriage.layer.ts:113-136`, scoped) and Practice KG `PracticeKg.projections.ts` provenance columns (unscoped) | epistemic: `sourceScopeRef` filter; law-practice: none | epistemic server integration tests (`packages/epistemic/server/test/integration/ContradictionTriage.pglite.test.ts`); no law-practice layer |

Org-scoped repositories that already isolate tenants: `server/src/CandorRecord/CandorRecord.repo.ts:93-109,251-324`
and `server/src/LegalPositionRecord/LegalPositionRecord.repo.ts:104-138,275-316`
(`orgId` on every read), tested by `server/test/CandorRecord.pglite.test.ts` and
`LegalPositionRecord.pglite.test.ts` (Drizzle over PGlite, `:67-69`).
`server/src/OfficeActionStructure/OfficeActionStructure.repo.ts:29,105` keys history by
`scopeRef` (partition key, not authorization).

`LawPracticeServerLive` (`server/src/Layer.ts:77-91`) composes `OfficeActionReview`,
`IrToLaw`, `FileProcessingLayer`, the guarded LangExtract layer and
`EpistemicServerLive`; `server/test/LawPracticeServer.test.ts:59-63` adds a stub
`LanguageModel`, a `ConfigProvider` and `BunCrypto.layer`. It does not include the
Practice KG, the citation engine, `NoticeMailbox`, `CandorRecord` or
`LegalPositionRecord`, so a `MatterWall.two-matter.test.ts` composing it reaches only
source retrieval (through file processing) and the office-action review path.

---

## Corrections to the report

Against `research/2026-11-08-rebuild-report.md` §2 and SPEC Target Surfaces, at the
base commit:

1. **Canonical JSON already has one owner, outside identity.** SPEC puts canonical
   JSON in `identity` (L0) and the L0 row asks for "one canonical JSON
   implementation". `@beep/jsonc/JsoncFingerprint` (RFC 8785) is that owner since
   `goals/canonical-digest-owner` closed; the remaining encoders are pinned (E5
   PartyKey v1, E6 eyecite parity) or renderers. `identity` has no dependencies and
   `jsonc` depends on it, so "canonical JSON in identity" means moving the owner below
   jsonc or dropping the claim.
2. **`cm1:` records are not persisted in any table.** "Existing records are re-minted
   by a migration" has no database target: no migration, table or column holds
   `cm1:` ids; they live in citation document receipts and in fixtures (13 in
   `authority-identity-cases.json`, 18 in 9 test files). The persisted anchor bytes are
   elsewhere: `epistemic_evidence.span`, `epistemic_evidence_verification.verified_anchor`,
   `law_practice_legal_position_relator.grounding`, `law_practice_patent_citation_event.grounding`.
3. **The `cm1:` preimage binds more than §2.1 lists.** It also binds `engineArtifact`
   (the engine's content hash) and `semanticKind`, plus extractor name and version and
   `normalizationVersion`, and has no offset unit (`MentionIdentity.ts:86-108,127-142`). An
   occurrence preimage without the engine and kind merges mentions that two engines,
   or two citation kinds, find at one range: a semantic-loss row for P0 item 1.
4. **More anchor encodings exist than D2 counts.** Besides the five, the tree has
   langextract `TextOffsetRange`/`Utf16TextRange`, law-practice `TextQuote`/`SourceRef`
   and `SourceQuote`, agent-memory-store `OccurrenceAnchor` (a second occurrence
   preimage), and the cli Kb `Selector`. SPEC item 2's "only occurrence identity" also
   collides with party's `OccurrenceId` (`party-occ:`). P2 renamed it `ArtifactOccurrenceId`.
5. **The rdf selectors have no consumer.** `TextQuoteSelector`, `TextPositionSelector`,
   `EvidenceSelector` and rdf's `EvidenceAnchor` are imported by no package or app;
   only rdf's own adapter and tests use them.
6. **`@beep/nlp` has facets the plan never routes.** `Core` (217 usage lines in 33
   files, mostly `drivers/wink` and `nlp-processing`) and the four text helpers
   (`IdentifierText`, `PathText`, `QueryText`, `VariantText`, 0 consumers) have no
   target in SPEC or the report; retiring `@beep/nlp` needs a home for `Core` or a
   decision to move it with the wink driver.
7. **The L5 home already duplicates the facets it absorbs.** `nlp-processing` has its
   own `makeOperation` (`src/Graph/TypeClass.ts:83`, 1,031 lines, consumed only by its
   test), `GraphOperations/Operation.ts` and `EffectGraph.ts`; its spans are labelled
   `@beep/nlp` (`src/internal/observability.ts:16`). The absorption is a three-way merge,
   not a move.
8. **Neither named reader uses the annotation document today.** SPEC item 3 says
   "`IrToLaw` and the semantica projection read it"; neither does now.
   `RdfProjectionLive` reads semantica's own `EvidenceBatch`; the only reader of
   `LangExtractResult.annotatedDocument` is a langextract test. `@beep/langextract/Handoff`
   has 0 importers outside the package.
9. **`nif:` and `gufo:` do not occur anywhere in code.** Constraints and L6 speak of
   "registry-backed `nif:`"; there is nothing to migrate, only entries to add.
10. **The legal seeds have no consumer.** `Vocabulary.seed.ts`, `SemanticFoundation.seed.ts`,
    the six `src/seed/*` files and the FOLIO DTOs (`Ontology.models.ts`) are imported by no
    package outside `@beep/ontology`; the only external consumer of the package is the cli
    research library (fold and Turtle). No law-practice asset pack exists; the only
    manifested pack is `explorations/legal-ontology-landscape/assets/`.
11. **The fold's consumer already builds a second Dataset.** `fold -> Dataset` "as the
    only serialization path" must also retire cli `Library.ontology.ts:353`, which builds
    its own `Dataset` from quads beside `toTurtle`.
12. **The `rdf -> md` edge has no consumer.** `MdSections` is used only by rdf's
    `DocumentAnnotation.test.ts`; removing the edge is a move or deletion with no consumer
    migration.
13. **`@beep/schema-org` has no package.json dependent either**, not only no runtime
    import; the nearest real need is `apps/oip-web/src/content/OipSeo.ts`, which builds
    schema.org JSON-LD by hand.
14. **"One digest format" is repo-wide, not stack-wide.** `Sha256Hex` (bare hex) appears on
    2,370 lines in 439 files; `Sha256PrefixedDigest` on 17 lines in 7. Inside the stack the
    two formats meet in one record: `cm1:` hashes a preimage that contains prefixed
    `sourceDigest`/`textDigest` and emits bare hex.
15. **The two-matter test cannot reach seven paths through `LawPracticeServerLive`.**
    That layer omits the Practice KG, citation engine, mailbox and record repositories;
    vector search is absent in law-practice, and provenance traversal has no law-practice
    owner. P6 needs either a wider server layer or one assertion per owning layer.
16. **`test-utils` is still a package.** D4 says the pinned IRIs sit "under a package now
    called `test-runner`"; the IRIs are in `test-runner` source, and `@beep/test-utils`
    still exists (`packages/tooling/test-kit/test-utils`); the parity test derives them from
    `$TestUtilsId` on purpose (`VitestErrorsParity.test.ts:9`).
17. **Line drift.** The glossary's canonical-`TextAnchor` sentence is at
    `standards/architecture/GLOSSARY.md:433` (report: `:302-307`); "law-practice keeps
    `LegalRole`" is at `DECISIONS.md:2324` (report: `:2322`); the docket check is
    `DocketReview.policy.ts:280-286` with the condition at `:280`.
18. **Confirmed unchanged since 2026-11-08:** handoff id re-minting and empty relations;
    `ExtractorLive.ts:238-239`; `OfficeActionReview.service.ts:95`; the stale `IrToLaw`
    reason; `Dataset` as a list; tagged `xsd:string` asserted by tests; `Prov.ts` with one
    production consumer and four test files; the seven registries, two `Curie`s and three
    CURIE parsers; the fold importing only `IRI` and `LanguageTag` from rdf
    (`Fold.models.ts:17-18`, `Fold.assembly.ts:16-17`); `THEORY.md:72` citing a module in
    `nlp-processing`; `Taxonomy.seed.ts` and `LegalRole.model.ts` re-declaring seed
    vocabularies.

## Unmeasured

- Escaping parity between `schema-org` `toScriptBody` and `@beep/html/Html.script`: no
  shared test exists to compare against; measuring it would need new code.
- `.quads` reads are a name match; reads of unrelated `.quads` fields are not separated.
- Construction counts for `nlp` Core names are limited to files that import `@beep/nlp`;
  a same-named `Document.make` from another package in one of those files would be
  counted.

P3 outcome (2026-11-22): the historical counts above remain the P0 measurement.
At the P3 content head, Handoff and Ontology each have zero source files and zero
package/app import sites; Graph Span has zero declarations. The contract retirement
removes 597 source lines and Ontology removes 714 from the P3 base. UnitInterval
has zero nlp Handoff import sites. These deletions do not change the ADAPT verdict:
Graph node carriers, Core and Operations remain for P6. No count is inferred for
new annotation consumers from the historical P0 usage totals.

P6 outcome (2026-11-24): Core and the Graph node schemas moved to `@beep/nlp-processing`
by `git mv`, `CharPosition` is deleted and `Token.span` is a `@beep/text` position.
Operations, Algebra and `GraphOps` are deleted from `@beep/nlp` with zero consumers;
`nlp-processing/src/Operation.ts` is the one operation arrow and `Graph/TypeClass.ts` is
deleted with it. `@beep/nlp` keeps only the four P7 text brands
(`IdentifierText`, `PathText`, `QueryText`, `VariantText`) and `THEORY.md`, which P7
retires with the package.
