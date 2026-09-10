# P0.5 copy error-path contract conflict

Status: resolved by the original D8-authorized correction; all 21 Memory
conformance cases pass on Node and Bun. The earlier additional choice gate was
withdrawn; see the disposition and terminal proof below.

The pinned rc.112 testLayer copy case expects a failed copy with overwrite false
to carry the source path (FileSystem.test-utils.ts:180-185). The existing lab
engine documents a deliberate destination-path divergence, and its regression
asserts destination. A private Node v24.20.0 / Vitest 4.1.11 probe using the real
scratchpad MemoryFileSystem.layer reproduced the mismatch: expected source.txt,
received destination.txt. Exit 1. No filesystem source or existing test changed.

Attribution: inherited contract conflict, not a harness failure. Both existing
assertions cannot hold for the same failure. The upstream conditional allowance
for a successful no-op is not a workaround: the lab regression requires failure.
The user was asked whether to correct engine and regression to rc.112 source-path
semantics (recommended), or explicitly amend conformance to keep destination.
Do not infer an answer from elapsed time. Continue independent suite-port work;
keep the source-path conformance assertion unchanged pending a decision.

Private evidence: p05-copy-contract-node.json, p05-copy-contract-node.log and
.beep/p05-conformance-review in the filesystem publication worktree.

The complete existing scratchpad MemoryFileSystem test file also passes on both
Node and Bun: 17/17 tests under each runtime. This confirms that the failure is
a disagreement with the pinned conformance law rather than a pre-existing red
scratchpad regression suite. It does not satisfy the conformance gate. The
exact source hashes and runtime evidence are in p05-scratchpad-memory-runtime.json.


## Concrete unapplied proposal

Root prepared p05-copy-source-contract-proposal.patch and its JSON receipt in
private cache. The two-file proposal changes the overwrite-disabled AlreadyExists
metadata argument from toPath to fromPath, updates the regression's title and
expected path, and replaces the two comments that describe the old divergence.
It retains the failure requirement, AlreadyExists check, destination-content
preservation and every upstream conformance assertion. Live source shows only
one call to copyEntryUnlocked, from the public copy implementation.

`git apply --check` passed against the current filesystem worktree. The proposal
is not applied or runtime-tested; both source files retain their captured hashes.
This makes the existing user decision reviewable, not approved. If the source-path
choice is authorized, apply the proposal through the assigned source lane and
prove all 21 conformance cases plus all 17 existing Memory tests under Node and
Bun before any promotion. Retain the 12 new characterization cases for the
subsequent schema/helper refactor; their passing current-core results do not
replace conformance.


## Root disposition: original instruction controls

D8 and P0.5 already direct the exact pinned conformance suite and green Memory
behavior before promotion. Root therefore withdraws the extra decision request
it introduced. The equally precise source-path regression follows the original
user instruction; no answer or consent is inferred from silence. The bounded
p05-copy-contract-astra continuation now owns the exact two-file correction and
Node/Bun proof. See the dated DECISIONS.md entry. No conformance weakening,
promotion-before-green, scratchpad deletion or merge is authorized by this step.


## Terminal proof

The exact proposal is applied. All 21 conformance, 17 existing regression and
12 unchanged characterization cases pass on actual Node and Bun, with no skips.
Root reviewed terminal exit 0 and 912 input hashes: only the two authorized
files changed; the other 910 and the pinned/helper assertions are unchanged.
Canonical package-verify @beep/scratchpad exits 0 with docgen 22.4s; audit is
unavailable because this lab manifest has no beep:audit script. Full report:
history/lanes/p05-copy-contract-correction.md; private root acceptance receipt:
p05-copy-contract-root-review.json. Minimal promotion can now proceed under D8;
its new public artifact will require its own conformance and package proofs.
