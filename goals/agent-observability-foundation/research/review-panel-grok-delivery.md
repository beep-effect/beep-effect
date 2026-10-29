I'll adjudicate the earlier review against the current source, receipts, and the Dankserver snapshot. Read-only: no writes, tests, or delegation. Starting with the prior Grok report, the SPEC, and the delivery checkpoint.The earlier Grok seat refused acceptance on replay, health, claim recovery, duration, and surface labels. I'll check those against the current source and the Dankserver snapshot, treating the Astra report as locators only.The checkpoint says the repair wave is dirty on top of `1ed9704cc6`, and installed receipts predate it. I'll read the replay, health, claim, duration, label, and epoch paths in source, plus the Dankserver copy.**Not accepted as a completed goal.** The repaired source matches the later specification for the six earlier defects. I found no new concrete defect in those paths or in the codec defaults and per-test layers I inspected. The whole-CLI abort, repository publication, hosted gates, and a fresh installed proof of this dirty repair wave remain open.

This session had no earlier review. The first CLI launch failed before a session existed because `--add-dir` is unsupported. The written report below is from the prior seat, session `01a18602-2f06-7541-a45c-8d4b31850102`.

## Evidence boundary

The Dankserver tree at `.beep/review-inputs/dankserver` is the read-only copy of clean `d319f846d6a81d0f5edef66b6b0fc0555307acac`. `snapshot-manifest.json` lists that head and 28 file hashes. I read those files. I did not recompute the hashes.

Beep conclusions are from the current on-disk tree, which the delivery checkpoint describes as `1ed9704cc6` plus the dirty repair wave. I did not separate dirty from `HEAD`. Shell, tests, graft, services, and receipt rehashing were not used. Astra locators were checked against source. Pre-repair installed receipts are not proof of this wave.

## Adjudication of the earlier findings

| Earlier finding | Result | What the current source does |
| --- | --- | --- |
| No replay after an ambiguous or reserved attempt | **Fixed** | Replay is opt-in and target-bound. Default is none. |
| Lag and stopped-versus-idle were process-local | **Fixed for the declared probe** | A deadline still carries no age sample. That omission is now an explicit degraded phase, not a healthy idle. |
| Claim store had no backup, so loss could relaunch | **Fixed as refusal** | Missing, torn, or substituted stores refuse. No replacement fence is created. Physical claim backup is still a pre-production hold, not a silent relaunch. |
| Unknown duration encoded as a zero-width span | **Fixed against the 2026-10-29 decision** | A point stays a point. `ai_metrics.duration_known=false` is required. Split rounding is a mismatch. |
| CLI and desktop marks died at the hash | **Fixed in source** | Enabled routes keep `cli` and `desktop`. The collector and read-back require the matching fixture attributes. |
| A second visibility proof was dropped | **Not a remaining defect** | First visibility stays. Epoch seal deletes that row with the other delivery detail. |
| Collector migration and epoch mismatch | **Fixed in the reviewed source** | Metadata mode defaults off. Mismatch does not replay. The v5 receipt was not re-proven on this dirty tree. |

### Qualified replay

`IdempotentReplayPolicy` defaults to none at `packages/tooling/library/ai-metrics/src/native-schedule.ts:118-120`. A policy whose `targetId` differs from the ledger fails before a schedule row is written (`:236-237`). The test at `test/native-schedule.test.ts:186-192` locks that refusal.

For `accepted-unverified` or `unresolved`, the scheduler reads the backend first (`native-schedule.ts:382-420`). A result other than `Missing`, a missing policy, or an elapsed time under `minimumDelayMillis` returns `Reconciled` and does not send. `Mismatch` is in that group. The test at `test/native-schedule.test.ts:218-234` keeps the post count at 1. A latest `Rejected` outcome then holds `permanent-refusal` (`native-schedule.ts:421-424`). Only a fresh `Missing`, after the delay and inside the attempt cap, mints a new epoch-scoped attempt id (`:432-436`). `reserveSend` still returns false for an existing attempt id (`delivery-ledger.ts:355-366`).

An interrupted reserve stays `unresolved` and can be retried only under that policy (`test/native-schedule.test.ts:260-277`). Without the policy, a later missing read-back does not send (`:409-428`). The qualification digest is stored and not checked against a receipt. `SPEC.md:443-455` says the digest is owner provenance, not certification.

Changed-epoch behavior in source: event id stays `native-span/v1:route:trace:span` (`native-trace.ts:394`). Seal deletes visibility and the other delivery tables before the next epoch (`evidence-retention.ts:334-345`). The fixture at `goals/agent-observability-foundation/ops/epoch-backend-fixture.ts:187-215` requires one `Reconciled(Mismatch)` and an unchanged attempt count. I did not execute it. `ops/epoch-backend-verification.json` predates this dirty wave.

### Independent health

A scheduling timeout still discards the in-memory ages and returns `Deadline` with no lag (`native-schedule.ts:175`, `:468-472`). The runtime records that as a deadline cycle (`observation-runtime.ts:240-241`, `:252`). Phase becomes `degraded`, not `idle` (`:292-293`). Tests expect that empty deadline (`test/native-schedule.test.ts:478`, `test/observation-runtime.test.ts:129-131`). Completed passes still publish sampled ages, including unknown source time as omitted rather than zero (`native-schedule.ts:58-72`, `observation-runtime.ts:417-448`).

The independent probe is opt-in. `monitoring_observation_health_enabled` is false (`.beep/review-inputs/dankserver/ansible/group_vars/all.yml:909`). When enabled, a root timer scrapes the private socket into the node exporter textfile directory. A dead worker publishes `observer_worker_up=0` and still reports journal filesystem bytes (`observation-health-snapshot.py:100-127`). Alerts on `job="node"` cover a stale probe, worker down, phase `stopped|degraded|stale|clock-regression`, and a sampled acceptance age over five minutes (`prometheus-alerts.yml.j2:203-263`). Idle is not in that phase regex. `source_coverage_known` remains 0 (`observation-runtime.ts:378`). The age alert is a recent sample, not fleet-oldest lag. Prometheus still scrapes `otel-collector:8888` separately (`prometheus.yml.j2:23-25`). This copy does not show the probe installed on a host.

### Claim authority

`initializeObservationClaims` refuses an existing or partial directory (`observation-launch-claims.ts:276-279`). `makeObservationClaims` fails closed on a missing, torn, exposed, or replaced store (`test/observation-launch-claims.test.ts:96-150`). `openAgentMessageSession` does not create a store when enrollment is present (`AgentMessage.observation.ts:522-523`, `:564`). `recoverAgentObservation` only status-checks or reconciles an existing `Prepared` claim and has no process launch (`:469-512`). Journal backup is still `VACUUM INTO` of the journal file only (`observation-backup.ts:243-244`). `SPEC.md:407-414` still requires an operational backup owner before production enrollment. That hold is explicit. It is not a path that mints a new fence.

### Point spans and fixture labels

Unknown native duration uses one point for both endpoints and sets `ai_metrics.duration_known` false (`native-export.ts:156-171`, `:189`). Reconstructed spans do the same (`transcript-export.ts:129-141`). Read-back requires stored endpoints to stay equal when the encoded span is a point (`native-readback.ts:223-227`). The test rejects a point split and accepts one shared rounding (`test/native-readback.test.ts:328-337`). `SPEC.md:522-548` accepts that point representation and forbids quantization from creating a duration.

Fixture labels default off (`native-trace.ts:84-86`). An enabled route keeps only `cli` or `desktop` and rejects any other label (`test/native-trace.test.ts:273-297`). Export names become `fixture.<surface>.<kind>` with the synthetic marker and `declared_synthetic_fixture` (`native-export.ts:166-180`). The metadata collector filter requires that triple and rejects fixture attributes on ordinary names (`otel-config.yaml.j2:49-51`). Read-back requests those keys even when the encoded span lacks them (`native-readback.ts:87-92`). `monitoring_otel_metadata_route_enabled` defaults false (`all.yml:937`). Legacy port 4318 stays the non-persistent pipeline. The migration test compares queue hashes after legacy, then metadata, then legacy, and expects HTTP 404 on the old port during metadata mode (`test_otel_migration.py:73-117`). That test runs only when `FOUNDATION_OTEL_INTEGRATION=1`. I did not run it.

### Codec hoists, defaults, and layers

I did not find a concrete behavior change in the hoisted defaults on these paths. Replay, fixture metadata, and fixture surface still default to none. Schedule and read-back tests each build `Layer.fresh(sqlLayer)`. I did not review all 306 hoists as a diff, and I did not re-run the package audit named in the checkpoint.

## Actionable holds

1. Do not mark `agent-observability-foundation` complete. Every acceptance checkbox in `SPEC.md:33-45` is still open. The checkpoint says the whole-CLI Bun abort is unclosed and publication, hosted CI, final-check, and reflection have not passed.
2. Do not treat `ops/retirement-live-verification.json`, `ops/epoch-backend-verification.json`, or the other installed receipts as proof of this dirty wave. A fresh installed proof is still pending.
3. Before any production enrollment, keep the historical forwarder masked, leave metadata mode and the health probe opt-in, and keep the claim-store backup hold. This review did not check live mask state.

## Unverified

- Dirty tree versus `1ed9704cc6`, and versus every receipt hash.
- SHA-256 of the Dankserver snapshot files.
- Test execution, including the pinned-image migration test.
- Live Phoenix, the forwarder mask, queue-size semantics on the collector image, and integer-attribute precision through `Number(intValue)` at `native-readback.ts:204`.
- Whether the other 306 hoists changed a schema outside the paths above.