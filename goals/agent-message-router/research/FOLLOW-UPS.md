# Tracked review follow-ups

## R1 — Reject conflicting host/provider metadata at enrollment

- Priority: P2; status: open; owner: the next router maintenance lane.
- Source: the final independent store refactor review on 2026-10-09, after two
  completed review rounds. This behavior predates the complexity refactor.
- Evidence: a cache-only real SQLite reproduction accepted a binding whose
  `host.provider` differed from `policy.provider`, accepted a message and spent
  one persisted grant use, then returned `policyMismatch` at `claimNext`.
  The dispatcher rejected the mismatch before inference. The final combined
  router suite passed 44 tests; this additional reproduction remains separate.
- Impact: incorrect trusted-host enrollment can leave accepted mail unable to
  dispatch and consume its send budget. This is not a peer authority expansion or
  an inference permission bypass. Managed enrollment constructs coherent metadata.
- Required change: reject inconsistent optional host/provider metadata when
  registering an endpoint, and keep the existing dispatcher check as defense in
  depth. Review whether destination validation should reject retained inconsistent
  registrations before acceptance without changing idempotency or grant semantics.
- Regression acceptance: conflicting registration fails with typed
  `policyMismatch`; no endpoint, message or quota debit is committed. Coherent and
  absent host metadata still enroll. A retained conflicting fixture is fenced
  before inference and its original receipts remain available for reconciliation.
- Current disposition: deferred under `AGENTS.md`'s review-round cap for
  P2-and-below findings after round two. No code or gate was weakened. The final
  store review reports one tracked P2, not zero findings.
- Reversal for a later fix: revert the stricter enrollment rejection while
  retaining the existing pre-inference dispatcher fence and all mailbox receipts.

## Hosted review follow-ups for PR #1571

After the second review round, the repository policy requires P2 findings to be
tracked and answered instead of starting another implementation wave. These
issues preserve the evidence and acceptance criteria:

| Issue | Boundary and follow-up |
| --- | --- |
| [#1576](https://github.com/beep-effect/beep-effect/issues/1576) | Normal terminal completion after a mid-turn ACK can release its hold without appending the terminal receipt; retain that outcome and diagnostic in history. |
| [#1578](https://github.com/beep-effect/beep-effect/issues/1578) | Trusted launch-profile environment denylist misses provider-specific keys; add per-provider allowlists and rejection-before-spawn proof. No peer profile-mutation route was demonstrated. |
| [#1579](https://github.com/beep-effect/beep-effect/issues/1579) | Extend the explicitly bounded slice with original-runtime evidence-backed ambiguity reconciliation and per-endpoint capacity fairness; preserve safe holds until that contract is qualified. |
| [#1581](https://github.com/beep-effect/beep-effect/issues/1581) | Retain decoded batches in the historical Claude probe, strengthen historical Grok ACK payload correlation, and date copied research-state text. Original receipts keep their original scope and source hashes. |
| [#1582](https://github.com/beep-effect/beep-effect/issues/1582) | Give proposed same-PR closeout and operative completion separate machine-readable states; current feature-branch declarations do not establish hosted readiness or merge. |

The transient SQLite completion-write teardown was independently reproduced as
P1 and is repaired in this PR; it is not deferred by the review-round limit.
