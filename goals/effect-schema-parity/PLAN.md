# Effect Schema Parity Plan

## Status

Status: `pending`

Execution is open. This packet and its source exploration landed on `main`
through PR #1154 (2026-09-16); P0 starts after that merge. Each phase is
one or more Yeet PRs; the phase is complete when its last PR reports
`merge-ready: yes` and its done-signal in `SPEC.md` §Phase Contract holds.
P0 plus P1 are the first vertical slice.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Doctrine PR | pending | Land the dated "Upstream-First Foundation/Modeling" entry in `standards/architecture/DECISIONS.md` and its rule text in §11, narrow the AGENTS.md line, add the `@beep/schema` README rule and the same clause in standards and skill prose. | Merged; citable by heading. |
| P1 Knowledge layer | pending | Move the inventory generator, verifier and rows into repo-cli; commit `fixtures/effect-schema-rc118/inventory/` with the full `inventoryPin` sha in its pin line and rows; build the prompt generator that inlines docs from `file:line`. | `--check` byte-identical locally; hosted shape and sha verification green; Node and Bun tests green; one Role A module prompt generated with inlined docs under `ops/prompts/`. |
| P2 LiteralKit trim | pending | Delete the four covered facets and `enumMapping`, override `rebuild`, codemod about 250 consumer files, trim MappedLiteralKit alike. | Type check green; zero hits for retired names; statics survive every derivation; before/after number attached with no instantiation increase. |
| P3 Retirement train | pending | Retire groups A–G with consumers, behind the facet census (B, C) and the boundary table (D, E). | Every group merged or flipped to ADAPT with a logged ruling; each PR carries before/after numbers with no instantiation increase; KEEP untouched. |
| P4 Gate cut | pending | Add `SFV4-*` rules for F03 and F24 with occurrence anchors and membership baselines (F13 dropped below the reach floor, SPEC goal-time row 2026-09-29); delete the F26 rule; rewrite remediation strings. | Baselines committed; no parallel lane; Yeet routing shows the groups. |
| P5 Statics and performance close | pending | F15 rule, `withCodecStatics` retirement, `check-census` instantiation ratchet, typeperf mirror, reflection, lifecycle flip. | Selective-statics merged first; backlog zero; no instantiation increase on the three packages; check-time band reported. |

<!-- Phase ids match ops/manifest.json `phases[]`. This packet uses its own
six-phase scheme; Yeet-to-mergeable is the exit of every phase, not a phase. -->

## P0 — Doctrine PR

- One small docs PR from a lane branch. Two surfaces, per DECISIONS "Doctrine
  surface" and "Doctrine lands ahead": a dated entry in
  `standards/architecture/DECISIONS.md` (draft in
  `explorations/effect-schema-parity/research/gate-and-knowledge-plumbing.md`
  §(g), precedent shape 2026-07-08 PGlite) and the operational rule text in
  `standards/architecture/11-evolution-and-deprecation.md`, both amended by
  DECISIONS "LiteralKit reopened" (intent per facet, uncovered dominant facet
  ⇒ ADAPT, facet census before any RETIRE over 100 consumers).
- Reconcile with the existing "In-repo deprecations without a release train"
  section, which admits immediate removal only for zero-consumer symbols.
- AGENTS.md line: keep "prefer `LiteralKit` internal domains", add
  "`S.Literals` for anonymous inline unions never referenced by name", keep
  the `as const` note. Same clause in `standards/effect-laws-v1.md`,
  `standards/ARCHITECTURE.md`, `standards/effect-first-development.md`,
  `standards/architecture/04-rich-domain-model.md`, the schema-first,
  effect-first and crispen skills, the three agents and their `.codex` twins.
  Code examples that show retired facets move with P2.
- Lane: one Opus 5.5 child (`claude-opus-5-5`, D5 2026-09-28) drafts; Fable
  reviews wording against the 25 rulings before publish.

## P1 — Knowledge layer

- Move `explorations/effect-schema-parity/research/tools/schema-inventory.ts`
  and `verify-schema-inventory.ts` into `packages/tooling/tool/cli/src/commands/Lint/`
  beside `EffectVitest.ts` as `beep lint effect-schema-inventory` (a new `lint`
  subcommand P1 adds, invoked through the beep CLI)
  with `--write` and `--check`; keep the `schema-inventory/v1` contract from
  `research/inventory/README.md`. The repaired prototype
  (`research/tools/schema-inventory.ts`, `verify-schema-inventory.ts` and the
  shared tool-owned `modules.ts`, 2026-09-28) is what the planned
  `lint effect-schema-inventory --write|--check` productizes: it reads the
  pin from the root `package.json` catalog and every source byte through
  `git -C .repos/effect show <inventoryPin>:<path>`, with no assert on the
  reference HEAD or working tree.
- Fixture root `packages/tooling/tool/cli/test/fixtures/effect-schema-rc118/**`
  following the `effect-vitest-rc118` layout (LICENSE carried). That sibling
  has no pin file (its rc.118 tag sha lives in
  `standards/effect-vitest.primitives.jsonc:9`), so this fixture records the
  full `inventoryPin` sha itself, in the `INDEX.md` pin line and every row's
  `sha`, plus a row digest (D4). Extend the `verifyEffectVitestPin`
  pattern (`EffectVitestScan.ts:65`) from version-only to sha plus digest.
- Persistence through `internal/artifacts` adapters as in
  `EffectVitestStore.ts`; tests modelled on
  `test/effect-vitest-primitives.test.ts`, run on Node and Bun; paths
  home-relative for the knowledge-refs gate.
- `--check` requires `.repos/effect` (`scripts/setup-effect-ref.sh`); a
  missing reference or a pin commit absent from it fails loud. The reference
  HEAD moving past the pin is expected and must not fail.
- Move `research/inventory/` with `git mv` (decision "Evidence retention":
  the rows are the knowledge layer, kept once, in the fixture); leave the
  exploration's `research/SOURCES.md` pointing at the fixture path.
- Prompt generator (decision "Knowledge layer"): a row carries only a
  truncated signature, a summary and an example flag
  (`research/inventory/README.md`), so the generator resolves each row's
  `file:line` against `.repos/effect` at the pinned sha and inlines the full
  declaration and JSDoc block (signature, sections, examples) plus the graft
  context for that module. Generated prompts live under this packet's
  `ops/prompts/`; the first-slice proof is one Role A module prompt committed
  there.

## P2 — LiteralKit trim

- Kit: `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts`
  and `MappedLiteralKit/MappedLiteralKit.schema.ts`. Delete `Options`,
  `pickOptions`, `omitOptions`, `HashSet`, `thunk`, `enumMapping`, the `M`
  parameter, `LiteralKitKeyCollisionError`,
  `LiteralKitEnumMappingDuplicateLiteralError`,
  `LiteralKitEnumMappingCoverageError`; replace `attachHelperDescriptors`'s
  `annotate` wrap with a `rebuild(ast)` override.
- `SchemaUtils.withLiteralKitStatics` (88 files / 183 occurrences) copies five
  of the deleted facets (`Options`, `HashSet`, `pickOptions`, `omitOptions`,
  `thunk`); trim its `Pick` to `is`, `Enum`, `$match`, `toTaggedUnion` in the
  same PR (ADAPT; its final fate rides with `withStatics` in P5; census
  `explorations/effect-schema-parity/research/2026-09-28-schemautils-census.md`).
- Codemod on the ts-morph project from `SchemaFirstProject.ts:42`, apply
  pipeline modelled on `JSDocMigrateApply.ts:578` (dry run, quarantine, biome
  format). Rewrite `packages/tooling` first, boot `bun run beep`, then the
  rest. The two `enumMapping` consumers (`TurboCache.ts`,
  `Md.semantic-inspector.ts`) by hand.
- Regenerate `standards/schema-catalog.generated.jsonc`,
  `standards/coverage.regression-baseline.jsonc`,
  `standards/jsdoc-documentation.inventory.md`,
  `standards/schema-first.inventory.jsonc`.
- Measure: `bun run tsc -p <pkg>/tsconfig.json --noEmit --extendedDiagnostics
  --singleThreaded --tsBuildInfoFile <fresh file>` on the three baseline
  packages before and after, same compiler (`7.0.2+effect-tsgo` line), fresh
  build-info per run. The single-checker count (the same as `--checkers 1`) is
  the gate; the default run uses four checkers, varies with the file
  partition, and is reported as advisory beside check time (goal-time ruling
  2026-09-29). The verification supplement's 2026-09-12 sample
  (`explorations/effect-schema-parity/research/performance-verification-supplement.md:34-38`:
  1,307,910 / 0.529 s, 7,786,120 / 3.717 s, 1,289,820 / 0.659 s) was taken
  in default mode at `51d4a2f08a` and stays historical; commands in both
  files.
- One PR, about 250 files; expected under the Yeet capture cap.

## P3 — Retirement train

Groups and upstream targets are in `explorations/effect-schema-parity/MAP.md`
§P3. Candidate PR order and gates:

| PR | Group | Gate before opening |
| --- | --- | --- |
| 1 | A instance and declare wrappers (AbortSignal, Dom*, EffectSchema, PromiseSchema, Thunk) | none; proves the PR shape |
| 2 | B numeric family (Number 361, Int 143, fixed-width families, Float ADAPT) | facet census for Number and Int |
| 3 | C unknown, opaque, record, json (Unknown 128, Opaque 103, Record, Json, Primitive, SafeObject, Options, Transformations; SchemaUtils zero-consumer DELETEs `optional`, `optionalKeyWithDefault`, `pluck`, `withEncodeDefault`, `boolWithDefault`, `BoolDefaultFalse`, `BoolDefaultTrue`, `boolKeyWithDefault`; `optional` has one in-package consumer, `packages/foundation/modeling/schema/src/FileDiff.schema.ts:17-18`, migrated in the same PR; `BoolKeyDefaultFalse` / `BoolKeyDefaultTrue` ADAPT, rebuilt directly on `S.withConstructorDefault` + `S.withDecodingDefaultTypeKey`) | facet census for Unknown and Opaque |
| 3b | C SchemaUtils defaults codemod (`withNoneDefault` 281 files / 1,897 occurrences, `withKeyDefaults` 110 / 427, `withConstantDefault` 26 / 85, `withEmptyArrayDefaults` 20 / 38) to `S.withConstructorDefault` plus `S.withDecodingDefaultTypeKey`, or `S.withDecodingDefaultType` for `withEmptyArrayDefaults` | P2 codemod engine landed; one-facet census for `withNoneDefault` and `withKeyDefaults` (over 100 consumers) |
| 4 | D time and duration (Timestamp, DateTimeUtcFromValid, Duration, Timezone) | boundary table rows filled for every concept in the group |
| 5 | E binary and collections (ArrayBuffer, Bytes, ArrayOf, HashSet, MutableHashMap, MutableHashSet, Graph, RegExp) | boundary table rows filled for every concept in the group |
| 6 | F text and misc (String, CommonTextSchemas, case brands, URL, BigDecimal, Logs, StatusCauseError, FileInfo, JSONSchema; SchemaUtils zero-consumer DELETEs: the ten `encode*` facades, `split`, `classStatics` with its allowlist entry `standards/effect-laws.allowlist.jsonc:45-52` and generated snapshot) | none |
| 7 | G Role B (HttpMethod, HttpStatus, MimeType, Jsonl, Toml, Yaml) | none; losses recorded in the PR |

- Each PR: closure-sized with `graft callers --depth all` plus a type check;
  cites the P0 entry; regenerates the tracked generated baselines; runs
  `package-verify` on touched packages; attaches before/after
  `--extendedDiagnostics` on the three baseline packages (same conditions as
  P2) and is bounced on any instantiation increase; check time is reported
  against a 5% band and a breach is a review flag. The SPEC may merge
  groups; it may not split a concept from its consumers.
- Codemod-class PRs (2, 3, 3b) reuse the P2 engine with new rewrite rules.
  PR 3b is the largest rewrite in the train; the SchemaUtils rows and
  counts come from the census `explorations/effect-schema-parity/research/2026-09-28-schemautils-census.md`.
- Lanes: one Opus 5.5 child (`claude-opus-5-5`) per PR, prompted from the
  inventory rows and the audit row; Fable judges the PR against the SPEC
  bounce conditions.

## P4 — Gate cut

- Extend `commands/Lint/internal/SchemaFirstDetectors.ts` with `SFV4-*` rules
  for F03 and F24 (`research/idiom-families.md` §F03 :158, §F24 :452);
  register ids in `Lint.schemas.ts:104`; remediation strings in
  `SchemaFirstPolicy.ts`; render groups in `SchemaFirst.render.ts`; advisory
  gating in `SchemaFirstScan.ts`.
- F13 (§F13 :298) is dropped from the gate cut (SPEC goal-time row
  2026-09-29): the precise rule measured 10 occurrences in 10 files, below the
  100-file reach floor. Its ten sites are hand-fixed in P5; counts, the site
  list and the anchor design are in `research/2026-09-29-p4-gate-cut.md`.
- Identity: port the effect-vitest membership shape that keeps line numbers
  out (`Lint.schemas.ts:1292`); ratchet through `RatchetDiff.ts:71` and
  `RatchetLifecycle.ts:67`; baseline in `standards/schema-first.inventory.jsonc`.
- Delete `SFV4-tagged-error-equivalence` (`SchemaFirstDetectors.ts:1169`,
  `SchemaFirstPolicy.ts:32`, `SchemaFirstScan.ts:395`, `Lint.schemas.ts:112`).
- Narrow `beep/no-inline-schema-compile` (`.oxlintrc.json:45`,
  `packages/tooling/policy-pack/lint-rules/src/rules/no-inline-schema-compile.ts`).
  Its Medium-tier message (`:78-79`, chosen at `:198`) and header comment
  (`:26-27`) claim a plain schema reference rebuilds its compiled function on
  every call; that is false at `inventoryPin` and was already false when the
  rule landed (per-AST parser cache, see P5 evidence). Keep the High tier
  (inline schema construction, `:75-76`, `:195-197`), reword it to "inline
  schema construction defeats the per-AST parser cache", and drop or demote
  the Medium tier.
- The F03 rule matches the export names, not file names: the idiom-census
  regex (`research/idiom-census.mjs:18`) lists `withConstructorDefaults(`,
  a file, and misses `withNoneDefault` and `withConstantDefault` (1,982
  production occurrences).
- Precedent for gate-then-zero: `goals/schema-first-v4-capabilities`,
  `goals/schema-first-zero-actionables`.

## P5 — Statics and performance close

- Precondition: `goals/schema-utils-selective-codec-statics` Yeet PR merged.
  Met: PR #927 merged 2026-08-31 as `2731847346` (D7). That packet's manifest
  still reads P4 in progress; it is not edited from here.
- Evidence (D10, 2026-09-28): Effect v4 has cached parsers per AST since
  before the compilers. At `7e1f455fab` (2026-06-20, the day before
  `beep/no-inline-schema-compile` landed) `SchemaParser.ts:1007` already read
  `const recur = memoize(...)`; `17f0b91a24` (#7020, 2026-08-05) moved it to a
  memoized `normalCompiler`. At `inventoryPin` the per-AST registry
  (`WeakMap<SchemaAST.AST, Entry>`, `internal/schema/compilerRegistry.ts:33`,
  `resolve` `:180-188`) extends that cache and also holds JIT or AOT entries.
  Calling a parser factory inside a function body therefore allocates a few
  closures and never recompiles a hoisted schema; only inline schema
  construction misses the cache. The hoisting rationale behind
  `withCodecStatics` (`goals/schema-utils-selective-codec-statics/SPEC.md:12-13`,
  exploration `MAP.md` P5 statics row, lint `beep/no-inline-schema-compile` at
  `.oxlintrc.json:45`) never needed statics in v4. The compilers attach no
  statics; judge the retirement against Effect Schema's own members and
  `SchemaParser` free functions. Call path and measurements: census
  `explorations/effect-schema-parity/research/2026-09-28-schemautils-census.md` §D10.
- F15 rule; retire `SchemaUtils/withCodecStatics.ts` with consumers; keep
  `collectAnnotationsAt.ts` and `isCodecDataFirst.ts` (KEEP ruled by the
  operator on 2026-09-28, superseding the 2026-09-14 ruling for this symbol
  only: exploration `DECISIONS.md` "isCodecDataFirst: keep"; SPEC goal-time
  row 2026-09-28). The same PR
  deletes `CodecStaticRegistry`, `CodecStaticKey`, `CodecStaticKeys`,
  `SelectedCodecStatics`, `CodecStaticSelectionError`, `toEquivalence` and
  `DualEquivalence` (10 + 1 consumers move to `S.toEquivalence`), and
  retires codegen-kit's `GenerateConfig.schemaCodecStatics`
  (`packages/tooling/library/codegen-kit/src/CodegenKit.models.ts:369-371`,
  import `:10`, default `:318`), its emitter `renderCodecStatics`
  (`internal/postProcess.ts:418-426`, emitted string `:423`) and the usage
  probe at `:589`, and the empty override maps in
  `packages/drivers/box/scripts/generate.ts:254` and
  `packages/drivers/runpod/scripts/operations.renderer.ts:535` (zero
  `_generated/` files use the emitter today).
- `withStatics` (94 files / 148 occurrences) runs a facet census: codec-facade
  keys go to free functions; the mechanism and
  `SchemaUtils/internal/staticDescriptors.ts` retire with their last user.
- Extend `commands/Quality/CheckCensus.ts` rows with `instantiations` and
  `checkTimeMs`; commit a baseline re-measured `--singleThreaded` (goal-time
  ruling 2026-09-29; the verification supplement's 2026-09-12 default-mode
  sample at `51d4a2f08a`, `performance-verification-supplement.md:34-38`,
  stays historical) and compare on every run: single-checker instantiations
  are the hard gate, check time is advisory within a 5% band (goal-time
  rulings 2026-09-16 and 2026-09-29);
  mirror one or two suites from
  `.repos/effect/packages/effect/typeperf/suites/schema`.
- Drive `bun run beep lint schema-first` parity backlog to zero.
- Hand-fix the ten F13 guard sites listed in
  `research/2026-09-29-p4-gate-cut.md` (derive each guard from its schema with
  `S.is` or the tagged-union guards); there is no F13 detector (SPEC goal-time
  row 2026-09-29).
- Closeout in the same PR (checklist below).

## P5 Closeout Checklist

1. Write the closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate
   against `ReflectionFrontmatter`. Critique tooling, implementation and the
   goal itself; capture TODOs worth codifying.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence), `ops/manifest.json` phase
   statuses and `initiative.status` via `bun run beep goals set-status`.
4. Retire the lane and sweep the clone with `bun run beep yeet sweep --retire`
   from inside the lane after the merge.

## Standing behaviour after close

Every effect pin change, including snapshot bumps and any bump before P1:
the bump PR regenerates the inventory directory for the new `inventoryPin`,
runs the parity lane, and works its findings to zero (SPEC goal-time row
2026-09-28).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative; update it only when the contract changes, with a
  dated row in its goal-time decision table.
- Record friction in `research/OPPORTUNITIES.md` the moment it happens.
- Archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/effect-schema-parity/GOAL.md)" -le 4000
jq . goals/effect-schema-parity/ops/manifest.json
rg -n "effect-schema-parity|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-schema-parity
git diff --check -- goals/effect-schema-parity
bun run beep lint reflection-artifacts
bun run beep lint schema-first
bun run beep quality package-verify @beep/schema
bun run beep quality package-verify @beep/repo-cli
```
