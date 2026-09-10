# R30 lane-footer occupancy question

Bounded native P2 closure. No new row or design is proposed.

The R30 Yeet lane footer says the live worktree-probe failure forces both
occupancy flags but exported fixtures retain main-true/branch-false inputs.
The live writer is `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts:750-756`.
It uses the same worktree-list reliability bit to force both flags true.

The direct fixture at `packages/tooling/tool/cli/test/yeet-sweep-plan.test.ts:814-821`
constructs `worktreeProbeUnreliable=true` and `mainCheckedOutElsewhere=true`.
Its base at :46-67 supplies `branchCheckedOutElsewhere=false`. Thus an actual
supported unreliable/true/false constructed state refutes collapsing the
class into an unknown case that requires both occupancy flags true. This is
stronger and more relevant to the implication question than merely pointing
to the reliable held-main fixtures at :279/:285, which are themselves valid
main-held/branch-free combinations.

`mainFreePrecondition` at Sweep.ts:267-270 and `branchFreePrecondition` at
:272-278 both prioritize the unreliable-probe blocker before inspecting the
independent occupancy values. The direct handoff fixture exercises the
complete class through `refreshNotCompletedHandoff`, and current P2 designs
explicitly preserve it. The proposed observer-only 8/5 whole cluster would
erase that supported tuple. No class-wide occupancy product is qualified.

The narrower implication unreliable=>mainCheckedOutElsewhere is not settled
by that witness, which leaves main true. A false main value under unreliable
is neither shown to be supported nor expressly excluded at the whole helper
seam by new evidence here. Do not misreport the branch counterexample as a
main counterexample, convert that uncertainty into D1, or invent another
record. The remaining main-specific question remains a source finding without
an established class-wide legal count, consistent with the packet's existing
non-admission boundary.

The main/branch occupancy pair alone does not express one shared phase:
distinct worktrees may hold either named branch, and the names and own-head
state remain separate facts. No full-domain D1 assertion is needed to close
this footer. Preserve the accepted status cluster, the accepted reliability/
address cluster, required branch strings, path Option/default, conservative
observer behavior, reliability-first blocker priority and partial constructed
fixtures. `lockfileMovedOnMainUpdate` is not a new cluster or part of this
closure. No follow-up scope or implementation is created.
