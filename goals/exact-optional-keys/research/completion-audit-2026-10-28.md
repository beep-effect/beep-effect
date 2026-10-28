# Completion audit, 2026-10-28

The implementation shipped in [PR #2145](https://github.com/beep-effect/beep-effect/pull/2145).
GitHub reports accepted head `a9d45c87fb4e613d59e53ef120d7c4dc21b1afd2`,
merge commit `93ed4b751e9f0d6ea1d453762839877dcbf19c14`, and merge time
`2026-10-23T21:21:33Z`. The merge is an ancestor of the audited checkout
`ed0c4ec45e7beaed152ca811489ca1030d4b8879`.

## Fresh acceptance checks

- `beep lint schema-parity-codemod --rule exact-optional-keys --path packages
  --path apps --path scratchpad --path infra`: scanned 8,428 files, 221
  candidates, zero changed files, residue, or quarantine.
- `vitest run --project @beep/repo-cli
  packages/tooling/tool/cli/test/schema-parity-codemod-exact-optional-keys.test.ts`:
  15 tests passed. Fixtures cover member aliases, calls, pipes, stored functions,
  types, both companion declaration shapes, precision and reported residue.
- `vitest run --project @beep/lint-rules -t prefer-exact-optional-key`:
  two tests passed. The harness exercises the registered Biome rule's violation
  and allowed source fixtures.
- The scoped TypeScript rg census contains only fixture strings, documentation,
  and comments. No executable banned namespace member reference remains.
- `beep lint reflection-artifacts`: zero blocking or advisory findings.
- Launcher character limit, manifest JSON and packet whitespace checks pass.

## Historical hosted evidence

`beep goals completion refresh --slug exact-optional-keys` observed the
merge-push rule suite `4694155004` and all 17 required contexts green at the
accepted head before the merge. The rule suite passed and the historical
required-check inventory is complete. `yeet gh pr status 2145 --threads` reads
zero outstanding threads out of six.

The final head also has failed non-required checks: Fallow Advisory Envelopes,
Heavy / Lint Policy and Heavy / Coverage Regression. The implementation packet
already records its S11 disposition. These failures are preserved here; this
audit does not claim that every historical job passed.

The overall completion receipt remains `unknown` because its additional gating
reference, `.beep/yeet/runs/refactor_exact-optional-keys-512845b98164/verdict.json`,
is absent. The retained worktree retirement manifest confirms the original
branch and final head, but contains no archived material and no readiness
verdict. A merge and green required checks do not replace that declared proof.

## Completion route

[Closeout PR #2316](https://github.com/beep-effect/beep-effect/pull/2316) retains this audit and the fresh reflection,
names itself as the final PR, and declares its own Yeet verdict. Its exact-head
readiness and merge must pass the existing completion verifier. Initiative
status stays active until the derived completion receipt verifies. The original
implementation and its historical proof gap remain recorded separately.

## Rule recall repair

An additional acceptance probe found that the existing rule missed
`import * as Codec from "effect/Schema"; Codec.optional(Codec.String)` and
incorrectly flagged `const S = { optional: ... }; S.optional(1)`. The previous
fixtures used only conventional namespace names and did not exercise those cases.

The rule now binds namespace member references to an actual `effect/Schema`
namespace import, including type-only imports. New fixtures cover arbitrary
aliases in all three banned value forms, computed access, generic type positions,
and type-only namespace imports; local S/Schema objects and exact Codec forms
remain legal. Namespace binding uses Biome GritQL syntax nodes and structural
import patterns. Sources: [Biome GritQL reference](https://biomejs.dev/reference/gritql/)
and [Biome JavaScript grammar](https://github.com/biomejs/biome/blob/main/xtask/codegen/js.ungram).

The expanded focused rule suite passes (22 invalid references, zero valid-source
hits). `beep quality package-verify @beep/lint-rules` passes the complete package
audit and docgen (73.2 seconds and 6.4 seconds respectively).

## Publication

The local publication gate was stopped after 648 seconds in the documentation
inventory regeneration step. Previously reported local passes are retained;
unexecuted gates are not reported green. The direct push and draft PR route is
AGENTS.md's prescribed response after a local gate waits ten minutes. Hosted
CI on PR #2316 supplies the remaining authoritative proof.

Readiness artifacts must be retained in the owning clone before worktree
retirement. The final proposal remains `completed-retained` while operative
status remains `active` until completion refresh verifies the merge.

## Continued precision audit

The next audit reproduced false positives on exact exports renamed to banned
local names and on local parameters shadowing a Schema namespace. Import and
re-export checks now inspect source specifier names, not the entire statement's
text. Namespace checks use import syntax nodes, support combined imports, and
exclude shadowing parameters and direct local bindings. Type references retain
separate namespace lookup; `typeof` follows the value binding.

The expanded fixture suite passes with 28 invalid references and zero hits on
allowed forms, including nested sibling scopes, exact exports with renamed local
bindings, local methods and parameters, and shadowed `typeof` queries.

## Full package-verification accounting

All 25 registered workspaces touched by the original migration were checked.
23 default verifiers pass. Repo CLI has six ambient-cache wrapper failures with
a passing six-test local-only replay; scratchpad reproduces the same 443 docgen
metadata failures on clean main, with zero diagnostic delta. Commands, results
and attribution are in [package-verification-2026-10-28.md](./package-verification-2026-10-28.md).

All 33 hosted checks passed at published head `d92846e9cb`; the final update
requires fresh exact-head readiness. The classic `beep yeet monitor` command,
after the detached readiness loop, will write the declared readiness verdict.

## Review correction and complete before-census proof

The P2 discussion `4399481243` identified recursive parameter-list matching that
hid real Schema references. The fix matches direct parameter items, with four
regression cases. All 33 invalid references are detected; allowed input has
zero diagnostics. Full lint-rules audit and docgen pass after the correction.

The historical Biome replay over 8,301 tracked TS/TSX files yields exactly the
same 440 sites as the codemod and normalized text census. File, line, member
column and facet reconciliation has zero missing or extra matches. The raw
text count is 448 references on 446 matching lines, including eight enumerated
comments or strings. The machine-readable report retains all counts.

The follow-up P2 discussion `4399802834` reproduced constructor shadow false
positives because constructor parameters have a separate Biome node shape.
The direct-item constructor alternative handles formal, rest and property
parameters. Plain and private-parameter constructors are allowed, while a
nested callback parameter cannot suppress the actual Schema reference. The
focused regression fails before the correction and passes after it.
