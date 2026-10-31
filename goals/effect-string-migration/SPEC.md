# effect/String migration Spec

## Objective

Move native String method calls to effect/String so @effect/tsgo 0.55+ can arm preferEffectString at error

## Non-Goals

- No behaviour change: a rewrite whose result type changes (`Option`,
  `NonEmptyArray`) keeps the caller's observable result.
- No suppression comments, `@effect-diagnostics` directives, declared-off
  entry or other exception inventory for `preferEffectString` (S31).
- tsc-rs and the root compiler maps stay untouched; the rule lives in the
  standalone profile until tsc-rs knows its name.

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

- Native `String.prototype` calls in workspace source and tests
  (`research/census-2026-10-21.md`).
- `package.json` catalog `@effect/tsgo` (0.54.1 → the 0.55+ release in hand).
- `preferEffectString: "error"` in `tsconfig.base.json` and the compiler
  profiles consumed by Check (the standalone profile and its loader were
  retired by goals/tsrs-gates).
- `docs/runbooks/typescript-toolchain.md` and the `syncpack.config.ts` pin note.

## Constraints

- Split by package family so each PR stays reviewable and avoids colliding
  with live lanes; the pin moves only in the PR that arms the rule.
- Rewrite the 766 shape-changing sites by hand or with reviewed Codex lanes;
  only the 647 "Same runtime behavior" sites may go through a codemod.
- Follow the AGENTS.md code laws: `effect/String` imported as a namespace
  from its leaf path.

## Acceptance Criteria

- [x] `@effect/tsgo` is at 0.55 or later and `preferEffectString` is `error`
      in the compiler profiles consumed by Check.
- [x] Repo-wide Check completes with zero `preferEffectString` findings across
      every Check compiler program, and `bun run beep quality tsgo-rules` passes.
- [x] The declared-off ledger is unchanged (5 rules).
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/effect-string-migration/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-string-migration/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/effect-string-migration` | Passes |

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
| 2026-10-21 | Ship the tsgo bump at 0.54.1 and move `preferEffectString` here. | The 0.55.0 census found 1,413 sites in 365 files; declaring it off would grow the exception inventory (S31). | Move the pin to 0.55+ with the rule at error once the sites are gone. |
| 2026-10-21 | Migrate in package waves, quietest packages first; repo-cli (674 sites) goes last. | Packages with few open lanes keep conflicts low; whole-package waves give each PR a zero-finding proof. | Re-order the remaining waves; no migrated site depends on order. |
| 2026-10-21 | Prove each wave with a temporary local 0.55.0 install and `effect-diagnostics --filter`, reverted before commit. | The pin moves only in the arming PR, so hosted CI cannot see the rule until then. | Drop the temporary step once the pin is at 0.55+. |
| 2026-10-21 | Fallbacks for Option results that cannot be empty use `constant(...)` from `effect/Function`, not a new arrow. | A never-called arrow is a new uncovered function and line, which the coverage ratchet counts. | Replace with an arrow plus a test that reaches it. |
| 2026-10-21 | Zero-import and hot-path modules keep native-free scanning without `effect/String` calls in their loops: anchored or positioned `RegExp.exec` and indexed character reads replace positional `indexOf`, `startsWith` and `charCodeAt`. | `effect/String` has no positional search, an `Option` per character slowed the ACP scanner 5x, and repo-cli's pre-fast-path modules must not import anything. | Revert to native calls behind a documented rule exception if a future rule release allows one. |
| 2026-10-21 | Split repo-cli's remainder into waves 5b (224 sites) and 5c (213) for review size, and hold its 7 files with open-lane hunks plus the root for 5d, which also moves the pin and arms the rule. | About 470 sites in one PR is too large to review, and the held files would conflict with open lanes. | Fold 5d's files into whichever wave is open when their lanes merge. |
| 2026-10-22 | Re-scope after the effected promotions: 1,730 sites remain outside #2008 (census at a959f5cd92, `research/census-2026-10-22.md`), about 1,500 of them in packages promoted from `scratchpad/effected` on 2026-10-21. They migrate in waves 6a–6f by package, 4b takes the non-effected remainder, and the old wave 5d is folded into 4b and 4c. | The promoted packages are on main and covered by the same rule; arming needs zero sites repo-wide, and no exception or baseline is allowed. | Re-plan the waves; the migrated sites stay valid either way. |
| 2026-10-22 | Hold `@beep/glob` (6d), `@beep/schema`, `@beep/utils`, `@beep/repo-utils` and ten repo-cli files (4c) until effected-promotion wave 2c merges; that owner lands waves 2d onward string-clean under the temporary 0.55 install. | 2c edits those files; parallel edits would conflict, and new packages would otherwise reopen the census. | Release the hold early if 2c is abandoned. |
| 2026-10-22 | `@beep/yaml` stringify `indent` (public `YamlStringifyOptions`, internal `StringifyOptionsInput` and the context) decodes through `IndentWidth`, a non-negative integer, instead of `S.Finite`. | `effect/String` `repeat` returns `""` for a negative count where native `repeat` threw `RangeError`; rejecting negatives and fractions at decode keeps a bad indent loud. `0` stays valid because a test pins its quote fallback. The package is private and new, so no published consumer breaks. | Widen the three fields back to `S.Finite` and restore native `repeat` at the seven indent sites. |
| 2026-10-22 | In-bounds character reads that relied on `charAt`'s empty-string result use a one-character `Str.slice(i, i + 1)`, never `x[i] ?? ""`. | The `??` fallback is a branch no test can reach, so it lowers per-file branch coverage and trips the ratchet (waves 6a, 6b, 6c and 6e); `Str.slice` keeps `charAt`'s semantics with no branch and no `Option`. | Any branch-free equivalent may replace it. |
| 2026-10-28 | Requalify closeout in a fresh PR with a new head-bound Yeet verdict; preserve #2027 as the implementation PR and retain its failed historical completion receipt. | Completion refresh observes required checks pending at the original merge and a failed merge-push required-status evaluation. Later green checks cannot establish readiness before that merge. The repository autonomy charter authorizes a new qualifying PR without an operator waiver. | Restore the original proposal and evidence reference; the packet then remains active with its historical gate unsatisfied. |
| 2026-10-28 | Use canonical publication and a new terminal readiness monitor after synchronizing main. | The direct-push fallback lacks the publish-mode receipt required by completion recovery; the earlier ready head was subsequently merged as #2318 while publication was running. Its declared local evidence does not establish a valid publication receipt for that accepted head. Full Check and root configuration qualification passed on the synchronized source. | Revert this packet update; completion remains active and unverified until valid publication and merge evidence exists. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
