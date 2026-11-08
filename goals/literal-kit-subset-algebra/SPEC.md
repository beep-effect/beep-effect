# LiteralKit subset algebra and match family Spec

## Objective

Give `@beep/schema`'s `LiteralKit` and `MappedLiteralKit` a subset algebra that stays
inside the kit (`pick` and `omit` return kits). Rename `$match` to `match` and add
`matchOrElse`. Fix the construction and dispatch defects the 2026-10-22 review panel
verified. Amend the upstream-first census doctrine that let the subset facets retire.
Then propose `Schema.Literals.omit` and `Match.literals` upstream.

## Non-Goals

- Restoring `thunk`, `Options`, `HashSet` or `enumMapping` (all stay retired).
- A Match combinator on the kit (`whenLiterals`, `whenTags`).
- Renaming `is` or `Enum`.
- Renaming MappedLiteralKit's directional `Enum` (INBOX row, 2026-10-22).
- AST-derived helpers (`LiteralKit.of(schema)`; INBOX row, 2026-10-22).
- Rejecting `__proto__` as a literal, and a direct-index dispatch fast path.
- A changeset: `@beep/schema` is `private: true`.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/modeling/schema/src/LiteralKit/**`: the kit, its errors
  (`LiteralKit.errors.ts`) and its shared builders (`internal/builders.ts`).
- `packages/foundation/modeling/schema/src/MappedLiteralKit/**` and
  `SchemaUtils/withLiteralKitStatics.ts`.
- `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaParityCodemodLiteralKitMatchRule.ts`
  and its registration (rule `literal-kit-match-rename`).
- Every consumer the codemod rewrites (`$match` → `match`, re-wrapped `pick` →
  `pick`), plus hand migrations in `apps/labs/*` and
  `CitingApplicationIdentity.model.ts`.
- Doctrine: `standards/architecture/DECISIONS.md`,
  `standards/architecture/11-evolution-and-deprecation.md`, the standards docs
  that name `$match`, [goals/effect-schema-parity/SPEC.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/effect-schema-parity/SPEC.md),
  `explorations/effect-schema-parity/DECISIONS.md`, `explorations/INBOX.md`.
- Typeperf fixtures under `@beep/schema`'s typeperf suite.

## Constraints

- No alias: `$match` is removed in the same PR that migrates every reader (§11 rule 3).
- Encoded bytes do not change. `pick` and `omit` build schemas over the same literals.
- Instantiation counts on `@beep/schema`, `@beep/repo-cli` and
  `@beep/law-practice-domain` are measured single-checker before and after and
  recorded in the Decision Log. A regression needs a stated reason.
- Upstream work follows Effect's `CONTRIBUTING.md` and code style. Its prose goes
  through `/unslop`. It carries no AI attribution.

## Acceptance Criteria

- [ ] `Kit.pick([...])` returns `LiteralKit<P>` and `Kit.omit([...])` returns a kit
      over the complement. Both reject an empty argument at compile time, and `omit`
      rejects an empty complement at compile time and at runtime
      (`LiteralKitEmptySubsetError`).
- [ ] `match` is exhaustive with both overloads. `matchOrElse` passes the unhandled
      remainder to `orElse`. Unary handlers no longer collapse the return type
      to `never`.
- [ ] A dispatch miss throws `LiteralKitUnhandledCaseError`. Dispatch reads own
      properties only.
- [ ] Keys are derived once per construction. Record builders are O(n).
      MappedLiteralKit directional kits share the builders and gain `pick`, `omit`,
      `match` and `matchOrElse`.
- [ ] No `$match` read remains on a kit-typed receiver anywhere in `packages/` or
      `apps/`. No `LiteralKit(X.pick([...]).literals)` re-wrap remains.
- [ ] `CitingApplicationIdentity` uses `OfficeCode.omit(["US", "XX"])`.
- [ ] A typeperf fixture pair `literal-kit-large-untagged` (untouched and touched
      arms) has a baseline.
- [ ] Decision rows are in all four doctrine surfaces, and the two INBOX bullets exist.
- [x] Effect issues for `Schema.Literals.omit` (#9821) and `Match.literals` (#9822)
      are filed. PRs open after this lane merges.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/literal-kit-subset-algebra/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/literal-kit-subset-algebra/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/literal-kit-subset-algebra` | Passes |
| Schema package | `bun run beep quality package-verify @beep/schema` | Passes |
| CLI package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Dependents type-check | `bunx turbo run check --filter="...@beep/schema"` | Passes |
| Codemod idempotence | `bun run beep lint schema-parity-codemod --rule literal-kit-match-rename` | `changed=0 residue=0` |
| Instantiations | `--extendedDiagnostics --singleThreaded` on the three baseline packages | Recorded in the Decision Log |
| Schema catalog | `bun run beep lint schema-catalog --write` | No diff afterwards |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-22 | The kit overrides upstream `pick` to return `LiteralKit<P>` instead of adding `pickLiterals`. Its argument must be non-empty. | 24 sites re-wrapped upstream's bare `Literals` result. A second name beside `pick` would leave the weaker one as the default. Rulings: `research/2026-10-22-grill-rulings.md`. | Drop the override; the codemod's unwrap is the inverse of a mechanical re-wrap. |
| 2026-10-22 | `omit` is added and computes the complement. An empty complement is a compile error, and at runtime it throws `LiteralKitEmptySubsetError`. | An enumerated complement goes stale when the parent kit grows (§11 rule 6). `CitingApplicationIdentity` spelled out 238 literals. | Replace the `omit` calls with explicit `pick` lists. |
| 2026-10-22 | `$match` becomes `match`, exhaustive with both overloads. `matchOrElse` is added, and its `orElse` gets the remainder. No alias is kept. | This matches upstream `TaggedUnion.match` / `matchOrElse`. Upstream `Literals` has no `match` to collide with. §11 rule 3 forbids aliases. | Run the codemod rule in reverse (rename `match` back to `$match`). |
| 2026-10-22 | A dispatch miss throws `LiteralKitUnhandledCaseError`. Lookups are an own-property check (`R.has`) followed by one read, and only a value whose `typeof` has a keyer is looked up; anything else goes straight to the miss path. | Before, a miss called `undefined`, and an inherited key such as `toString` could dispatch. | Restore the direct index lookup. |
| 2026-10-22 | `withLiteralKitStatics` returns `S & LiteralKitStatics<L>`, a named exported interface; the `Pick` alias stays internal. | Copying `matchOrElse` made the inlined `Pick` expand past the declaration-emit limit. TS7056 hit `@beep/box` (`Box.errors.ts`, five sites) and `@beep/ui` (`country-select.tsx`, two sites). A named interface emits by reference. | Return the alias, or drop `matchOrElse` from the copied statics. |
| 2026-10-22 | Performance: single-checker instantiations, merge-base against lane, same compiler. `@beep/schema` drops 466,896 → 398,630, `@beep/repo-cli` 6,183,612 → 6,157,883, and `@beep/law-practice-domain` 1,015,133 → 815,028. The `LiteralKit` subpath's fixed import cost rises 3,187 (17,290 → 20,477), mostly from the two new tagged error classes. `kit.match` dispatch falls from 79 to 7 ns. Detail: `research/2026-10-22-performance.md`. | The performance decision of 2026-09-12 requires a number for every change. The packages that consume the kit gain far more than the fixtures lose. The fixed rise is the documented cost of typed miss errors, which replace a call to `undefined`. | Revert the lane. |
| 2026-10-22 | `literalKey` is a record keyed by `typeof` (with a `String` fallback for out-of-domain values), not an `effect/Match` pipeline. The grill ruled a `typeof` switch, but the native-runtime law bans `switch`; the record is the same single-lookup mechanism and measures the same (5–7 ns). | The grill ruling and the measurement: the module-level matcher added 2,639 instantiations to every importer. Together with the per-call `Option` lookup it made dispatch about 20 ns slower than the current path. The four arms are the closed `LiteralValue` union. | Restore the `Match.type` pipeline in `internal/builders.ts`. |
| 2026-10-22 | `standards/check-census.regression-baseline.jsonc` is rewritten with `effect-tsgo.0.55.0`, and two fixture rows are added (`literal-kit-large-untagged` and its touched arm). | The old baseline was measured with 0.51.1, and the gate refuses to compare across compilers. Every row needed a re-measure, and the new rows need baselines. | `git checkout` the previous baseline file. |
| 2026-10-22 | Three clone pairs that fallow's audit attributed to this lane are deduplicated: `phaseOrderValue` is exported from `RepoRun.models.ts` and reused in `Planner.ts`; `decodeJudgeInventory` in `JudgeIngest.ts` serves `judge-ingest` and `judge-lint`; and `RegistrationGeometry.plan.ts` builds both pending-changeset steps through `pendingChangesetOperation` with named wording tables. | The `$match` rename rehashed clones that already existed, so the audit counted them as introduced. Collapsing them was cheaper than suppressing them. | Inline the helpers back into their callers. |
| 2026-10-22 | Published over an inherited cheap-gate red: `fallow:health` and `fallow:audit` complexity on `runPlanExecution` (`Yeet/internal/Handler.ts`). It came in with #2076 (`d1070562cd`), which reds "Fallow Advisory Envelopes" on `main`. This lane only renames one `$match` call inside that function. | Inherited reds are fixed once on `main`, not copied into lanes (AGENTS.md "Inherited reds"). The precedent for a plain push over an inherited fallow red is the 2026-10-22 ruling for #1997. Resolved on `main` by #2079, which this branch merged on 2026-10-23. | N/A. |
| 2026-10-22 | Review round 1 on #2080: `matchOrElse` counts only required case keys as handled, `MatchReturn` keeps optional handlers' return types, the unhandled-case error accepts any runtime `value`, and `pick` / `omit` on both kits throw one `LiteralKitEmptySubsetError` naming the operation and argument. The census baseline is re-measured: `@beep/schema` +1,289, the large-kit pair +3,823, the import-only fixtures −603. | The increases are the price of fixing two type errors, each with a regression test. The gate admits an increase only with a stated reason, and this is it. Detail: `research/2026-10-22-performance.md`, "Update after review round 1". | Revert the fix commits. |
| 2026-10-23 | Close the packet as `completed-retained` while the merge-time completion receipt for #2080 reads `unsatisfied`. `proposedCloseout` is replaced by a declared final PR. | #2080 merged as `7055b05c88` through a ruleset bypass while five required Heavy checks (Check, Docgen, Doctest, Effect Diagnostics, Test Integration) were still pending at the accepted head `2991c0ac62`. The merge cancelled them, and the Lint and Test Unit aggregators then failed on the cancelled shards (`shards finished with result: cancelled`). The receipt counts zero required reds at the accepted head, so nothing is left to fix; it can never verify. The S44 orchestrator ruled the closeout on 2026-10-23. The Effect Diagnostics red seen earlier in the lane was inherited from #2092 and fixed on main by #2106. | `bun run beep goals set-status literal-kit-subset-algebra active`, then restore `proposedCloseout`. |
| 2026-10-22 | The codemod rule does not prune imports. The one file left with an unused `LiteralKit` import (`FileTypeChecker.behavior.ts`) was fixed by hand. | One site, reported by the type check; import pruning would add engine surface for no further use. | N/A. |
| 2026-10-22 | `apps/labs/semantica`, `apps/labs/lejeune-bolt-workbench` and `apps/labs/ciops` were migrated by hand: 13 `$match` calls and one statics key. Chalk's hand-rolled kit statics (`$match: kit.match`) were renamed by hand too. The codemod reran with `--path infra --path scratchpad` and rewrote 14 more reads in 10 files. | Its default roots are `packages` and `apps`. Inside the labs apps it did not resolve these receivers as kit-typed: no rewrite, no residue. It rewrites property reads, not object-literal keys. A repo-wide `rg` for `.$match` afterwards finds only `Data.taggedEnum` and tagged-union receivers. | N/A. |
| 2026-10-23 | Round-1 CodeRabbit follow-ups on #2080 (taken over by the TS7 session). The `literal-kit-match-rename` rule now renames `$match` only when the receiver's `Enum` and `is` resolve to a declaration in a LiteralKit owner module (`LiteralKitFacetOwnerModules`). The panel's citations are repo-relative, its `MatchReturn` section is labelled as before-state, and the `phaseOrderValue` example imports `@beep/repo-cli/test/RepoRun`. | Matching on the `Enum` and `is` names alone would also rename a local `{ Enum, is, $match }` object, which then fails at runtime. A regression test covers it. The repo is public, and `./internal/*` is not exported. | Restore the name-only `isKitTyped` check. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
