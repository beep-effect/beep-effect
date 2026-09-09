# R28 dependent design addendum

Native P2 design handoff after the finalized `data/design-refresh-2026-09-09-r28-cli-last-owners.md` audit. That audit remains immutable at SHA-256 `1be08eed3b51b2b3bfcf71392266de7c7d22ff6c6cc338df8344b97435de979d`; its three earlier provisionals are not changed. Source remains frozen at HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.

This worker authored only the three new provisional designs listed below and this addendum. No product code, tests, package command, current design, canonical inventory, archive, report, service, index or ref was changed. The parent owns independent correction, canonical integration and review status; this is not P3.

## Complete corrected designs

| Stable ID | New data-only provisional | Material correction |
| --- | --- | --- |
| `worktree-branch-diff-reading` | `data/provisional-r28-worktree-branch-diff-reading.md` | Correct actual `[probeFailed,count]` cardinality to 4/2. Replace the prior measured-empty/measured-nonempty model with one measured case carrying the complete array, including empty. Derive count at the existing PolicyDerivation projection; preserve the separate contested-path consumer. |
| `worktree-policy-reading` | `data/provisional-r28-worktree-policy-reading.md` | Correct `[probeFailed,movement,reason]` to 30/3 without required paths as an axis. Reuse the existing movement LiteralKit for private moved/unmoved/unknown cases, retain full moved paths and derive this reader's fixed failure reason only at its current projection. |
| `yeet-merge-ready-verdict` | `data/provisional-r28-yeet-merge-ready-verdict.md` | Preserve 4608/1025 and all nonfirst blocker choices. Add the missing generic command JSON boundary migration and coordinate its inverse with the remote-status adapter. Full existing criteria, artifact codec, legacy normalization, consumer and test plans are retained. |

The Worktree drafts explicitly preserve the later flat PolicyDerivation/DerivedSignals intersection and its independent failure ORs. The withdrawn ConflictDerivation, ProcessScan and StatusRecord designs are not prerequisites. In particular, `Fleet.service.ts:1230` appends branch-diff paths to dirty paths before contested indexing at `:1292–1294`, while policy paths only feed the policy signal. Projecting or dropping those paths at the wrong boundary changes behavior despite correct public counts.

The source's public `worktree fleet --json` route is generic `printCommandJson(snapshot)` at `Fleet.command.ts:317–326`, not a dedicated FleetSnapshot schema encoder. Both private unions must be fully projected before the public class constructors. The new designs preserve the old nulls, full strings/arrays, exact count values, row ordering and generic serialization; they add no wire codec or public schema narrowing.

## Yeet readiness adjudication

The current readiness design already includes `failing` among its members (line 6), preserves the full 4608/1025 domain (lines 17–19), accepts nonfirst named blockers, keeps the independent broad criteria schema, and describes the nested encoded criteria shape accurately (lines 69–85). Thus the missing inventory member and reanchoring the separate encoded D1 row alone do not demand a different model. The current source coherence filter's named-blocker branch is `Verdict.ts:347`; the provisional also corrects the old evidence anchor at341 and filter start319 to330.

Withdrawing `r2-tooling-sweep-plan-operator-handoff` does not create a source dependency repair. `designs/yeet-merge-ready-verdict.md` contains no SweepPlanStep/precondition/operator migration. The source shared between monitor and sweep orchestration does not make the SweepPlanStep schema part of the readiness model. `PLAN.md:263–264` lists the old sweep item earlier in Tier2 order; the parent should remove the withdrawn plan entry while preserving every actual sweep call and wire field. No source redesign of that step is needed for readiness.

A full corrected readiness provisional is nevertheless required because of a separate, directly verified consumer omission: `Handler.ts:1248–1253` writes the snapshot artifact and then passes the decoded snapshot to `printCommandJson`. `Status.ts:281,311,1391` supplies the artifact codec, but `src/internal/cli/Json.ts:16,176–180,296–302` encodes the unknown runtime value. Merely nesting the readiness compatibility codec in YeetStatusSnapshot cannot prevent internal readiness tags from appearing on this command output.

The existing remote-status design already identifies that boundary (`designs/yeet-status-remote-check-phase.md:134–145,179,223–232`) and projects only `snapshot.remote`; it explicitly preserves all other snapshot values. The readiness provisional therefore composes a projection of the Some readiness value into the same bounded printer. Its single union-to-old-decoded inverse preserves the outer mergeReady Option, inner failing Option, full broad criteria and Greptile Option. Artifact optional-key encoding remains separate. Do not replace generic command printing with the artifact encoder or silently normalize runtime Option representations. Capture and compare both outputs independently, including payloads beyond 64 KiB, all relevant None/Some cases and a later named false blocker.

## Exposure and test proof

For the Worktree readers, Graft returned no incoming type edge; a subsequent exhaustive symbol/field search located the exact invocations and reads at Fleet.service.ts1075–1084. The paths were followed through PolicyDerivation, DerivedSignals, deriveCheckout, coverage and contested indexing. Public exports remain Worktree/index.ts13,20,69. The public scan integration file `test/worktree-fleet-scan.test.ts` was discovered outside the narrow graph result and inspected. Its materialized-target fixture133–165, mode-B moved/unmoved fixture194–241 and unmaterialized-target fixture243–275 are preserved; the latter's zero degraded count must not become a policy-probe failure. Existing tests were read, not run.

For readiness, the complete incoming graph names Status, Handler, MonitorLoop, Porcelain and Yeet.command. Direct source searches additionally established the JSON path above and the existing artifact/observation readers. Current schema codecs and producer projections from the prior design are preserved in full; the new printer composition closes the identified gap without a new serializer or public facade.

## Current design byte preservation

| Current design | SHA-256, unchanged |
| --- | --- |
| `designs/worktree-branch-diff-reading.md` | `0501251df715c3e35226e0b1597be18a7126cc4fcf1771b3cee91550fd6eee28` |
| `designs/worktree-policy-reading.md` | `9cfea2d50434661ecaa00f82cbe1f08164300c78e1bb6d42294cdaf4611002e4` |
| `designs/yeet-merge-ready-verdict.md` | `d7dffcd24a674ec5f0ecfce63e1296e425eb249080b22b8aadfbff1b3b84bd14` |

## New provisional byte receipts

| File | SHA-256 |
| --- | --- |
| `data/provisional-r28-worktree-branch-diff-reading.md` | `b30643a2a6d6de2559f69dd6a928c384f057c83a33c0a7e31be0e4da2d4cdd40` |
| `data/provisional-r28-worktree-policy-reading.md` | `c02cc3f9270d8d229bbef8394088232751a4a2187194a5a8e0fa8007b32f7ee2` |
| `data/provisional-r28-yeet-merge-ready-verdict.md` | `e1755881db081f3449b0bec7fe24c4cb1df4af92fd49a436daac2654a99efd5e` |

## Frozen source evidence

Each following file matched `git show HEAD:<path>` byte for byte.

| Source/test file | SHA-256 |
| --- | --- |
| `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts` | `2ab4c2b6a0404d305b45e32db7239ec72d29d61244ae47dac6201a4490cb741d` |
| `packages/tooling/tool/cli/src/commands/Worktree/Fleet.command.ts` | `35c08fd02fc30e78a0c5b8492a018673715a1026869a2282875f53ca2a8a0b8c` |
| `packages/tooling/tool/cli/src/commands/Worktree/Worktree.schemas.ts` | `d723d71d33f69b007b78c5824756c3a2c3519947fd0bf88f487c347249c3a168` |
| `packages/tooling/tool/cli/src/commands/Worktree/index.ts` | `6301b2115a50ab420b083920447a5871eb31f30055489cebfa978f63ef0b99ca` |
| `packages/tooling/tool/cli/test/worktree-fleet-scan.test.ts` | `b2fadd88fd014ca6849170e7fc55079034db8ef9377a016c53719e5a439c34e2` |
| `packages/tooling/tool/cli/test/worktree-fleet.test.ts` | `79f92b45d889c9d887ef2ab7c55fb26d8c39f4f66c39072da75a94b1454381ea` |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts` | `c05da661e2bb3c60bfbdc071b6e1eac0b25406a5b3ff693c158ffdd0569388d7` |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts` | `16327655d872c7ce2403ac717f0606a2a0e2d676c2e5dc8ed24fa9058d72852f` |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts` | `c80a859974ba95a2fa7255a750bd4cac19f6be6a2cb8526eebfdc8d90929cd6b` |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts` | `f3e27eecd4ddbc64429db3d09ffced2aa71d2c0cb1eefb842ce019d1e6d62d9a` |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchMode.ts` | `142d71428a12f02c6f0f7c5a2dc2a67401f52d6b4202473b70b77fdeba58cddd` |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts` | `354867c7a8efa22f0e61a5ce0fdc7684a85c82e814733210bb7105dc4a7bed61` |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Porcelain.ts` | `f1eabcd1a1544e1022fa8e1a4a49781252a2cc8b2c17e3587101c589d8d4b9d2` |
| `packages/tooling/tool/cli/src/internal/cli/Json.ts` | `836450fb0bd3dbba3d8f6c61567744b30149af3941a58a7ca2d1a8b8b2e57453` |

## Validation and handoff

All three full provisionals have exactly the eight required headings: Current shape, Cardinality gap, Target schema, Migration inventory, Guard-deletion accounting, Encoded-side impact, Test impact, Risk. Current design hashes, finalized last-owner audit hash and both source pins were rechecked. The fourteen source/test files above matched frozen HEAD. No package tests, schema execution, services or Git mutations occurred. The designs remain native proposals, not applied or independently reviewed work.

The parent should preserve the current design bytes before replacing them during integration. The two Worktree designs share one consumer span and should coordinate that edit. Readiness remains a Tier2 compatibility migration and must compose with the remote-status printer. No new census record, replacement inventory ID, withdrawal action or independent Grok request is added by this dependent-design handoff.
