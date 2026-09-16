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
| P1 Knowledge layer | pending | Move the inventory generator, verifier and rows into repo-cli; commit `fixtures/effect-schema-rc115/inventory/` with a pin manifest; build the prompt generator that inlines docs from `file:line`. | `--check` byte-identical locally; hosted shape and sha verification green; Node and Bun tests green; one Role A module prompt generated with inlined docs under `ops/prompts/`. |
| P2 LiteralKit trim | pending | Delete the four covered facets and `enumMapping`, override `rebuild`, codemod about 250 consumer files, trim MappedLiteralKit alike. | Type check green; zero hits for retired names; statics survive every derivation; before/after number attached with no instantiation increase. |
| P3 Retirement train | pending | Retire groups A–G with consumers, behind the facet census (B, C) and the boundary table (D, E). | Every group merged or flipped to ADAPT with a logged ruling; each PR carries before/after numbers with no instantiation increase; KEEP untouched. |
| P4 Gate cut | pending | Add `SFV4-*` rules for F03, F13, F24 with occurrence anchors and membership baselines; delete the F26 rule; rewrite remediation strings. | Baselines committed; no parallel lane; Yeet routing shows the groups. |
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
- Lane: one Codex exec lane (`gpt-6-astra`, `medium`) drafts; Fable reviews
  wording against the 25 rulings before publish.

## P1 — Knowledge layer

- Move `explorations/effect-schema-parity/research/tools/schema-inventory.ts`
  and `verify-schema-inventory.ts` into `packages/tooling/tool/cli/src/commands/Lint/`
  beside `EffectVitest.ts` as `bun run beep lint effect-schema-inventory`
  with `--write` and `--check`; keep the `schema-inventory/v1` contract from
  `research/inventory/README.md`.
- Fixture root `packages/tooling/tool/cli/test/fixtures/effect-schema-rc115/`
  following the `effect-vitest-rc115` layout (LICENSE carried) plus a pin
  manifest (upstream sha, row digest). Extend the `verifyEffectVitestPin`
  pattern (`EffectVitestScan.ts:65`) from version-only to sha plus digest.
- Persistence through `internal/artifacts` adapters as in
  `EffectVitestStore.ts`; tests modelled on
  `test/effect-vitest-primitives.test.ts`, run on Node and Bun; paths
  home-relative for the knowledge-refs gate.
- `--check` requires `.repos/effect` (`scripts/setup-effect-ref.sh`); absent
  or wrong sha fails loud.
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
  --tsBuildInfoFile <fresh file>` on the three baseline packages before and
  after, same compiler (`7.0.2+effect-tsgo` line), fresh build-info per run.
  The committed baseline sample is the verification supplement's
  (`explorations/effect-schema-parity/research/performance-verification-supplement.md:34-38`:
  1,307,910 / 0.529 s, 7,786,120 / 3.717 s, 1,289,820 / 0.659 s), not the
  earlier `performance-baseline.md` run; commands in both files.
- One PR, about 250 files; expected under the Yeet capture cap.

## P3 — Retirement train

Groups and upstream targets are in `explorations/effect-schema-parity/MAP.md`
§P3. Candidate PR order and gates:

| PR | Group | Gate before opening |
| --- | --- | --- |
| 1 | A instance and declare wrappers (AbortSignal, Dom*, EffectSchema, PromiseSchema, Thunk) | none; proves the PR shape |
| 2 | B numeric family (Number 361, Int 143, fixed-width families, Float ADAPT) | facet census for Number and Int |
| 3 | C unknown, opaque, record, json (Unknown 128, Opaque 103, Record, Json, Primitive, SafeObject, Options, Transformations) | facet census for Unknown and Opaque |
| 4 | D time and duration (Timestamp, DateTimeUtcFromValid, Duration, Timezone) | boundary table rows filled for every concept in the group |
| 5 | E binary and collections (ArrayBuffer, Bytes, ArrayOf, HashSet, MutableHashMap, MutableHashSet, Graph, RegExp) | boundary table rows filled for every concept in the group |
| 6 | F text and misc (String, CommonTextSchemas, case brands, URL, BigDecimal, Logs, StatusCauseError, FileInfo, JSONSchema) | none |
| 7 | G Role B (HttpMethod, HttpStatus, MimeType, Jsonl, Toml, Yaml) | none; losses recorded in the PR |

- Each PR: closure-sized with `graft callers --depth all` plus a type check;
  cites the P0 entry; regenerates the tracked generated baselines; runs
  `package-verify` on touched packages; attaches before/after
  `--extendedDiagnostics` on the three baseline packages (same conditions as
  P2) and is bounced on any instantiation increase; check time is reported
  against a 5% band and a breach is a review flag. The SPEC may merge
  groups; it may not split a concept from its consumers.
- Codemod-class PRs (2, 3) reuse the P2 engine with new rewrite rules.
- Lanes: one Codex exec lane per PR, prompted from the inventory rows and the
  audit row; Fable judges the PR against the SPEC bounce conditions.

## P4 — Gate cut

- Extend `commands/Lint/internal/SchemaFirstDetectors.ts` with `SFV4-*` rules
  for F03, F13, F24 (`research/idiom-families.md` §F03 :158, §F13 :298,
  §F24 :452); register ids in `Lint.schemas.ts:104`; remediation strings in
  `SchemaFirstPolicy.ts`; render groups in `SchemaFirst.render.ts`; advisory
  gating in `SchemaFirstScan.ts`.
- Identity: port the effect-vitest membership shape that keeps line numbers
  out (`Lint.schemas.ts:1292`); ratchet through `RatchetDiff.ts:71` and
  `RatchetLifecycle.ts:67`; baseline in `standards/schema-first.inventory.jsonc`.
- Delete `SFV4-tagged-error-equivalence` (`SchemaFirstDetectors.ts:1169`,
  `SchemaFirstPolicy.ts:32`, `SchemaFirstScan.ts:395`, `Lint.schemas.ts:112`).
- Precedent for gate-then-zero: `goals/schema-first-v4-capabilities`,
  `goals/schema-first-zero-actionables`.

## P5 — Statics and performance close

- Precondition: `goals/schema-utils-selective-codec-statics` Yeet PR merged;
  cite its PR number here before opening.
- F15 rule; retire `SchemaUtils/withCodecStatics.ts` with consumers; keep
  `collectAnnotationsAt.ts`.
- Extend `commands/Quality/CheckCensus.ts` rows with `instantiations` and
  `checkTimeMs`; commit the rc.115 baseline from the verification
  supplement's sample (`@beep/schema` 1,307,910 / 0.529 s; repo-cli
  7,786,120 / 3.717 s; law-practice-domain 1,289,820 / 0.659 s;
  `performance-verification-supplement.md:34-38`, same compiler, fresh
  build-info) and compare on every run: instantiations are the hard gate,
  check time is advisory within a 5% band (goal-time ruling 2026-09-16);
  mirror one or two suites from
  `.repos/effect/packages/effect/typeperf/suites/schema`.
- Drive `bun run beep lint schema-first` parity backlog to zero.
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

Every effect bump: regenerate the inventory directory for the new RC, run the
parity lane, work its findings to zero in the bump PR.

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
