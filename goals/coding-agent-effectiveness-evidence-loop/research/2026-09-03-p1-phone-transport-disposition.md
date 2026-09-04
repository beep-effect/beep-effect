# P1 phone transport disposition

Date: 2026-09-03
Decision: complete P1; defer ntfy phone delivery with an explicit trigger.

## Evidence

The normative `SPEC.md` requires a measured, guardrailed reduction in a
targeted wait. It does not require a phone transport. The 2026-07-31 amendment
that introduced the sequence-break canary described ntfy push as optional and
remote action buttons as a stretch. The later P1 plan promoted a real phone
receipt into an exit gate without recording an operator decision or a
provisioned transport.

PR #973 implemented a fail-open ntfy adapter alongside Plasma desktop
delivery. The first treatment readout found valid desktop receipts and recorded
the ntfy attempts as `transport-unconfigured`. The runtime had no configured
base URL, topic, or token, and made no phone-delivery claim.

A tracked-source audit found no ntfy provisioning path or 1Password reference
in this repository. A separate audit of the managed server repository also
found no tracked ntfy service or reference. That server has independently
scoped Telegram, Discord, and Twilio integrations, but none is authority to
reuse its credentials or couple this workstation hook to OpenClaw.

The operator confirmed that ntfy was not an existing service or known
operational dependency. The agent therefore made no new 1Password item, vault
grant, phone subscription, server change, or credential read for this
disposition.

## Disposition

- Plasma desktop delivery is shipped and remains the supported P1 notification
  transport.
- The ntfy adapter remains fail-open. Missing configuration produces the
  content-free `transport-unconfigured` receipt already covered by tests.
- Phone delivery is deferred. Reconsider it only after an explicit operator
  request names the desired service and a least-privilege runtime design,
  subscriber setup, and end-to-end delivery receipt are all in scope.
- Reusing existing OpenClaw Telegram, Discord, or Twilio credentials is
  rejected without a separate authorization and boundary design.
- `desktop-ntfy-1` remains the historical notifier revision label. Renaming it
  would break evidence continuity and does not change the transport's
  configured state.

## Phase result

P1's required instrument, baseline, guarded rollout, damping, circuit breaker,
kill switch, desktop receipt, and first sharp readout are complete. The fleet
denominator remains 19 adopters plus three explicit protected/archive
exclusions. Eight sharp human-input starts produced seven exact-ID closures,
one honest tombstone, and a revision-qualified 80.1% descriptive median
reduction. P2 is now the current phase.
