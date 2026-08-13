# ci-fleet-residue — friction and opportunity ledger

Record receipts at the moment friction happens; redact for the public repo.

## Seed context (2026-08-13, from the split)

- Spot evidence: 3 same-second reclaims killed 6 jobs on cutover evening
  (2026-08-11 19:49:32Z sweep); on-demand since. A calm-week baseline is the
  revert precondition.
- IMDS attribution is CONFOUNDED: the original DROP rollback blamed the
  firewall, but the toolbelt post-install reproduced the identical
  runner-start failure with no firewall (inline set -u leak). Retest
  subshell-scoped.
- Closeout writer bug field evidence: PR #668 and #673 closeouts both
  emitted reviewedHeadSha as a raw Option object.
