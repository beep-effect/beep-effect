# worktree-branch-diff-reading

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 4/2. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `BranchDiffReading` at `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:995`,
with members `probeFailed`, `count`.
Storage/exposure: derived/internal; target: tagged-union.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/worktree-branch-diff-reading.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

# Current shape

R28 P2 design for stable `worktree-branch-diff-reading`. Incoming source: immutable main `3bb59f37c02b7d677c6a5b58651fe85bb4bb5943`; census predecessor HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`. The successful R28 R–Z/Yeet contract corrections independently confirmed source eligibility; this is designed, with independent P3 design review still pending. Historical source and prior-design byte receipts are preserved by `data/r28-cli-last-integration.json`; incoming source equality and this proposed revision are bound separately by the public source-impact audit and source-bindings receipt.

`packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:992–996` declares the private `BranchDiffReading`: `count:number|null`, `paths:ReadonlyArray<string>`, `probeFailed:boolean`. The actual E3 cluster is `[probeFailed,count]`; the required paths array is payload, not an extra Boolean axis. `BRANCH_DIFF_PROBE_FAILED` at `:998` writes true/null/empty. The successful writer at `:1010–1012` stores `A.length(paths)` and false, including a measured empty array with count zero.

The reader runs exactly `git diff --name-only -z <mergeBase> <head>` (`:1005–1007`). `runGitProbe` preserves untrimmed stdout and converts spawn failure or truncation to None (`:473–491`); `gitStdout` also converts nonzero exit to None (`:494–496`). `nulPaths` (`:498`) splits on NUL and removes only empty entries. It preserves the remaining strings, order, duplicate entries, spaces, newlines and other characters; it performs no path normalization or deduplication.

# Cardinality gap

The Boolean/nullability projection represents four tuples and permits two: true/null (failed) and false/non-null (measured). Empty success and nonempty success are values of the same full measured payload, not separate states for inventory counting. The old 8/3 count manufactured a required-array emptiness axis.

For any successful stdout, let `paths = nulPaths(stdout)`. The supported result has count exactly `paths.length`, including zero. There is no maximum cardinality or element-length restriction in the declared payload. Count values are derived from actual arrays; required-number zero/nonzero predicates do not become members. The public fleet scan fixtures exercise measured branch changes at `test/worktree-fleet-scan.test.ts:249–275` and a clean scan at `:133–165`. Failed-probe behavior is proven directly by the Option branches above; existing tests for an unavailable target exercise the separate later unmeasured path, not this reader's failure arm.

# Target schema

Use two private schema cases, `probe-failed` and `measured`, driven by a file-local `LiteralKit(["probe-failed", "measured"])`. Define named annotated `S.Class` cases with a `status: S.tag(...)` discriminator: the failed case has no payload; the measured case has `paths: S.Array(S.String)`. Assemble `BranchDiffReading` from the kit's members and `S.toTaggedUnion("status")`; derive the same-name Type and guards from the schema. No `as const` or custom predicate is needed.

The measured array deliberately accepts empty arrays. Do not retain the former measured-empty/measured-nonempty split, add a `NonEmptyArray` requirement to the successful case, or retain stored count/probeFailed fields. The exact count is derived when projecting into the existing `PolicyDerivation` fields at `Fleet.service.ts:1085–1090`: failed projects null/empty/true, measured projects array length/the same array/false. Do not defer the paths projection until FleetCheckout, because the path array also feeds contested-path detection.

Keep this schema private in the existing owner module. Its lifecycle does not require a public schema file, new service, codec or stored state. Reuse existing Effect Array helpers, LiteralKit conventions, identity composer and schema-derived matching. The target taxonomy remains `tagged-union` because only the measured case carries a payload.

# Migration inventory

Incoming preservation dependency: `Fleet.service.ts:540–561` requests `--porcelain -z`, awaits the effectful parser, and retains an unlisted clone on parse failure. Preserve its warning, null entry facts, head-unknown precedence and degraded coverage. This path bypasses these private readers; do not add a new reader case or count required payload arrays as axes. The new integration fixture `worktree-fleet-scan.test.ts:167–212` is part of the consumer proof.

| Exact location, relative to `packages/tooling/tool/cli/` | Required migration or preserved dependency |
| --- | --- |
| `src/commands/Worktree/Fleet.service.ts:992–1015` | Replace the private type/constant/writers with two schema cases. Keep command arguments and probe failure behavior unchanged. |
| `Fleet.service.ts:473–498,983–990` | Preserve capture bound, trim=false, nonzero/truncation handling, NUL parser and merge-base resolution. |
| `Fleet.service.ts:1081–1091` | Sole direct consumer: project count and paths once, derive this reader's failure through the schema, and OR it with the independent policy-reading failure. Preserve branch-diff-before-policy probe order. |
| `Fleet.service.ts:1052–1070,1155–1198` | Keep later flat PolicyDerivation/DerivedSignals fields and all unknown reasons. Preserve merge-base failure and head-unknown/target-unmaterialized precedence. Do not apply the private E3 invariant to their shared aggregate probeFailed. |
| `Fleet.service.ts:1209–1236` | Preserve FleetCheckout branchDiffCount, final degraded decision and `surface = dirtyPaths ++ branchDiffPaths`. Do not discard measured paths when policy or conflict independently fails. |
| `Fleet.service.ts:1298–1315` | Preserve contested index input/order, checkout rows and degraded coverage count. |
| `src/commands/Worktree/Worktree.schemas.ts:992–1015,1150–1164` | Preserve complete FleetCheckout and FleetSnapshot public schemas, including nullable counts and all unrelated fields. |
| `src/commands/Worktree/Fleet.command.ts:58,116–122,317–326` | Preserve human null/zero/count rendering and generic `printCommandJson(snapshot)` output. |
| `src/commands/Worktree/index.ts:13,20,69`; CLI `package.json:66` | Preserve command/service/schema facade and wildcard source export. The private reading gains no exported constructor. |
| `test/worktree-fleet-scan.test.ts`; `test/worktree-fleet.test.ts:117–203` | Preserve end-to-end scan fixtures, porcelain rename parsing and contested-index semantics. |

The prior R28 graft caller lookup had no edge for the private type, so it was not treated as absence proof. Its exhaustive source search located the one invocation at `:1081` and three direct field reads at `:1085–1090`; exact source inspection followed the paths through both later carriers, degraded coverage and contested indexing. Test discovery also found `worktree-fleet-scan.test.ts`, which the narrow indexed search had not returned.

# Guard-deletion accounting

Remove stored count and probeFailed from the private reader and the flat failure constant; one schema-derived case match replaces three correlated property reads. The nullable count exists only in the unchanged projection. Delete zero independent runtime guards: there is currently no separate count/path consistency validator to remove. Keep Option selection for probe success/failure, merge-base guards, NUL filtering and aggregate failure ORs. Do not claim deletion of an emptiness guard that only existed in the old design; the actual branch reader never branches on empty paths.

# Encoded-side impact

Tier 1, derived/internal. The private reading is not encoded. FleetCheckout keeps `branchDiffCount:null` on this failure, `0` on empty measured success and the exact positive array length otherwise. `branchDiffPaths` remains internal input to the contested index; it must not be added to FleetCheckout JSON or dropped from the index. FleetSnapshot retains every existing field and property order.

The CLI uses generic `printCommandJson(snapshot)` at `Fleet.command.ts:321`, not a dedicated schema encoder; this is safe only because the private tagged cases are fully projected before FleetCheckout/FleetSnapshot construction. No new tag, paths key or Option wrapper may escape into the public row. Preserve all existing explicit nulls, arrays, string payloads and generic serialization behavior. No boundary codec migration is needed when that projection remains exact.

# Test impact

Retain the incoming NUL-listing degraded-clone fixture at `worktree-fleet-scan.test.ts:167–212`, including materialized target, one degraded checkout, null head/branch and head-unknown reasons. This enumeration failure is distinct from the private probe-failed case.

At implementation time, extend the existing public FleetMirrorService scan test seam (`worktree-fleet-scan.test.ts:29,113–124`) to cover a zero-exit empty branch diff, one/multiple NUL paths, and branch-diff failure with policy success. Preserve the scratch-fleet mode-B case (`:241–288`), where branchDiffCount is one, policy moves, conflict stays clean and contested paths stay empty. Capture a failure through controlled process behavior without changing production command order; distinguish nonzero exit, spawn failure and truncation where the existing process test layer can supply them.

Verify the complete FleetSnapshot value and captured generic command JSON, especially null versus zero, exact path order and contested membership. Keep the existing porcelain rename/source-path tests; do not confuse their status-record counting rule with the branch reader's array length. Do not expose private cases through the public facade only to test them. Run required CLI package verification during implementation. No tests, Git fixtures or package commands ran for this P2 design.

# Risk

The principal risks are treating empty success as failure, losing paths before contested indexing, or using the private failure bit to overwrite later policy/conflict failure aggregation. Coordinate the sole consumer edit with `worktree-policy-reading`; do not depend on implementing withdrawn ConflictDerivation, ProcessScan or StatusRecord designs. Their source behavior remains unchanged. This is P2 design work; independent P3 design review remains pending.

Landing: use the ordered Tier 1E internal tooling subsystem batch. Worktree branch-diff reading precedes policy reading; edit their shared Fleet.service.ts consumer serially. Keep all shared-file edits serial and verify the completed subsystem batch.
