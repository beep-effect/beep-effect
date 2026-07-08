# SF-2 repocli — @beep/repo-cli schema-first + allowlist + R17/R18/R19 detector work (P4-wave2 + queue)

Lane: single writer for `packages/tooling/tool/cli` (@beep/repo-cli). Work set:
26 schema-first entries (`ops/slices/P4-wave2/beep__repo-cli.json`) + 8
effect-laws allowlist entries (`ops/slices/AL-1b.json`, repo-cli subset) + three
driver-queued detector rulings (R17, R18, R19) landed in the same package. No
`standards/*.jsonc` touched. No commits made. No inventory regen.

Four sub-tasks (Corpus family, SyncDataToTs family, Yeet family, odds-and-ends)
were dispatched to parallel workers on disjoint file sets; three landed and are
reported here as-verified. The Corpus family worker never started (zero writes,
confirmed via `git status`/mtimes) — the driver directed the lane to execute
that batch directly, which is included below under "Corpus family (direct)".

## 1. Schema-first (26/26 fixed)

| # | File :: symbol | Kind | Fix |
|---|---|---|---|
| 1-5 | `Corpus/Corpus.service.ts` :: `extensionOf.toLowerCase`, `pipeDocket.toUpperCase`, `sanitizeSegment.trim`, `versionStem.toLowerCase`, `versionStem.trim` | SFV4-normalization | Replaced raw `.trim()/.toLowerCase()/.toUpperCase()` with local `decodeTrimmedString`/`decodeLowercasedString`/`decodeUppercasedString` = `S.decodeSync(S.Trim)` / `S.decodeSync(S.String.pipe(S.decode(SchemaTransformation.toLowerCase())))` / `...toUpperCase()`, mirroring `@beep/schema/internal/email.ts`'s `NormalizedString` idiom. Verified module-top-level placement does not itself retrigger `isFunctionLocalNode`. |
| 6 | `Docgen/internal/QualityWorkerRunpodEval.ts` :: `makeQualityWorkerRunpodEvalPodCreateInput` | SFV4-fn-schema | Named `S.Class` `QualityWorkerRunpodEvalPodCreateOptions` replaces the inline destructured object-literal param; defaults now applied via `??` in the body. |
| 7-8 | `Graphiti/internal/ProxyOps.ts` :: `shouldInstallProxyServiceForTesting`, `shouldRecoverGraphitiStackForTesting` | SFV4-fn-schema | Named `S.Class` options types (`ProxyServiceUnitCheckOptions`, `ProxyRecoveryDecisionOptions`) replace inline literals. |
| 9-14 | `Quality/FallowQuality.command.ts` :: `AuditDuplicationCloneGroups`, `FallowAuditRawReport`, `FallowDeadCodeRawReport`, `FallowFlagsRawReport`, `FallowHealthRawReport`, `anonymous@319` | object-struct-schema | `S.Struct` → named `S.Class` per the P2-audit-verified mechanic (spreads/computed keys pass through unchanged into the class fields argument). Also extracted 4 previously-inline nested `S.Struct` blocks that would otherwise have surfaced as *new* findings once their parents stopped being `S.Struct` calls: `FallowAuditSummary`, `FallowAuditAttribution` (from `FallowAuditRawReport`'s `summary`/`attribution`), `FallowHealthSummary` (from `FallowHealthRawReport`'s `summary`), `FallowSecuritySummaryCounts` (the `anonymous@319` entry itself, nested in the already-class `FallowSecuritySummaryRawReport`), and `CloneGroupInstance`/`CloneGroupEntry` (from `AuditDuplicationCloneGroups`'s two levels of nested structs). |
| 15 | `Quality/internal/JSDocDocumentationInventory.ts` :: `textLooksLikeSchemaExport.trim` | SFV4-normalization | Same `decodeTrimmedString` pattern, applied to a ts-morph AST-source-text parser (not domain data, but the mechanical fix is identical and harmless). |
| 16 | `Quality/internal/KnipRatchet.ts` :: `anonymous@200` | object-struct-schema | Extracted `KnipNormalizationPolicy` class from `KnipRegressionBaseline`'s inline `normalization` field. |
| 17 | `Research/internal/BrowserHistory.ts` :: `canonicalizeForSift.toLowerCase` | SFV4-normalization | Same pattern; `repoMatch[1]` is always defined when the outer match succeeds so the `?? ""` fallback never triggers. |
| 18-19 | `SyncDataToTs/internal/Models.ts` :: `SyncDataTarget`, `SyncDataTargetResult` | exported-interface | Both **converted** to `S.Class`, not merely exempted. `SyncDataTarget.acquire` (an `Effect.Effect<...>` value) uses `S.declare(Effect.isEffect)` as an opaque-guard schema — exactly the technique R17's decisions.md entry separately ratified ("follows the @beep/schema `AbortSignal` precedent and is an honest fix, not gate-dodging"). `SyncDataTargetResult.canonicalPatch` (previously a raw `JsonPatch.JsonPatch` differ value) is now a real `CanonicalJsonPatch` schema: `S.Array(S.Union([JsonPatchAddOperation, JsonPatchRemoveOperation, JsonPatchReplaceOperation]))`, modeling the actual RFC-6902-subset structure as decodable data instead of an opaque differ output. |
| 20 | `SyncDataToTs/internal/Source.ts` :: `SyncDataFetchedSource` | exported-interface | **Converted** to `S.Class` (`bytes: S.Uint8Array`, plus 4 `S.String` fields) per R11's `Uint8Array` narrowing — this was the R11-flagged expected P4 conversion. Plain-object-literal construction at the `fetchSource` return site still type-checks structurally. |
| 21 | `SyncDataToTs/internal/Source.ts` :: `sourceMetadata` | SFV4-fn-schema | `extras` param retyped `Partial<Pick<SyncDataSourceMetadata, "version" \| "published">>` — a `TypeReference` derived from the (now-class) schema itself instead of a hand-duplicated inline literal. |
| 22 | `SyncDataToTs/targets/CldrTerritories.ts` :: `anonymous@131` | object-struct-schema | Extracted `CldrTerritoryNamesMain` class from `CldrTerritoryNamesDocument`'s inline `main` field. |
| 23-25 | `Yeet/internal/{Closeout,Handler,Verdict}.ts` :: `closeoutGateStatesForTesting`, `buildYeetRunPlanForTesting`, `buildYeetVerdict` | SFV4-fn-schema | Named `S.Class` options types (`CloseoutGateStatesTestInput`, `BuildYeetRunPlanTestOptions`, `BuildYeetVerdictInput`) replace inline literals; bodies unchanged (still read `input.field`). |
| 26 | `test/tsconfig-sync.test.ts` :: `schema-codec-tests` | SFV4-arbitrary-tests | Added a real `S.toArbitrary`-derived property test over the file's local `TsconfigReferences` schema (round-trip encode→decode), satisfying `sourceHasSchemaArbitraryPropertyCoverage` genuinely rather than gaming it. |

**Live-scan verification** (`bun run beep lint schema-first`, read-only): all 26
entries now report `"Stale schema-first inventory entry is no longer present
in the live scan"` — confirmed fixed, driver regen will clear them from
`standards/schema-first.inventory.jsonc`. Zero *new* untracked findings appear
anywhere under `packages/tooling/tool/cli/**`.

## 2. Effect-laws allowlist (8/8 attempted, 8/8 converted)

| # | File | Kind | Fix |
|---|---|---|---|
| 1-2 | `Quality/internal/JSDocDocumentationInventory.ts` | new-map-set, object-method | `new Set<string>()` (dedup set, ~line 649) → `MutableHashSet`; `Object.entries(inventory.totals)` → `R.toEntries(...)`. |
| 3 | `Docgen/internal/Quality.ts` | new-map-set | `documentedOverloadNames: new Set<string>()` → `MutableHashSet`. |
| 4 | `Lint/SchemaFirst.ts` | new-map-set | Two internal AST-traversal dedup sets (`names`, `identifiers`) → `MutableHashSet`. Pure internal-implementation swap — zero change to detection logic or output, re-verified via the full `schema-first.test.ts` suite before and after. |
| 5 | `Corpus/Corpus.recyclebin.ts` | new-map-set | `metadataByKey`/`contentByKey` (libpff pairing indexes) → `MutableHashMap`. |
| 6-7 | `Corpus/Corpus.service.ts` | new-map-set, object-method | All ~15 native `Map`/`Set` call sites converted to `MutableHashMap`/`MutableHashSet` (restoration-record joins, client-map, organize-plan version indexing, dedupe-target tracking, enrichment candidate collector with a nested `MutableHashSet` field, family-by-digest/text-name joins). `Object.entries(clientMap)` → `R.toEntries(...)`. All internal-only (no exported signatures changed); one object-keyed map (`OrganizePlanRow` keys) verified safe to convert since Effect's default `Equal`/`Hash` for plain objects without a custom implementation falls back to reference identity, matching native `Map`'s semantics exactly. |
| 8 | `Quality/FallowQuality.command.ts` | date-static | `Date.parse(envelope.generatedAt)` → `DateTime.make(...)` + `O.map(DateTime.toEpochMillis)` + `O.getOrElse(() => Number.NaN)`, matching the exact precedent already used in `AIMetrics.command.ts:558`. Preserves the downstream `Number.isFinite(...)` check semantics identically (NaN on parse failure, same as `Date.parse`). |

No entries were judged unconvertible; every native-runtime finding in this
package converted cleanly with an in-file precedent or a straightforward
Effect-native equivalent.

## 3. R17 — generic-branch member-safety parity + fn-schema `.tsx` exemption

Implemented both authorized items in `Lint/SchemaFirst.ts`:

1. `classifyGenericInterface` now threads `sourceFile`/`filePath` and, after
   the existing R6-1/R6-2 silent checks, delegates to `classifyComposedMembers`
   (the same service-contract/curated-runtime-handle/`.tsx`-render-boundary
   signal set non-generic interfaces already get) instead of an unconditional
   tracked exception. Removed the now-dead `GENERIC_INTERFACE_EXCEPTION_REASON`
   constant (its only call site was replaced).
2. Mirrored `isNullReturnEligibleFilePath`'s `.tsx` exemption into the
   `SFV4-fn-schema` loop via a new `isFnSchemaEligible` gate alongside the
   existing `isNullReturnEligible` one.
3. **Extension beyond the two authorized items (flagged for review, since
   RATIFIED by the driver per their follow-up message):** `assertUploadedPreview`
   is a function-kind (`SFV4-fn-schema`) curation target, but
   `PERMANENT_SCHEMA_FIRST_EXCLUSIONS` was only wired into the struct-scan loop
   and `detectInterfaceReason`/`detectTypeAliasReason` — never the fn-schema
   loop. Added the same permanent-exclusion check there (gated on the entry's
   resolved `symbol`), a mechanical, symmetric extension with the identical
   shape as the struct loop's existing check.
4. Curated 11 R17-item-3 residue entries into `PERMANENT_SCHEMA_FIRST_EXCLUSIONS`
   with file:line evidence from `ops/reports/SF-2/sf-2-tailb.md`: acp
   `AcpPatchedProtocol`/`AcpPatchedProtocolOptions`/`AcpTerminal`/`MakeTerminalOptions`,
   mcp-kit `FieldTierSet`/`GatedLayer`, box `BoxStreamingOperations`,
   api-transport `ApiTransport`/`ApiTransportOptions`, form
   `assertUploadedPreview`, test-utils `PgliteTestcontainerResource`/`SqlTestHooks`.
   Plus the two conditional entries: wrote a throwaway ts-morph probe (deleted
   after use, never committed) that imports the real `detectInterfaceReason`
   and runs it against the live `SqlTest.ts` source — confirmed
   `PgliteSqlTestLayerOptions`/`SqlTestDriver` still resolve `"candidate"` (no
   `isServiceContractShape` signal matches their actual same-file usage) even
   after the R17-1 wiring, so both were curated too.

**Regression fixtures** (fence 11): `test/schema-first.test.ts` gained a new
`describe("R17-1: generic interface member-safety parity")` block (generic
`.tsx` `*Props` interface → newly `"silent"`; identical shape outside a `.tsx`
`*Props` file → still `"candidate"`), and 6 pre-existing tests across
`R14`/`R15-1`/`R15-2`/`R15-3` whose expected outcome flips from `"exception"`
to `"candidate"` under the parity rule (comments updated to explain why —
this is gate-strengthening consistent with R11-4's already-established
non-generic behavior, not a regression). `test/lint-command.test.ts` gained
the R17-2 fixture pair (`.ts` function still fires the fn-schema advisory;
identical `.tsx` component is silent).

**Post-implementation verification** (probe-over-trace, not manual reasoning):
wrote a second throwaway probe importing the real `detectInterfaceReason`/
`detectTypeAliasReason` against all 19 interface/type-alias-kind curated
file:symbol pairs (11 R17 + 7 R18 + 1 from R17's conditional list resolved
independently) — all 19 resolve `"silent"` against the live source. Confirmed
via the full read-only `bun run beep lint schema-first` scan afterward: every
curated entry reports as a stale (no-longer-live) finding.

## 4. R18 — LiteralKit/MappedLiteralKit + 5 fresh unconvertible reproductions

Curated 7 entries into `PERMANENT_SCHEMA_FIRST_EXCLUSIONS` with file:line
evidence from `ops/reports/SF-2/sf-2-taila.md`:

- `@beep/schema` `LiteralKit`/`MappedLiteralKit` (schema-toolkit
  self-definitions with substantive helper members; R15's "covers 5" claim
  corrected to 3/5 by the taila lane — these two need curation, not pattern
  matching, since they resolve through the one-hop alias helper to text that
  doesn't match `SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN`).
- `@beep/utils` `makeEventSchema` (third independent reproduction of the
  TS2509 "Missing Self generic" abstract-`Fields`-dictionary blocker, joining
  the R15-addendum `TSConfig.ts` family) and `DrainableWorker` (TS2562
  base-class-expression-cannot-reference-class-type-parameter blocker, plus
  independently: `Effect.Effect`-valued fields aren't decodable data).
- `@beep/md` `PureRenderAdapter`/`EffectRenderAdapter` (deliberate
  plugin-extension contracts; the descriptor/behavior split breaks 5+
  call sites and a dtslint fixture — same deferral class as R14's
  `GraphOperation`/`OperationDefinition`).
- `@beep/identity` `IdentityComposer` (TS2740: a callable template-tag call
  signature is unsatisfiable by any `S.Class` instance, since a class is a
  plain non-callable object).

All 7 verified `"silent"` via the same probe-over-trace method described above.

## 5. R19 — jsdoc overload-group consolidation

In `Quality/internal/JSDocDocumentationInventory.ts`: `exportedDeclarationsFor`
previously emitted one scored entry **per overload signature line** (including
the implementation line) for every exported function with multiple
declarations. Refactored so a same-name group of >1 `FunctionDeclaration`
nodes (overload signatures + implementation; non-function duplicate
declarations are unaffected) scores as ONE unit: a new
`analyzeFunctionOverloadGroup` picks the anchor (whichever signature carries a
JSDoc block, falling back to the first) for the required-tag/summary check,
while still aggregating malformed/forbidden-tag checks across **every** doc
block found anywhere in the group (not just the anchor's), per the ruling text.

To keep `exportedDeclarationsFor` itself from becoming an *introduced*
complexity finding (see §6), the dispatch logic was further split into two
named helpers (`collectReExportDescriptors`,
`collectDirectExportDescriptorsForName`) — this is a pure extraction, no
behavior change, and is covered by rerunning the same regression suite
before/after.

**Regression fixtures** in `test/jsdoc-inventory-detector-fixes.test.ts`
(the existing P1-B harness): documented-first-signature overload group →
single resolved entry; fully undocumented overload group → single open entry
(not one per signature — required inserting a documented sibling export ahead
of the undocumented group in the fixture, since TS/ts-morph associates a
`@packageDocumentation` comment with the very next declaration when nothing
else sits between them — a pre-existing ts-morph JSDoc-association behavior,
not something introduced here); malformed doc block on the *non-anchor*
signature still surfaces and keeps the group open (proves the "any doc block
in the group" aggregation, not just the anchor's).

**Read-only jsdoc-inventory totals delta** (`writeJSDocDocumentationInventory`
run against the live repo, output redirected outside `standards/`, never
written to the tracked baseline): `@beep/identity`, `@beep/utils`, `@beep/nlp`
all report 0 open modules/exports (matching sf2-taila's prior fixes — those
packages' overload groups were already the specific ones named in the R19
background text). Verified each named symbol now resolves to exactly ONE
`"resolved"` entry: `chainRefinements` (`@beep/utils`, 12 overload signatures
in source collapsed to 1 scored entry — confirmed by counting
`function chainRefinements` occurrences in `Predicate.ts`), `expand`/
`contract`/`expandPredicate` (`@beep/identity`), `Fn`/`ThunkOf`
(`@beep/schema`). `@beep/schema` itself still has 29 open exports overall
(unrelated pre-existing gaps, not overload-related).

## 6. Corpus family (direct — original worker never started)

The dispatched Corpus-family worker made zero writes (confirmed via
`git status`/file mtimes before starting). Executed directly:

- **5 SFV4-normalization fixes** in `Corpus.service.ts` (see §1, items 1-5).
- **AL new-map-set**: all ~15 native `Map`/`Set` call sites in
  `Corpus.service.ts` converted to `MutableHashMap`/`MutableHashSet` (see §2,
  item 6/7), plus `Corpus.recyclebin.ts`'s two pairing maps (§2, item 5).
- **AL object-method**: `Object.entries(clientMap)` → `R.toEntries(...)` in
  `loadClientMap`.

One real regression surfaced and was fixed during the final proof pass: the
fallow audit (`bun run beep quality fallow audit --check --base origin/main`)
flagged `exportedDeclarationsFor` (my R19 change) as an *introduced* cognitive
complexity finding (cognitive 17, `exceeded: cognitive_crap`, severity
moderate) — fixed by the helper-extraction refactor described in §5, which
brought `complexity_introduced` down from 3 to 2 (the remaining 2 are both in
`packages/drivers/ecfr/scripts/generate.ts`, entirely outside this lane's
fence — a different concurrent lane's work, not touched here).

## Commands run (final proof battery)

- `npx tsgo -b tsconfig.json` (package root) — **0 errors**, both before and
  after the Corpus direct-execution + complexity-refactor round.
- `npx vitest run` (full package suite) — **594/594 passed** (all files except
  `test/architecture-operation-plan.test.ts`, which has 5 pre-existing failures
  caused by a different concurrent lane having deleted
  `packages/architecture-lab/{use-cases,server,tables}/src/entities/index.ts`
  — confirmed via `git status` showing those exact 3 files as `D` outside this
  lane's fence; not touched, not caused by, and not fixable from within
  `packages/tooling/tool/cli`).
- `bunx biome check` / `--write` on all 20 touched files — 6 formatting
  fixes applied (auto-format only, re-verified clean and re-ran the full
  suite + `tsgo -b` afterward with no behavior change).
- `bun run beep quality fallow audit --check --base origin/main --out
  .beep/fallow/audit.json --quiet` — `dead_code_introduced: 0`,
  `duplication_introduced: 0`, `complexity_introduced: 2` (both in
  `packages/drivers/ecfr`, outside fence — zero introduced findings
  attributable to this lane after the `exportedDeclarationsFor` refactor).
- `bun run beep lint schema-first` (read-only) — all 26 assigned entries plus
  all 21 curated `PERMANENT_SCHEMA_FIRST_EXCLUSIONS` additions confirmed
  resolved/silent via the live scan; zero new untracked findings anywhere
  under `packages/tooling/tool/cli/**`.
- Read-only `writeJSDocDocumentationInventory` run (output outside
  `standards/`) — R19 delta confirmed per §5.

No `standards/*.jsonc` file was written. No commits made. No inventory regen.
All throwaway probe scripts were deleted immediately after use (none
committed, none left behind — verified via `git status`).

## Summary (≤10 lines)

26/26 schema-first entries fixed and confirmed stale via live scan. 8/8
allowlist entries converted (Map/Set→MutableHashMap/MutableHashSet,
Object.entries→R.toEntries, Date.parse→DateTime.make). R17 (both items) + a
ratified fn-schema-loop exclusion-check extension implemented with fixture
pairs; 21 PERMANENT_SCHEMA_FIRST_EXCLUSIONS entries curated (11 R17 + 7 R18 +
2 conditional test-utils, plus 1 fn-schema), all probe-verified silent. R19
(jsdoc overload-group consolidation) implemented with 3 fixture cases;
confirmed chainRefinements (12→1) and 4 other named symbol groups collapse
correctly; a self-caused complexity regression was caught by the fallow audit
and fixed via helper extraction. Corpus family batch (worker never started)
executed directly. Full battery green: tsgo 0 errors, vitest 594/594,
biome clean, fallow 0 introduced (in-fence), schema-first scan clean.
