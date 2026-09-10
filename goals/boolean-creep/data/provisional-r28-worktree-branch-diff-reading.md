# Current shape

Full corrected P2 provisional for stable `worktree-branch-diff-reading`. Source is frozen at HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. This supersedes the proposed model in the current design only after parent integration; the current file remains unchanged, SHA-256 `0501251df715c3e35226e0b1597be18a7126cc4fcf1771b3cee91550fd6eee28`. Independent reconciliation and P3 remain pending.

`packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:986–990` declares the private `BranchDiffReading`: `count:number|null`, `paths:ReadonlyArray<string>`, `probeFailed:boolean`. The actual E3 cluster is `[probeFailed,count]`; the required paths array is payload, not an extra Boolean axis. `BRANCH_DIFF_PROBE_FAILED` at `:992` writes true/null/empty. The successful writer at `:1004–1006` stores `A.length(paths)` and false, including a measured empty array with count zero.

The reader runs exactly `git diff --name-only -z <mergeBase> <head>` (`:999–1001`). `runGitProbe` preserves untrimmed stdout and converts spawn failure or truncation to None (`:473–491`); `gitStdout` also converts nonzero exit to None (`:494–496`). `nulPaths` (`:498`) splits on NUL and removes only empty entries. It preserves the remaining strings, order, duplicate entries, spaces, newlines and other characters; it performs no path normalization or deduplication.

# Cardinality gap

The Boolean/nullability projection represents four tuples and permits two: true/null (failed) and false/non-null (measured). Empty success and nonempty success are values of the same full measured payload, not separate states for inventory counting. The old 8/3 count manufactured a required-array emptiness axis.

For any successful stdout, let `paths = nulPaths(stdout)`. The supported result has count exactly `paths.length`, including zero. There is no maximum cardinality or element-length restriction in the declared payload. Count values are derived from actual arrays; required-number zero/nonzero predicates do not become members. The public fleet scan fixtures exercise measured branch changes at `test/worktree-fleet-scan.test.ts:202–228` and a clean scan at `:133–165`. Failed-probe behavior is proven directly by the Option branches above; existing tests for an unavailable target exercise the separate later unmeasured path, not this reader's failure arm.

# Target schema

Use two private schema cases, `probe-failed` and `measured`, driven by a file-local `LiteralKit(["probe-failed", "measured"])`. Define named annotated `S.Class` cases with a `status: S.tag(...)` discriminator: the failed case has no payload; the measured case has `paths: S.Array(S.String)`. Assemble `BranchDiffReading` from the kit's members and `S.toTaggedUnion("status")`; derive the same-name Type and guards from the schema. No `as const` or custom predicate is needed.

The measured array deliberately accepts empty arrays. Do not retain the former measured-empty/measured-nonempty split, add a `NonEmptyArray` requirement to the successful case, or retain stored count/probeFailed fields. The exact count is derived when projecting into the existing `PolicyDerivation` fields at `Fleet.service.ts:1079–1084`: failed projects null/empty/true, measured projects array length/the same array/false. Do not defer the paths projection until FleetCheckout, because the path array also feeds contested-path detection.

Keep this schema private in the existing owner module. Its lifecycle does not require a public schema file, new service, codec or stored state. Reuse existing Effect Array helpers, LiteralKit conventions, identity composer and schema-derived matching. The target taxonomy remains `tagged-union` because only the measured case carries a payload.

# Migration inventory

| Exact location, relative to `packages/tooling/tool/cli/` | Required migration or preserved dependency |
| --- | --- |
| `src/commands/Worktree/Fleet.service.ts:986–1009` | Replace the private type/constant/writers with two schema cases. Keep command arguments and probe failure behavior unchanged. |
| `Fleet.service.ts:473–498,977–984` | Preserve capture bound, trim=false, nonzero/truncation handling, NUL parser and merge-base resolution. |
| `Fleet.service.ts:1075–1085` | Sole direct consumer: project count and paths once, derive this reader's failure through the schema, and OR it with the independent policy-reading failure. Preserve branch-diff-before-policy probe order. |
| `Fleet.service.ts:1046–1064,1149–1192` | Keep later flat PolicyDerivation/DerivedSignals fields and all unknown reasons. Preserve merge-base failure and head-unknown/target-unmaterialized precedence. Do not apply the private E3 invariant to their shared aggregate probeFailed. |
| `Fleet.service.ts:1203–1230` | Preserve FleetCheckout branchDiffCount, final degraded decision and `surface = dirtyPaths ++ branchDiffPaths`. Do not discard measured paths when policy or conflict independently fails. |
| `Fleet.service.ts:1292–1309` | Preserve contested index input/order, checkout rows and degraded coverage count. |
| `src/commands/Worktree/Worktree.schemas.ts:971–994,1129–1143` | Preserve complete FleetCheckout and FleetSnapshot public schemas, including nullable counts and all unrelated fields. |
| `src/commands/Worktree/Fleet.command.ts:58,116–122,317–326` | Preserve human null/zero/count rendering and generic `printCommandJson(snapshot)` output. |
| `src/commands/Worktree/index.ts:13,20,69`; CLI `package.json:66` | Preserve command/service/schema facade and wildcard source export. The private reading gains no exported constructor. |
| `test/worktree-fleet-scan.test.ts`; `test/worktree-fleet.test.ts:117–203` | Preserve end-to-end scan fixtures, porcelain rename parsing and contested-index semantics. |

Graft's incoming graph had no edge for the private type, so it was not treated as absence proof. Its exhaustive source search located the one invocation at `:1075` and three direct field reads at `:1079–1084`; exact source inspection followed the paths through both later carriers, degraded coverage and contested indexing. Test discovery also found `worktree-fleet-scan.test.ts`, which the narrow indexed search had not returned.

# Guard-deletion accounting

Remove stored count and probeFailed from the private reader and the flat failure constant; one schema-derived case match replaces three correlated property reads. The nullable count exists only in the unchanged projection. Delete zero independent runtime guards: there is currently no separate count/path consistency validator to remove. Keep Option selection for probe success/failure, merge-base guards, NUL filtering and aggregate failure ORs. Do not claim deletion of an emptiness guard that only existed in the old design; the actual branch reader never branches on empty paths.

# Encoded-side impact

Tier 1, derived/internal. The private reading is not encoded. FleetCheckout keeps `branchDiffCount:null` on this failure, `0` on empty measured success and the exact positive array length otherwise. `branchDiffPaths` remains internal input to the contested index; it must not be added to FleetCheckout JSON or dropped from the index. FleetSnapshot retains every existing field and property order.

The CLI uses generic `printCommandJson(snapshot)` at `Fleet.command.ts:321`, not a dedicated schema encoder; this is safe only because the private tagged cases are fully projected before FleetCheckout/FleetSnapshot construction. No new tag, paths key or Option wrapper may escape into the public row. Preserve all existing explicit nulls, arrays, string payloads and generic serialization behavior. No boundary codec migration is needed when that projection remains exact.

# Test impact

At implementation time, extend the existing public FleetMirrorService scan test seam (`worktree-fleet-scan.test.ts:29,113–124`) to cover a zero-exit empty branch diff, one/multiple NUL paths, and branch-diff failure with policy success. Preserve the scratch-fleet mode-B case (`:194–241`), where branchDiffCount is one, policy moves, conflict stays clean and contested paths stay empty. Capture a failure through controlled process behavior without changing production command order; distinguish nonzero exit, spawn failure and truncation where the existing process test layer can supply them.

Verify the complete FleetSnapshot value and captured generic command JSON, especially null versus zero, exact path order and contested membership. Keep the existing porcelain rename/source-path tests; do not confuse their status-record counting rule with the branch reader's array length. Do not expose private cases through the public facade only to test them. Run required CLI package verification during implementation. No tests, Git fixtures or package commands ran for this provisional design.

# Risk

The principal risks are treating empty success as failure, losing paths before contested indexing, or using the private failure bit to overwrite later policy/conflict failure aggregation. Coordinate the sole consumer edit with `worktree-policy-reading`; do not depend on implementing withdrawn ConflictDerivation, ProcessScan or StatusRecord designs. Their source behavior remains unchanged. This is data-only P2 work with no canonical or independent-review status advance.
