# P2 verification — 2026-10-09

Implementation and introduced compiler repairs: `c833513460`.
Merged base: `36027982f2`. No forbidden shipped contract edits, no new dependencies.

## Focused proof

- Domain single-file vitest: 5/5 pass; schema-derived value/polarity round trips,
  evidence/assertion bounds, duplicate refs, proposal identity and canonical JSON.
- Golden single-file vitest: 19/19 pass, repeated after compiler repairs. Four
  required positives, seven negatives, plus overlap, finite intersection,
  opaque modality, canonical objects and multiple matches.
- Every golden emission: full stamped entity decode, hasValidSeals true, content
  decode, shipped key/digest, stamped submit decode, opposite assertion fact
  shape and two distinct proposalIds.
- Every golden vector: TestClock adjusted one hour; repeated and reversed input
  outputs byte-identical. Arbitrary.checkEffect tests schema-derived strings
  for negation/conformance/permutation (seed 520).
- Package law checks and JSDoc lint: both packages pass, zero findings.
- Schema-first: pass; no missing entries/advisories or inventory edit.
- Doctest owner command applied markers to the 12 pure example fences.
- Purity scan: empty. Shipped values/Contradiction and entities/Contradiction
  diff against origin/main: empty.

## Heavy runs and attribution

All heavy commands use beep-heavy, 32G / concurrency 2, at most two owned jobs.
Results/logs remain in ignored `.beep/detection-proof/`.

- `bun run beep quality test-tsgo`: pass (330 CLI test files; 148 packages
  covered by package check scripts).
- Initial whole domain suite: pass. Initial domain package-verify: audit failed
  on typed decoder in the new test; docgen passed. Fixed in c833513460, inbox
  acknowledged by fix SHA; re-run pending.
- Initial direct use-cases check: introduced typed decoder and UTC inference
  errors fixed in c833513460. Existing ClaimGate/triage TS6305 imports lacked
  semantic-web/rdf/file-processing build declarations. Full package-verify
  builds dependency prerequisites; no source workaround added.
- `bun run beep ci lane jsdoc-ratchet`: pass (zero legacy, no increased totals).
- `CI=true bun run beep knowledge refs --check`: inherited red, one live gated
  observation at the RSC SPEC:374:4 path-policy prohibition; present on base.
  Attribution and proposed repair are in research/OPPORTUNITIES.md.
- Re-run package suites, package-verify, coverage, docgen local and Fallow are
  pending in admitted pipelines; append outcomes below.

Hosted required checks are authoritative under AGENTS.md. The older local
`yeet verify` exit row does not block publication. Final-head hosted results
will be recorded after publish; no hosted claim is made here.

## Stop receipt

Latest full domain suite: 9 files, 99 tests pass. Latest domain package-verify:
audit red at test/ContradictionDetection.test.ts:67, docgen pass. The first
repair changed the property round-trip call rather than the diagnostic's
BeliefVersionRef call, so the audit repeated. Read the exact line; corrected it
to decodeResult in `9edd003a48` (also corrected its JSDoc example). Both P0
inbox rows are acknowledged with their repair SHAs; acknowledgements are not
proof of a green re-run.

The brief's repeated-blocker stop applies. The remaining owned use-cases
pipeline was still queued and was stopped after verifying its unit's working
directory matches this lane. No proof unit or monitor remains running. Its
cancel receipt is `.beep/detection-proof/use-cases-pipeline.cancelled`; it is
not a successful package check. No PR, push, readiness monitor or state flip.

After the stop: packet verification and whitespace checks only; no package
re-run on 9edd003a48. Use-cases package-verify, coverage, docgen:local, Fallow,
publication, hosted checks, reflection and completed-retained remain outstanding.
Doctest verify after owner-command marking: domain 9/9 pure fences marked,
use-cases 3/3 pure fences marked, no findings.

Final main integration: origin/main `09e1d81b3f`, merge head `8f4b6ba746`.
Only the evidence-source-policy exploration landed in that merge; detector
source is unchanged from 9edd003a48. Post-merge version sync passes. Packet
verification passes, shipped contract diff remains empty, and Yeet reports
zero unacknowledged P0 rows. No package proof is claimed for the final repair.

## Authorized resume qualification

The run-2 brief ruling lifts the earlier stop for one qualification round on
`a799682c02`, after the actual typed ref repair in `9edd003a48`. Package audits
for both edited packages were submitted through beep-heavy with concurrency 2
and a 32G cap; no third owned heavy job is admitted. A third occurrence of the
same typed-ref diagnostic requires a stop without another repair.

- Packet adoption plan: no conflicts; existing authored files retained and
  manifest extension keys preserved.
- `bun run config-sync:check`: pass before the resume qualification.
- Generated alias diff: exactly one ContradictionDetection entry in each of
  tsconfig.json and vitest.aliases.generated.json, no inherited hunk.
- Shipped values/Contradiction and entities/Contradiction diff: empty.
- `CI=true bun run beep knowledge refs --check`: inherited failure at
  goals/repository-simplification-confidence/SPEC.md:374:4. The resume ruling
  explicitly classifies this path-prohibition false positive as nonblocking.

Local resume logs/results are retained under ignored `.beep/detection-proof/run2/`.
Final qualification outcomes are appended below when those commands terminate.

Fresh domain package-verify on `a799682c02`: pass (audit 7.2s, docgen 3.5s).
The corrected typed-ref diagnostic did not recur. Integrated origin/main
`2eefbb64af` before publication; that release-policy change touches no detector
source or aliases. Remaining qualification runs on the integrated head.


## Run-2 results and stop

Published implementation head: `a7271fb15ebf3c0b2bbf19d483979552b42eab00`.
Main integration: `2eefbb64af` (#1566). Draft PR: #1572; ready-for-heavy applied.
The typed-ref domain diagnostic did not recur; this stop is a new contradiction
between the brief and the release policy, not a third typed-decoder occurrence.

- Domain package-verify: audit 7.2s and docgen 3.5s pass on a799682c02.
  Fresh audit after the test-only assertion repair remains outstanding.
- Whole-package tests: domain 9 files / 99 tests, use-cases 9 files / 69 tests,
  both pass before a7271fb15e's test-law repair.
- `bun run beep quality test-tsgo`: pass, 330 CLI files checked; 148 packages
  covered by their own check scripts. Post-repair package proof remains pending.
- Repaired golden single-file suite: 19/19 pass twice on a7271fb15e, preserving
  full-entity decoding, seal checks, proposal facts, clock and permutation proof.
- Both package coverage commands: pass. Scoped read against
  standards/coverage.regression-baseline.jsonc: existing touched barrels retain
  100%; new executable behavior/model/error/layer/service files are 100% across
  statements, branches, functions and lines. New barrels have no executable
  counters. New files have no prior baseline row; no baseline was edited.
- `bun run beep ci lane jsdoc-ratchet`: pass; current repaired publish also
  reports zero findings. Reflection lint: pass.
- Config-sync baseline and repaired publish check: pass, one alias per file,
  no inherited hunk. Shipped contradiction contract diff remains empty.
- Repaired publish cheap gates: all pass; Knip introduced=0, Effect/Vitest
  introduced=0. Fallow audit, health and dead-code bodies all pass with zero
  findings. The separately requested ci lane fallow wrapper was queued and
  cancelled at the stop; those body results are distinct evidence.
- `docgen:local`: refused because root tsconfig changes require full proof.
  The `--full` retry and use-cases package-verify were still queued when stopped;
  neither is a completed pass. Post-repair domain audit was in the cancelled
  parity pipeline and never started.
- Knowledge refs: inherited failure at the RSC SPEC:374 path-policy example,
  explicitly nonblocking under the run-2 ruling.

Hosted Repo Sanity job 113991105046, run 37980979576:

```text
[changeset-graph] private workspace changesets are forbidden:
- .changeset/epistemic-contradiction-detection.md :: @beep/epistemic-domain
- .changeset/epistemic-contradiction-detection.md :: @beep/epistemic-use-cases
Changeset package graph validation failed: private workspaces must not accumulate release notes.
```

This conflicts directly with the brief's mandatory per-PR private-package patch
note. The required precedent .changeset/epistemic-execution-ledger.md is also
removed by #1566. The note is retained pending reconciliation; neither package
privacy nor release policy is modified to evade the gate.

Hosted Storybook job 113991101860, run 37980979066, exposes an introduced build red:
`ContradictionDetection.layer.ts:135:5 TS2322`: encoded readonly proposals array
is not assignable to the shipped readonly non-empty proposals tuple. Runtime
vectors do not prove this build contract. Preserve the two-proposal invariant in
the encoded type, then rerun use-cases qualification in the resumed lane.

Read both completed job logs immediately through the per-job API. Inbox rows
for the repaired local cheap gate are acked by a7271fb15e; Repo Sanity and
Storybook are acked as tracked wontfix-at-stop, not as green checks. Monitor
adba7343-fdc6-4d09-90e0-a10fb02861e8 returned wave exit 2 and was cancelled.
Both remaining owned heavy units were checked for this lane's working directory
and stopped while queued. All three units read inactive/dead with MainPID 0.
No proof unit, readiness monitor or gate started by this run remains active.

Packet stays active, P0/P1 complete, P2/P3 in-progress, P4 pending. Reflection
passes but is retained as attempted closeout. No completed-retained flip, ready
transition, final gate file, PR merge or lane retirement is claimed.

## Run-3 qualification

Repair head: `d6e6efe2a7`; merged main `2eefbb64af`. Run-3 rulings remove the
private changeset under #1566 and require schema-derived non-empty proposal
encoding. The shipped assessment field codec validates the sorted pair before
encoding; a typed wire regression catches tuple widening and rejects empty
proposals. No cast or shipped schema edit.

- Golden file via `bun run --cwd packages/epistemic/use-cases test
  test/ContradictionDetection.golden.test.ts`: 20/20 pass twice.
- `bun run beep quality test-tsgo`: pass, 330 CLI files; package tests covered
  by their package check scripts.
- `bun run config-sync:check`: pass. Exactly one detection alias per generated
  file; no inherited alias hunk.
- `CI=true bun run beep knowledge refs --check`: pass, zero live gated
  observations. Earlier inherited observation no longer reproduces on main.
- PR #1572 review-thread query: zero threads.
- Two final package proofs submitted through beep-heavy; shared slots queued.

Initial run-3 audits reached package test compilation after successful source
builds. Domain: TS377050 at test lines 56-60. Use-cases: strictEffectProvide
at helper line 37, preferTypedSchemaDecoder at lines 52/55, Result/Exit pipe
diagnostics at 94/200/201/208, heterogeneous fixture union TS2345 at 158.
All are introduced test qualification issues; the old typed-ref diagnostic
did not recur. Repairs: `a0dbc43e2e`, `ba29de5800`, `7f006770b9`. Inbox rows
local-shard-05c6eec1d5c0 and local-shard-2f47ca8850e7 acknowledged with fixes.
Acknowledgement does not imply audit success. Golden 20/20 and domain 5/5
focused files pass after the repair; fresh audits resubmitted.

`bun run beep ci lane jsdoc-ratchet`: pass, zero legacy findings.
`bun run lint:tsgo-rules`: pass. Private changeset-status: pass, both private
workspaces skipped by the release-note obligation.

Fresh domain package-verify on source head `7f006770b9`: pass, audit 6.4s and
docgen 4.1s. The original typed-ref diagnostic and the repaired Result assertion
diagnostics do not recur. Full docgen/parity submitted through the freed heavy
slot; use-cases final audit remains queued.

Use-cases queued from 19:54:47Z beyond 20:14:47Z, so run-3 permits the same
proof in the lane cgroup after stopping its confirmed queued unit. Initial
fallback found only TS2375 at the third fixture's evidenceIds: array inference
loses the shipped non-empty tuple. `Tuple.make(3)` repairs this in `7bb5407631`;
inbox local-shard-55a918851b7a acknowledged with that fix.

Final use-cases package-verify on source head `7bb5407631`: pass, audit 9.2s
and docgen 4.3s. Both package audits include their full suites and test tsgo.
Production source has not changed since `d6e6efe2a7`; domain package source
and test tree are unchanged from its passing `7f006770b9` proof.
Fresh domain/use-cases coverage submitted through beep-heavy; full docgen
continues in the other owned heavy unit.

Full hosted-parity pipeline through beep-heavy: all pass.

- `bun run docgen:local --full`: full JSDoc metadata, package docgen/example
  typechecking and aggregate exit 0. Additive aliases require this full form.
- `bun run beep ci lane fallow --base origin/main`: audit and health pass;
  advisory fix-preview zero findings.
- `bun run beep quality test-tsgo`: heavy-routed repeat passes.

No tracked generated-doc changes and no prohibited reference links. Only
packet evidence remains dirty. Both package sources are qualified; fresh
scoped coverage is still queued.
