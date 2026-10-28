# Extraction closeout friction

## 2026-10-28: historical readiness cannot be inferred from remediation

Running `bun run beep goals completion refresh --slug epistemics-foundation-extraction
--readiness-job 6a578a15-389a-410c-8296-cbb0d25a67ac` returned `unsatisfied`.
The clone-local completion receipt identifies required `Heavy / Docgen` failure
on #2017's accepted head `62fdeb3680c711f6218655ae8ef8d35f6b0ae71d`, and the
merge-push rule suite `4656800042` records required status checks as `fail`.
The declared verdict file is absent. Repair PRs #2019 and #2021 establish later
remediation, not readiness before the original merge.

Prevention: retain a successful, accepted-head Yeet readiness verdict before
retiring the lane, and wait for every required context before the merge.
Recovery requires a new qualifying closeout PR; no historical receipt is invented.

## 2026-10-28: generic struct checks need resolvable field types

The first logical-key check read fields directly from the generic claim struct.
`tsrs -p tsconfig.check.json` reported `TS2339` on `logicalKey` and `proposition`:
optional/mutable views of generic schema fields remained conditional types.
The existing `FieldSchema` contract resolves a schema-derived guard over the
proposition's decoded type. The final check keeps the exact original codec and
uses that guard to narrow the generic input without a type assertion.

## 2026-10-28: broad repair introduces unrelated style edits

`yeet repair` rewrote four inherited helper references in lockfiles and repo-cli,
then queued a full proof behind another lane. Its safe-rewrite output also
reformatted imports. The recovery lane was clean outside the goal before repair.
Stopped the owned queued run, saved its four-file patch outside the repository,
and restored only those generated edits. The extraction PR remains scoped.
Package verifications already passed; publication uses its normal cheap gates
and hosted checks. A separate style-fix lane can consume the saved patch.

## 2026-10-28: publication preflight exceeded the local gate limit

The publication cheap-gates wave started at approximately 08:49 UTC. Its
regenerated JSDoc ratchet remained outstanding after 09:00 UTC; all other
reported preflights passed. Cancelled the owned publication process and verified
it exited 130 before pushing through the repo's constrained-compute fallback.
The package audits and targeted root lint passed. Hosted CI remains authoritative;
this partial local wave is not a green receipt.

## 2026-10-28: query the organization-scoped runner pool

The repository-level runner listing returned zero because this fleet registers
at organization scope (`enable_organization_runners: true`). The organization
listing showed six online busy workers and one offline registration; a later
read showed seven online busy workers. This is a capacity queue, not evidence
of an absent fleet. No pool settings or infrastructure were changed.

The repository-only listing led to an unnecessary AWS sign-in request. Correct
the scope before diagnosing availability. The existing aws-vault route then
authenticated through masked Plasma delivery; no MFA value reached tool output,
arguments or files. AWS access is not required to keep the goal monitors running.


## 2026-10-28: hosted lint-policy closes gaps in local checks

The completed Heavy / Lint Policy job reported `SFV4-arbitrary-tests` in the
expanded claim codec test file and `phases-terminal-but-active` in this packet.
Both were introduced here. Added real schema-derived property coverage and kept
P4 in progress while the proposed closeout awaits verified merge evidence.
Run the exact schema-first and goal-doctor gates locally after these fixes;
package audit alone did not cover these repository-wide checks.

The next hosted policy replay caught one introduced `EV007` finding: the new
property test called `Arbitrary.checkEffect` directly. Converted it to the
existing `it.effect.prop` registration with `Arbitrary.schema(Knows)`, retaining
the generated round-trip assertion. Run both effect-vitest and schema-first
checks together; satisfying one test policy does not establish the other.

## 2026-10-28: interrupted monitor left merged readiness unrecorded

The final implementation head passed every required hosted check and merged in
#2315, but the local monitor stopped before readiness was recorded. A fresh
completion refresh verified the hosted checks and merge-time inventory while
reporting the declared verdict absent. Post-merge `yeet monitor --summary`
refuses because the PR is merged. Establish a documentation-only final closeout
PR and retain its real verdict before merging. Keeping the monitor alive or
retaining the verdict in the merge path would have prevented this extra round.

Review caught a truncated check census: GitHub's default first page contained
30 runs, while `check-runs?per_page=100` reports all 34. The complete census has
33 successful and one neutral run, all completed before the merge. Use explicit
pagination for counts as well as failure searches.

## 2026-10-28: coordinate the readiness-to-merge boundary

Another process merged #2325 with its coverage follow-up still running. The
follow-up passed afterward, but the normal monitor then correctly wrote a
negative post-merge verdict. Retained those bytes unchanged and confirmed the
completion verifier still returns `unknown`. The operator has held other merges
of this goal so the owner can retain a positive verdict before merging the final
closeout. Explicit merge ownership prevents repeated documentation-only proof
rounds without changing any acceptance gate.
