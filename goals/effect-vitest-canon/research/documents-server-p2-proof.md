# Documents Server P2 proof

This batch addresses the saved 157 actions: 147 detector findings, six resource
findings, three assertion findings and one configuration-dependent test. The
adjacent driver-failure suite also receives review. Source verification is
complete; source publication and inventory reconciliation are still pending.
This is a package milestone within the active goal.

## Preserved subjects and ownership

All twelve test files register through the instrumented runner. Public layer
hooks own static services with explicit ten-second budgets, preserving fresh
mutable state between cases. The existing native PGlite suites retain their
longer hook budgets, serial ordering, real migrations and SQL constraints.
Native filesystem subjects remain native: symlink escape rejection, inode and
procfs fallback, atomic publication, eight competing writers and exact bytes.
No live Box API or model-provider call is introduced.

Twelve ordinary Box adapter cases acquire a fresh fake and actual Ref-backed
adapter through a public layer. Eleven body-specific client scenarios retain
scoped providers so their callbacks, records and repeated-call cache assertions
remain owned by that test invocation. No mutable fake is shared across cases.
The drift restart scenario retains the same repositories and cursor across its
two engines; this is not a claim of process or database durability.

An AST comparison against `c1c4f145055b0f20cc8ca61e59fe15760573b497` accounts
for 364 original assertions, 97 original static titles, 33 selected fixture
initializers and every original body deadline. Eight aggregate Passed checks
are replaced by seventeen independent native properties with the same schemas,
equivalence predicates and ten-run floors. Original property group titles
remain visible. No existing oracle is weakened; new assertions are additive.

## Controlled regressions

| Subject | Positive proof | Negative control |
| --- | --- | --- |
| Fallback materialization | Returned path contains the exact input bytes on native storage | Skipping the write passed the old test and fails the new native read |
| Vacated path upload | Both public snapshot digests match their respective byte payloads | Reusing the first digest passed the old test and fails the new assertions |
| Truncated payload | Exact serialized 8192-character prefix plus original flag and length bound | An absent head passed the old test and fails the exact-prefix assertion |
| Retry budget | Explicit fixture config retains three attempts under hostile ambient values 1 and 4 | The original test fails when the ambient attempt budget is 1 |
| Driver-failure cleanup | Guaranteed rollback exposes cleanup defects after nine expected failures | Invalid rollback passed all three old cases and fails the repaired suite |
| Integration duplicate cleanup | Guaranteed rollback precedes unchanged typed conflict assertions | Invalid rollback passed the old integration file and fails after repair |
| Native properties | Original domains and equivalence predicates with a 400-run verification floor | Every independent inverted predicate fails with replay seed 20260708 and shrinking |
| Instrumented runner | Enabled trace emits name, start, failure outcome and duration | Disabled trace emits no diagnostic records |

Rollback changes repair test cleanup; this batch changes no production source.
Temporary mutation controls are restored and the runner probe is removed.
Byte-container comparison uses Effect Array conversion so Buffer versus
Uint8Array prototypes cannot obscure equality of the persisted bytes.

## Verification

Full package verification passes after module-level codec hoisting: audit
11.5 seconds and docgen 5.7 seconds. Root oxlint passes after that repair;
Sherif, Fallow health/audit, cache policy and schema-first checks also passed.
All 97 unit cases pass without skips on Node and Bun. Separately, all nine
native PGlite integration cases pass on both runtimes, with property verification
configured for 400 runs and replay seed 20260708.

Final unit timings are 5.225 seconds on Node and 2.719 seconds on Bun; baseline
observations were 6.328 and 3.570 seconds for 91 cases. Source hashes remain
stable across both final observations. Load and CPU/memory/I/O pressure are
recorded. Different case counts and workstation load mean these single
observations cannot establish a causal speedup. Integration proof is separate.

The runner dependency, generated TypeScript references and Fallow edges are
updated. The [cache review](documents-server-runner-cache-review.md) preserves
commands, configuration, qualification and unrelated nodes while adding the
runner dependency to the nine affected lists across fourteen owned nodes.

## Remaining goal gates

Inventory/census reconciliation and publication of timing artifacts follow the
source commit. The saved downstream packages, actual desktop HTTP authorization
regression, moving-main remainder, empty detector baseline, final adversarial
review and full repository/hosted closeout remain required.

## rc.118 merge revalidation

PR #1312 now includes main's rc.118 snapshot update. The earlier timings and
mutation controls above remain rc.117 evidence. On rc.118 the full Documents
package audit and docgen pass (14.2 and 5.9 seconds) after archiving stale Box
incremental build state; no production repair was needed. All seventeen inverted property predicates also fail on rc.118 with replay
seed 20260708 and shrinking. Current timings pass 97 unit cases with no skips:
Node 6.075 seconds and Bun 2.719 seconds, with stable source hashes. Nine
integration cases additionally pass on Node; the full package audit covers
Bun integration. These timings cross a dependency-version change from the
baseline, adding another reason not to claim a causal performance improvement.

## Remaining detector judgments

Nineteen syntax candidates remain after migration. Eleven scoped Box providers
retain body-owned pagination markers, name-conflict visibility/counters, seeded
file identities, separate transient/permanent failure clients, per-status probe
caches, malformed responses or refresh counters. The public fixture factory
returns a Layer to it.layer; it does not acquire or scope resources itself.

The intake Result is an explicit failure subject: an unconditional failure
assertion runs before the tag/reason guard and rejects unexpected success. The
restart history assertion compares the exact ordered pair of Options, jointly
checking cardinality, order and stored cursor payload. Five native filesystem
imports remain necessary for real bytes, symlink protection, inode/procfs and
atomic-publication subjects. These judgments are package-level dispositions;
they do not establish the goal's final empty-baseline requirement.

The six root policy checks pass again on rc.118. Fallow uses origin/main as its
explicit comparison base. Schema-first required only the SHACL exception's
relocated line anchor; its original disposition and rationale are unchanged.
