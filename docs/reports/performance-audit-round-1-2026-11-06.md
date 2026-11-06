# Performance audit round 1, 2026-11-06

This is an in-progress outcome ledger for the operator's sequential
Fable 5.1 xhigh, Opus 5.5 xhigh, Sol 6.1 xhigh review loop. See the
[workflow](../runbooks/performance-audit-loop.md) for scope, sources and principles.
No complete clean round has occurred.

## Fable 5.1 xhigh

The first attempt timed out after 15 minutes without a report. A bounded retry
with explicit sibling-checkout access completed in 391 seconds and returned
three candidates. Detailed local receipts are retained privately; the table
records independent decisions rather than adopting reviewer claims as proof.

| ID | Candidate | Independent validation and disposition |
| --- | --- | --- |
| F1a | Share adjacent final-check repository fingerprints | Implemented in #2767 using the existing quality-battery pattern. Real subprocess controls measured three commands with four hashes instead of six; three resumed hits with one instead of three; an intervening live mutation forces fresh identity. All 51 focused tests, package lint/check and docgen pass. Full package audit remains in progress. |
| F1b | Seed proof index from the current Git index | Rejected as proposed. A real Git fixture with a modified tracked file marked assume-unchanged produced different trees: a fresh index captured the edit, while a copied index missed it. Retain fresh-index semantics. |
| F2 | Persist per-environment-key hashes for refusal diagnostics | Not accepted as proposed. The measured tracing-ID miss is fixed and separate-command resume succeeds. Persisting hashes of arbitrary environment values adds sensitive fingerprint data, and a public salt does not prevent low-entropy guessing. No further unexplained miss has been reproduced. Future diagnostic work needs a bounded non-secret design and a demonstrated miss. |
| F3 | Reuse clean-install proof across commits with unchanged manifests | Rejected as proposed. Root prepare executes `scripts/prune-tsgo-backups.mjs`, outside the enumerated manifest/lock/config digest set; lifecycle behavior can change without those inputs changing. Exact-head/tree identity remains required. |

Fable inspected final-check, lane proof reuse, install preflight/receipt and the
existing quality-battery advancement path; it also sampled scheduling config and
the property workflow. It did not inspect all shared workflow setup, AI metrics,
session data, source reflections or historical logs. Those are open ground for
subsequent reviewers, not evidence of no opportunity.

## Additional observed friction

- A CLI CI job reached its one-hour limit in `apt-get update` before testing.
  #2766 now bounds package-manager network and whole-operation waits; eleven
  local shell controls pass. Hosted proof on the latest head is pending.
- Hosted property execution on #2766's initial head passed the same 116 files and
  4,152 tests in 655.95 seconds versus 1,165.11 seconds on #2754. The whole job
  fell from 1,245 to 749 seconds. These are observations on separate runners,
  about 43.7% and 39.8% respectively, not controlled causal estimates.
- The latest local AI weekly scorecard has no tasks, labels or benchmark runs and
  no scored model/tool/cost metrics. This is a data-coverage gap, not a measured
  agent-efficiency improvement. Current CI and direct command receipts remain
  valid sources. See the workflow for the exact reporting window.

- After #2766 became ready, Yeet claimed no monitor was watching even while its
  attached publication monitor wrote fresh matching-head status. The lookup checks
  detached registration only. #2767 now names that limit and directs agents to
  retain an attached monitor, preventing a misleading duplicate-monitor prompt.
  This is a wording correction; no numerical API/token saving is claimed.
- The #2754 integration retry also lost its runner. GitHub reported communication
  loss; AWS confirmed Spot termination. No completed test failure log exists.
  Existing infrastructure already uses capacity-optimized placement across seven
  instance types and five subnets. Do not attribute this to application code or
  quietly introduce a higher-priced capacity fallback.

## Remaining round

Opus is running on the applied and validated Fable refinement; Sol has not started.
Reviewers start sequentially after
accepted changes from the preceding reviewer have been implemented and checked.
The external reviewer-trigger change also remains blocked on controller access;
its existing trigger must remain until a replacement is verified.
