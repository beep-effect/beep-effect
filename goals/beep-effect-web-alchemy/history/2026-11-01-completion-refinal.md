# Completion re-final — 2026-11-01

`bun run beep goals completion refresh --slug beep-effect-web-alchemy` reported #2444 as
**unsatisfied**, so this packet proposes a new final PR.

## Why #2444 could not satisfy the gate

- #2444 merged as `3b018ad712` at 00:15:41Z through a ruleset bypass (merge-push rule suite
  4837149552: `requiredStatusChecks` failed). At that moment Test Unit (repo-cli-3), (unit-a)
  and (unit-b) were still running on the accepted head `234cba0bdc`. The merge cancelled them,
  so the required `Test Unit` context reads failure at that head.
- Readiness monitor `ddda94f9` never reached merge-ready (`required-pending` on those three
  shards). That leaves no Yeet verdict for `--readiness-job` to recover.
- Receipt evidence: `hosted-required-checks` unsatisfied (merge-time bypass), and
  `yeet-verdict` unsatisfied.
- Cause: the orchestrator gated #2444 with the relaxed S11 gate, which may merge over pending
  or red checks. Re-running the cancelled jobs cannot fix it, because the merge-push rule suite
  records the bypass permanently.

## Remedy

This closeout PR carries this note, a README evidence line pointing at it, and the manifest
change pointing `proposedCloseout` and the final `pullRequests` entry at it, with #2435 and #2444
as supporting PRs. The orchestrator
merges it through the strict gate (every required check green), so the merge-push rule suite
passes and the refresh can verify.

## Second re-final (2026-11-02)

#2447 also merged as `63a13a6e7b` with required checks still pending. It was a manual
operator merge at 01:53:24Z, while Heavy / Check, Docgen, Doctest, Test Integration and two
Test Unit shards were still running on `ff83202b94`. The refresh reported
`hosted-required-checks` unsatisfied and `yeet-verdict` unknown. The PR had been opened with a
plain push, so no publish verdict existed, and the readiness monitor writes only `status.json`.

The next final PR follows the verdict route:

1. Run `yeet verify` on the final head.
2. Run `yeet publish --push-only --reuse-verified`, which writes a success publish verdict at
   that head.
3. Run `yeet monitor --until-ready` until it prints `merge-ready: yes`.
4. Merge without bypass, only after every required check is green.
5. Run `goals completion refresh --readiness-job <job>` from the clone that ran the monitor.

## Third re-final (2026-11-02)

#2523 merged as `1947c1209d` at head `64f1d05803` with no bypass. All 15 required contexts were
green and the merge-push rule suite passed, so the refresh verified `hosted-required-checks`. It
was merged by hand before any `yeet monitor --until-ready` job reported merge-ready, though. The
publish verdict for `64f1d05803` (`publish`/`success`) carries no `mergeReady`, so `yeet-verdict`
stays unknown.

The operator ruled for a third re-final rather than accepting post-merge proof. The final PR is
merged only by the orchestrator's strict gate, after its until-ready job prints
`merge-ready: yes`.

A later failed `yeet publish` on an unpushed head overwrites
`.beep/yeet/runs/<run-id>/verdict.json`. The genuine verdict survives in that run's
`attempts.ndjson` (the `attempt-finished` row's `verdict`).
