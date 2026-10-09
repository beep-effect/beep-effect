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
