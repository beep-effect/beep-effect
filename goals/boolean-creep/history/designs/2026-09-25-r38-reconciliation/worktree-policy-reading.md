# worktree-policy-reading

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 30/3. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `PolicyReading` at `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:1021`,
with members `probeFailed`, `movement`, `reason`.
Storage/exposure: derived/internal; target: tagged-union.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/worktree-policy-reading.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

# Current shape

R28 P2 design for stable `worktree-policy-reading`. Incoming source: immutable main `3bb59f37c02b7d677c6a5b58651fe85bb4bb5943`; census predecessor HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`. The successful R28 R–Z/Yeet contract corrections independently confirmed source eligibility; this is designed, with independent P3 design review still pending. Historical source and prior-design byte receipts are preserved by `data/r28-cli-last-integration.json`; incoming source equality and this proposed revision are bound separately by the public source-impact audit and source-bindings receipt.

`packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:1017–1022` declares private `PolicyReading` with `probeFailed:boolean`, movement from `FleetPolicyMovement`, nullable reason from `FleetUnknownReason`, and required `ReadonlyArray<string>` paths. The actual E3 relation is Boolean/reason presence. Movement has all three declared literals, and reason retains null plus all four declared literals (`Worktree.schemas.ts:876–921`). Required paths do not contribute a Boolean member.

The only failed writer (`Fleet.service.ts:1024–1029`) is true/unknown/probe-failed/empty. The only success writer (`:1045–1047`) is false/moved/null/nonempty paths or false/unmoved/null/empty paths. The probe is `git diff --name-only -z <mergeBase> <targetSha> -- ...FLEET_POLICY_SURFACE` (`:1036–1041`). Keep the complete policy-surface list at `Worktree.schemas.ts:527–544`, including globs and operand ordering. `runGitProbe`/`gitStdout` at `Fleet.service.ts:473–496` preserve failed-spawn, truncation and nonzero handling; `nulPaths` at `:498` removes only empty NUL-delimited entries and retains full remaining strings and order.

# Cardinality gap

For `[probeFailed,movement,reason]`, representable cardinality is 2×3×5=30. The three supported tuples are:

| probeFailed | movement | reason | Full payload constraint |
| --- | --- | --- | --- |
| false | moved | null | Nonempty exact parsed path array |
| false | unmoved | null | Empty array |
| true | unknown | probe-failed | Empty array |

The old 60/3 count incorrectly doubled the product for required-array emptiness. Removing that invented member does not remove movement's full enum domain or collapse all nullable reasons into one presence bit. Other reason literals are declared alternatives in this carrier's type but are never produced here. They remain legitimate at the later PolicyDerivation/DerivedSignals owners; do not delete them there.

The public scan fixture at `test/worktree-fleet-scan.test.ts:241–288` proves moved and unmoved paths under a materialized target. `:290–322` exercises target-unmaterialized at the later owner and requires zero degraded checkouts; that fixture must not be relabeled a failed policy probe. The failed reader tuple follows the explicit Option branch at `Fleet.service.ts:1043–1049`, not generic schema permissiveness.

# Target schema

Reuse the existing `FleetPolicyMovement` LiteralKit as the discriminator vocabulary for a private schema-owned `PolicyReading` union. Define named annotated cases with `movement: S.tag(...)`: moved carries `paths: S.NonEmptyArray(S.String)`; unmoved has no payload; unknown has no payload and specifically means this reader's failed probe. Assemble members from the existing kit's moved/unmoved/unknown members and finish with `S.toTaggedUnion("movement")`. Do not create a duplicate movement or unknown-reason vocabulary, and do not retain stored reason/probeFailed/empty paths on the payload-free arms.

Project the cases once into the unchanged PolicyDerivation fields at `Fleet.service.ts:1087–1090`: moved→moved/null/the same paths/false; unmoved→unmoved/null/empty/false; unknown→unknown/probe-failed/empty/true. Derive failure from the schema-generated unknown guard. Keep the source's success empty/nonempty decision, using the Effect Array matcher that supplies a nonempty array to the moved constructor. A NonEmptyArray in that arm expresses a real payload constraint; it is not an extra census axis.

The private unknown case's fixed reason does not redefine `FleetPolicyMovement.unknown` globally. Public FleetCheckout and later derivations keep every existing unknown reason and their own independent failure aggregation. Keep this schema in the current owner module; no new service, export facade or persistent phase is needed. Target taxonomy remains `tagged-union` because moved carries paths.

# Migration inventory

Incoming preservation dependency: `Fleet.service.ts:540–561` requests `--porcelain -z`, awaits the effectful parser, and retains an unlisted clone on parse failure. Preserve its warning, null entry facts, head-unknown precedence and degraded coverage. This path bypasses these private readers; do not add a new reader case or count required payload arrays as axes. The new integration fixture `worktree-fleet-scan.test.ts:167–212` is part of the consumer proof.

| Exact location, relative to `packages/tooling/tool/cli/` | Required migration or preserved dependency |
| --- | --- |
| `src/commands/Worktree/Fleet.service.ts:1017–1049` | Replace private type/constant/writers with three cases; preserve the only legitimate movement outcomes and exact command operands. |
| `Fleet.service.ts:473–498`; `Worktree.schemas.ts:527–544` | Preserve capture/error/truncation handling, untrimmed NUL payloads and complete policy-path selection. |
| `Fleet.service.ts:1082–1091` | Sole direct consumer: project movement/reason/paths once and OR this reader's failure with branch-diff failure. Preserve sequential probe order. |
| `Fleet.service.ts:1052–1070,1155–1198` | Keep later flat PolicyDerivation and DerivedSignals contracts. Preserve merge-base failure, unknown-head precedence, unmaterialized-target precedence and independent conflict aggregation. |
| `Fleet.service.ts:1209–1236,1298–1315` | Preserve checkout fields, degraded coverage and contested path construction. Policy paths do not become claimed branch-diff paths. |
| `src/commands/Worktree/Worktree.schemas.ts:876–921,992–1015,1150–1164` | Reuse movement/reason domains; preserve complete public row/snapshot schemas and every nullable/array field. |
| `src/commands/Worktree/Fleet.command.ts:39–42,70–78,116–122,317–326` | Preserve MOVED labels, path display limits/order, exact unknown reason text and generic JSON output. |
| `src/commands/Worktree/index.ts:13,20,69`; CLI `package.json:66` | Existing command/service/schema facade and wildcard source exposure remain; private cases gain no public constructor. |
| `test/worktree-fleet-scan.test.ts:241–322`; `test/worktree-fleet.test.ts` | Preserve real Git scan and later unknown-reason fixtures, renderer and contested-path tests. |

The prior R28 graft caller lookup's missing edge for the private type was supplemented by exhaustive symbol/field search. The only invocation is at `:1082`, with four direct field reads at `:1087–1090`. Source inspection traced their projections through the later carriers to public rows and degraded coverage. The scan-test file was discovered separately and inspected; no absent edge was presented as complete consumer proof.

# Guard-deletion accounting

Delete the private stored probeFailed/reason fields and constant empty-path fields on unknown/unmoved cases. Replace coordinated movement/reason/path/failure reads with one schema-owned case projection. Retain exactly the success empty/nonempty decision that identifies moved versus unmoved, the probe Option branch and all later failure aggregation. Delete zero existing standalone validity guards: there is no separate PolicyReading coherence validator to remove. Do not claim that deleting four stored fields removes four defensive branches; the moved payload and movement discriminator still represent necessary information.

# Encoded-side impact

Tier 1, derived/internal. No private PolicyReading object is encoded. Public FleetCheckout retains exactly unknown/probe-failed/[], unmoved/null/[], or moved/null/full paths for this reader, and retains the other unknown-reason outputs generated later. The enclosing FleetSnapshot retains all fields, nulls, order, counts and path arrays.

`Fleet.command.ts:321` uses generic `printCommandJson(snapshot)`. The private union must therefore be projected completely before FleetCheckout construction; no tag, private case key or changed Option representation may reach JSON. Keep human labels and path truncation-for-display separate from the full JSON payload. The movement enum schema and compatibility of direct public FleetCheckout constructors remain unchanged; no new wire codec or decoder narrowing is proposed.

# Test impact

Retain the incoming NUL-listing degraded-clone fixture at `worktree-fleet-scan.test.ts:167–212`, including materialized target, one degraded checkout, null head/branch and head-unknown reasons. This enumeration failure is distinct from the private probe-failed case.

Preserve the actual mode-B scan fixture (`worktree-fleet-scan.test.ts:241–288`): main changes turbo.json, beta changes an unrelated source file, beta policy becomes moved while conflict stays clean and contested paths remain empty, and alpha remains unmoved. Retain the unavailable-target fixture (`:290–322`), where policyReason is target-unmaterialized and degraded coverage stays zero.

At implementation time, add controlled policy-probe failure with successful branch diff, successful empty output, and multiple NUL-delimited policy paths. Assert exact public movement/reason/path projection, failure OR behavior and captured generic command JSON. Preserve all four later reason literals, including head-unknown and not-live in their existing owners; do not route them through this reader's unknown constructor. Reuse the public FleetMirrorService scan seam and package-alias test imports. Run required CLI package verification only during implementation; no tests, Git fixtures or package commands ran for this P2 design.

# Risk

The main risks are absorbing broader PolicyDerivation/ConflictDerivation into this three-case reader, altering policy-surface filtering, or confusing unmaterialized/unknown-head observations with probe failures. Coordinate the shared consumer edit with `worktree-branch-diff-reading`, but do not require or implement the withdrawn ConflictDerivation design. This private collapse leaves its later source aggregation intact. No independent P3 approval accompanies this design.

Landing: use the ordered Tier 1E internal tooling subsystem batch. Worktree branch-diff reading precedes policy reading; edit their shared Fleet.service.ts consumer serially. Keep all shared-file edits serial and verify the completed subsystem batch.
