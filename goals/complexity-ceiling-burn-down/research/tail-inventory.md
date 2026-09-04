# Tail Inventory — functions above cognitive 15

## P0 refresh — 2026-09-03

Live command:

```sh
bun run fallow:health --format json --quiet --complexity-breakdown
```

Fallow 3.22.0 analyzed 4,361 files and 65,040 functions in the P0 refresh. The refreshed tail is
49 functions: 44 unwaived findings plus five functions already covered by
active, review-dated `thresholdOverrides`. The old 2026-07-30 snapshot carried
60 functions; 17 old function identities are no longer above 15, while five
post-calibration override identities and the moved SHACL validator entered the
refreshed set.

`Hotspot` is the one-based rank in the full 1,877-row `health.hotspots` result;
`—` means the new path had no qualifying Git-history row. `executed` means the
verdict has now landed in this branch as a real refactor or a review-dated
override in `.fallowrc.jsonc`.

| # | Cog | Cyc | Lines | Function | Location | Hotspot | Verdict |
| ---: | ---: | ---: | ---: | --- | --- | ---: | --- |
| 1 | 108 | 42 | 222 | `scanSchemaFirstInventory` | `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts:94` | 431 | **refactor (executed):** separate the per-source declaration, call-expression, property, and function-like detector passes; keep one inventory accumulator. |
| 2 | 75 | 33 | 208 | `runEffectImportRules` | `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:117` | 98 | **refactor (executed):** extract root-import and stable-submodule rewrite passes with one file-level result accumulator. |
| 3 | 73 | 40 | 178 | `runLintToolingSchemaFirst` | `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:237` | 10 | **refactor (executed):** separate per-file policy collection from required-tagged-union discovery and final reporting. |
| 4 | 61 | 39 | 119 | `collectExportedDeclarationCandidates` | `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts:409` | 706 | **refactor (executed):** give export assignments, named export declarations, and exported statements independent collectors before dedupe. |
| 5 | 50 | 29 | 223 | `runTerseEffectRules` | `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:592` | 30 | **refactor (executed):** extract the arrow, call, spread, and overload detector passes and merge their typed file results. |
| 6 | 49 | 50 | 281 | `root` | `packages/foundation/ui-system/ui/src/themes/components/button.ts:73` | 705 | **refactor (executed):** bind the effective palette once and centralize size/touch padding construction; repeated `(theme.vars \|\| theme)` and size arithmetic are real duplicated concepts. |
| 7 | 47 | 17 | 130 | `validate` | `packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts:84` | — | **refactor (executed):** extract focus-node selection and property-shape constraint evaluation while preserving the bounded-result early exit. |
| 8 | 46 | 28 | 163 | `animate` | `packages/foundation/ui-system/ui/src/components/live-waveform.tsx:341` | 183 | **refactor (executed):** separate audio sample acquisition, static/scrolling data updates, and mode-specific bar rendering. |
| 9 | 44 | 14 | 109 | `generateAnalysisReport` | `packages/tooling/tool/cli/src/commands/Docgen/Docgen.render.ts:267` | 475 | **refactor (executed):** compose named header, checklist/findings, and summary renderers. |
| 10 | 43 | 49 | 149 | `validateMonitorGuards` | `packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts:140` | 281 | **refactor (executed):** express flag-combination rejections as a declarative guard table, then retain the two effectful hosted checks. |
| 11 | 42 | 10 | 224 | `Scene` | `packages/foundation/ui-system/ui/src/components/orb.tsx:129` | 397 | **override (executed):** hook/prop integration owns one Three.js scene lifecycle; the frame callback is refactored separately, while splitting hooks or grouping the public props would be appeasement/API change. Review by 2026-12-03. |
| 12 | 39 | 5 | 464 | `LiveWaveform` | `packages/foundation/ui-system/ui/src/components/live-waveform.tsx:80` | 183 | **override (executed):** 19 hook bindings and 17 props are the component integration boundary; execute the teardown and animation seams without fragmenting hook ownership. Review by 2026-12-03. |
| 13 | 34 | 33 | 123 | `collectPgModelState` | `packages/ecosystem/effect-drizzle/src/pg/model.ts:574` | 794 | **override (executed):** pre-existing attribution artifact from PR #651; `.fallowrc.jsonc` review by 2026-11-30. |
| 14 | 33 | 16 | 59 | `collectOutlineEntries` | `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:610` | 82 | **refactor (executed):** normalize supported top-level statements and class members through named collectors. |
| 15 | 29 | 30 | 178 | `root` | `packages/foundation/ui-system/ui/src/themes/components/chip.ts:33` | 815 | **refactor (executed):** bind the effective palette once and construct size/touch variants from a colocated table. |
| 16 | 28 | 31 | 98 | `collectSqliteModelState` | `packages/ecosystem/effect-drizzle/src/sqlite/model.ts:532` | 853 | **override (executed):** pre-existing attribution artifact from PR #651; `.fallowrc.jsonc` review by 2026-11-30. |
| 17 | 27 | 25 | 113 | `LinkPreview` | `packages/foundation/ui-system/ui/src/components/link-preview.tsx:289` | 27 | **override (executed):** atom-backed fetch state and tooltip conditional mounting form one cohesive preview boundary; extraction would only redistribute JSX branches. Review by 2026-12-03. |
| 18 | 27 | 25 | 142 | `TodoItem` | `packages/foundation/ui-system/ui/src/components/todo-item.tsx:115` | 224 | **override (executed):** the score is dominated by the stable public prop surface and conditional metadata rendering; grouping props changes API and splitting the row fragments one item view. Review by 2026-12-03. |
| 19 | 25 | 15 | 102 | `runReflectionArtifactLint` | `packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts:272` | 503 | **refactor (executed):** extract per-goal reflection inspection and typed report rendering. |
| 20 | 24 | 17 | 141 | `Sidebar` | `packages/foundation/ui-system/ui/src/components/sidebar.tsx:247` | 650 | **override (executed):** non-collapsible, mobile, embedded, and fixed layouts are the explicit responsive contract; extracting them duplicates shared state/props for the metric. Review by 2026-12-03. |
| 21 | 24 | 17 | 95 | `reportInvariantDiagnostics` | `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:1506` | 21 | **refactor (executed):** compose independent OK-envelope, failure-envelope, and exit-status invariant checks. |
| 22 | 24 | 16 | 80 | `parseQuotedField` | `packages/foundation/modeling/schema/src/CsvParser/CsvParser.parser.ts:122` | 306 | **override (executed):** one CSV quote/escape/closing-delimiter state machine; splitting cursor transitions would weaken auditability. Review by 2026-12-03. |
| 23 | 23 | 12 | 131 | `planPackageReferenceSync` | `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:827` | 107 | **refactor (executed):** extract one-workspace dependency/reference plan and keep the outer traversal/reporting flat. |
| 24 | 23 | 11 | 93 | `exportRecordViolations` | `packages/tooling/tool/cli/src/commands/Lint/SchemaTopology.ts:157` | 61 | **refactor (executed):** replace repeated key/target predicates with ordered policy descriptors and one violation constructor. |
| 25 | 23 | 11 | 34 | `publishSteps` | `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:706` | 22 | **refactor (executed):** use a `Match`-based publish-mode branch instead of the nested conditional expression. |
| 26 | 23 | 2 | 151 | `SpeechInput` | `packages/foundation/ui-system/ui/src/components/speech-input.tsx:174` | 352 | **override (executed):** 18 public props plus four hooks account for nearly the whole score; changing the prop contract is out of scope and helper extraction cannot reduce the measured boundary honestly. Review by 2026-12-03. |
| 27 | 22 | 28 | 80 | `<arrow>` | `packages/foundation/ui-system/ui/src/components/orb.tsx:225` | 397 | **refactor (executed):** extract target-volume selection by agent state and uniform updates from the frame callback. |
| 28 | 22 | 10 | 59 | `detectCycles` | `packages/tooling/library/repo-utils/src/Graph.ts:160` | 552 | **refactor (executed):** map each SCC through a named cycle-path reconstruction helper while retaining the graph algorithm. |
| 29 | 21 | 10 | 42 | `visit` | `packages/tooling/library/repo-utils/src/FsUtils.ts:458` | 399 | **override (executed):** symlink policy, cycle guard, directory exclusion, and recursion are one filesystem-safety transaction. Review by 2026-12-03. |
| 30 | 20 | 29 | 53 | `formatViolationMessage` | `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:453` | 25 | **refactor (executed):** use the violation discriminator with `Match`/message builders instead of the conditional chain. |
| 31 | 20 | 25 | 66 | `<arrow>` | `packages/foundation/ui-system/ui/src/components/chart.tsx:331` | 91 | **refactor (executed):** promote tooltip item rendering to a named internal component so item formatting is a reviewable concept, not an anonymous nested branch tree. |
| 32 | 20 | 18 | 75 | `decodeStrideFaces` | `packages/drivers/face-detection/src/FaceDetection.service.ts:665` | 192 | **refactor (executed):** extract tensor cell access and raw face/landmark construction from the stride scan. |
| 33 | 19 | 14 | 72 | `runSkillsUpdate` | `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:908` | 79 | **refactor (executed):** isolate remote-snapshot, lock/config, and agents-mirror drift evaluations. |
| 34 | 19 | 11 | 53 | `closureQuads` | `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:554` | 707 | **refactor (executed):** reuse a named transitive-edge closure for subclass/subproperty passes and isolate type propagation. |
| 35 | 19 | 10 | 31 | `jsonObjectTextFromMixedOutput` | `packages/tooling/tool/cli/src/internal/cli/MixedOutputJson.ts:79` | 324 | **override (executed):** the linear forward scanner preserves recovery semantics; `.fallowrc.jsonc` review by 2026-11-10. |
| 36 | 18 | 13 | 60 | `walk` | `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:166` | 10 | **override (executed):** path confinement, symlink rejection, cycle protection, exclusions, and recursion intentionally stay in one safety boundary. Review by 2026-12-03. |
| 37 | 18 | 12 | 43 | `tokenizeLocal` | `packages/foundation/modeling/identity/src/PnLocal.ts:253` | 175 | **override (executed):** single-pass Turtle PN_LOCAL escape/percent/code-point grammar scanner. Review by 2026-12-03. |
| 38 | 18 | 9 | 29 | `jsonObjectTextFromRight` | `packages/tooling/tool/cli/src/internal/cli/MixedOutputJson.ts:38` | 324 | **override (executed):** bounded reverse resynchronization avoids quadratic recovery; `.fallowrc.jsonc` review by 2026-11-10. |
| 39 | 17 | 18 | 116 | `root` | `packages/foundation/ui-system/ui/src/themes/components/controls.ts:194` | 764 | **refactor (executed):** bind the effective palette once and centralize touch-size CSS variable differences. |
| 40 | 17 | 15 | 214 | `<anonymous>` | `packages/tooling/tool/cli/src/commands/Files/Files.service.ts:689` | 42 | **refactor (executed):** extract a named one-source caption planning transaction from the progress callback. |
| 41 | 17 | 10 | 54 | `scanComponent` | `packages/foundation/modeling/rdf/src/Iri.ts:226` | 32 | **override (executed):** one RFC 3987 component scanner owns percent encoding, bidi rejection, code-point width, stop predicates, and minimum length. Review by 2026-12-03. |
| 42 | 17 | 9 | 72 | `parseRowAt` | `packages/foundation/modeling/schema/src/CsvParser/CsvParser.parser.ts:278` | 306 | **override (executed):** one row cursor state machine owns delimiters, trailing empty fields, and end-of-input transitions. Review by 2026-12-03. |
| 43 | 16 | 34 | 47 | `isSpec` | `packages/ecosystem/effect-drizzle/src/sqlite/Column.ts:372` | 746 | **override (executed):** pre-existing attribution artifact from PR #651; `.fallowrc.jsonc` review by 2026-11-30. |
| 44 | 16 | 17 | 123 | `preprocessImage` | `packages/drivers/face-detection/src/FaceDetection.service.ts:427` | 192 | **refactor (executed):** extract resize/padding geometry and planar RGB tensor construction from the decode workflow. |
| 45 | 16 | 14 | 133 | `aggregateGeneratedDocs` | `packages/tooling/tool/cli/src/commands/Docgen/internal/Aggregate.ts:118` | 818 | **refactor (executed):** isolate package selection, output-path uniqueness, clean planning, and one-package copy. |
| 46 | 16 | 11 | 210 | `buildOntologySnapshotFromPartitions` | `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts:602` | 876 | **refactor (executed):** extract the quad accumulator and resource/hierarchy projections while preserving one snapshot assembly boundary. |
| 47 | 16 | 10 | 91 | `CalendarEventCard` | `packages/foundation/ui-system/ui/src/components/calendar-event-card.tsx:92` | 763 | **override (executed):** prop tax plus the small label/action display contract produces the score; further extraction would fragment a cohesive card. Review by 2026-12-03. |
| 48 | 16 | 8 | 134 | `ChartTooltipContent` | `packages/foundation/ui-system/ui/src/components/chart.tsx:268` | 91 | **override (executed):** nine Recharts adapter props, label resolution, and container composition are one tooltip boundary; the nested item renderer is refactored separately. Review by 2026-12-03. |
| 49 | 16 | 8 | 39 | `handleBlur` | `packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts:927` | 78 | **refactor (executed):** extract pure parse/fallback/clamp resolution and leave event emission in the hook. |

Executed verdict totals: 30 refactors, 19 review-dated overrides, zero
`ignorePatterns` additions. The lack of ignores is deliberate: no P0 >15
finding is generated or vendored code under the packet's provenance rule.

## Wave 1 reconciliation

The five 2026-07-30 panel seams remain mandatory even when their target
function is below 15:

1. IRI optional query/fragment suffix extraction — **executed**.
2. Live-waveform microphone teardown extraction — **executed**.
3. `getLiteralThunkHelperName` predicate table — **executed** (P0 cognitive 9).
4. Image target canonicalization — **already executed on main** by commit
   `bfb20e7688` (PR #911): the image-only helper became shared
   `canonicalizeFileTargetPath` in `Files/internal/FileTransaction.ts`, with
   nearest-existing-ancestor resolution and all image callers migrated.
5. `collectCloneCards` card construction extraction — **executed** (P0
   cognitive 9).

## P0 feature evaluations

### Runtime-coverage CRAP — defer

- The live report says `coverage_model: static_estimated` and
  `coverage_source_consistency: uniform`; every populated tail CRAP value is
  estimated.
- No `coverage-final.json`, V8 coverage directory, or checked-in health snapshot
  exists in the checkout. Fallow 3.22.0 uses `--coverage` for exact per-function
  CRAP and reserves `--runtime-coverage` for the runtime-observation sidecar.
- The tail spans CLI scripts, Effect services, React/Three.js UI, and generator
  code, so a partial artifact would make the evidence non-uniform and would not
  justify a repo-wide CRAP gate.

Verdict: defer exact/runtime-informed CRAP adoption until the quality pipeline
can produce one path-normalized, representative Istanbul map for the full
analyzed source set. Keep estimated CRAP advisory during this cognitive-tail
campaign.

### `fallow impact` trends — defer

`bunx fallow impact status --root . --config .fallowrc.jsonc --format json`
reported `enabled: false`, `record_count: 0`, `containment_count: 0`, and
`attribution_active: false`. Fallow documents the history as user-local,
opt-in, forced off in CI, and never written to the repository.

Verdict: defer Impact as packet evidence because the current project has no
history and the store cannot provide reproducible PR/CI proof. No user-global
or project-local Impact setting was changed during this evaluation.

## Suppression baseline refresh

The historical suppression evidence was reconstructed before refreshing the
stale policy:

- `research/SOURCES.md` records 78 pragmas backfilled across 45 files on
  2026-07-30.
- A detached reconstruction of calibration commit `3464a827e4`, using its
  locked Fallow 3.10.0 dependency after a frozen install, reports exactly 91
  analyzed suppressions across 52 files: 57 `code-duplication`, 24
  `complexity`, and 10 other. A raw source search finds 92 markers; the one
  additional marker is in ignored generator script
  `packages/drivers/box/scripts/generate.ts`. Therefore 91 is the historical
  `fallow suppressions` comparator, while 78 is only the subset rewritten with
  reasons.
- The live Fallow 3.22.0 inventory reports 194 suppressions across 112 files:
  117 `code-duplication`, 63 `complexity`, and 14 other; zero lack reasons and
  zero are stale.

A path/kind/reason multiset comparison finds 115 current signatures added and
12 historical signatures removed, for the same net increase of 103. The added
signatures span unrelated surfaces: 41 are under the tooling CLI, 11 under
`effect-drizzle`, eight under professional desktop, six each under labs,
Exiftool, FFmpeg, and RDF, with the remainder spread across 12 other package
families. The single largest file is Corpus `ServicePrograms.ts` with 14 added
markers. This is not a hidden tail-only delta that P1 can eliminate within its
named function list.

The live repo-wide total exceeds the exact historical comparator by
103 before this campaign changes code: +60 `code-duplication`, +39
`complexity`, and +4 `unused-file`. Removing post-calibration suppressions
owned by unrelated initiatives would violate the principle of this complexity
campaign and its no-unrelated-refactor criterion. On 2026-09-03 the user
confirmed that the old scope was stale and authorized refreshing the goal to
the current repository. P2 initially ratcheted from that live P0 total. Before
final proof, latest main added 13 analyzed suppressions independently of this
campaign, so the current no-growth comparator is `<= 207`: 120
`code-duplication`, 73 `complexity`, and 14 other across 114 files. It still
requires zero missing/stale reasons and forbids campaign-added suppressions.
The 91- and 194-count inventories remain provenance only.

## Final verification state

The implementation branch now proves the refreshed objective:

- After synchronizing to `origin/main` at
  `53193e5a5e93a3231282eaead455f7d06a85ac4d`, Fallow 3.22.0 analyzes 4,411
  files and 67,646 functions after the extracted seams landed; the live
  complexity breakdown contains zero unwaived findings above cognitive
  complexity 15.
- `bun run beep quality fallow audit --check --quiet` exits 0 with zero
  introduced complexity or duplication findings.
- `bun run fallow:health:baseline:check` exits 0. The regenerated baseline has
  189 entries: 189 matched, zero stale, and zero moved.
- `bun run fallow suppressions --format json` reports 207 suppressions in 114
  files, with zero missing reasons and zero stale suppressions. The +13 since
  the original P0 inventory landed on main; this campaign added no inline
  suppression.
- Three consecutive clean baseline comparisons against identical baseline
  bytes are recorded in `reports/clean-runs.md`.
