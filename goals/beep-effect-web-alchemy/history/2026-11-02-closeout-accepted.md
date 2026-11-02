# Closeout accepted with a residual — 2026-11-02

Operator ruling, relayed by the orchestrator: **"Accept as closed"**. The goal closes on final PR #2583.

## Facts

- #2583 merged as `f21859a6f084f91c82184f866db1452629abe88f` at 2026-11-02T17:09:53Z. The accepted head
  is `663f628c9e2d4f847769f510a31a693c369657c2`.
- `goals completion refresh --slug beep-effect-web-alchemy`:
  - `hosted-required-checks` **verified**: 15 green required contexts at the accepted head, merge-push
    rule suite `pass`, 0 gaps.
  - `yeet-verdict` **unknown**: the head carries a `publish`/`success` verdict with no `mergeReady`.
- Readiness monitors `b8a861fc` and `ea2235a4` stopped after five consecutive poll errors. The
  shared GitHub token's GraphQL calls returned `RATE_LIMIT` ("API rate limit already exceeded"), even
  while `/rate_limit` reported quota left. The third monitor was scheduled for 17:17:30Z, after the
  merge.

## Residual

`yeet-verdict` stays unknown, so the derived completion is not `verified`. The operator accepted that
residual instead of a fourth re-final. The required-check evidence, which #2444 and #2447 failed, is
verified.

## Packet state

On the ruling, `ops/manifest.json` drops `proposedCloseout` and the packet is flipped with
`goals set-status beep-effect-web-alchemy completed-retained`, which writes the manifest status and
lifecycle and the README `Lifecycle:` line. Without a proposal, `readGoalLifecycle` reports the
declared `completed-retained` instead of the unverified receipt. `completionGate` still names #2583 as
the final PR and keeps its evidence refs, so the residual stays inspectable.

## Reversal

Restore `proposedCloseout`, set the status back to `active` with `goals set-status`, then ship a
verdict-backed re-final: a final PR whose `yeet monitor --until-ready` job prints
`merge-ready: yes` before an unbypassed merge, then run
`goals completion refresh --slug beep-effect-web-alchemy --readiness-job <job>`.
