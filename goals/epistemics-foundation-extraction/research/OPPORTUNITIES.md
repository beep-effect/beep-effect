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
