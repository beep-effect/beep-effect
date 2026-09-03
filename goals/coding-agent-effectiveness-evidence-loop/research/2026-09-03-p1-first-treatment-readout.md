# P1 first sharp-treatment readout

Date: 2026-09-03
Baseline revision: `log-only-0`
Treatment revision: `desktop-ntfy-1`
Post-intervention lower bound: `2026-09-03T09:41:33.322Z`
Snapshot: `2026-09-03T17:04:13.599Z`
Decision: retain the sequence breaker and continue sampling; the first
revision-qualified estimate is favorable but still small and mode-confounded.

## Method

The readout replayed the canonical production hook-pulse shards under the same
strict two-hop rule used for the fixed baseline. Within one session and agent,
each `PermissionRequest` claimed the unique nearest preceding unpaired
`PreToolUse` with the same `toolName`. Only a terminal event carrying that
attempt's exact `toolUseId` could close the bracket. `SessionEnd` tombstoned
open brackets, and `Stop` did not.

True wait remained
`terminal.ts - PermissionRequest.ts - terminal.durationMs`. Results use the
fixed report's nearest-rank percentile convention. The replay was implemented
twice, once as a bounded Bun analysis and once by independently adapting the
notifier's jq-sort-gawk state machine. Both returned the same nine
post-boundary `AskUserQuestion` outcomes and the same eight measured waits.

The report retains only counts, enums, timestamps, and durations. It emits no
session, clone, transcript, or path digest and no cleartext path-to-digest pair.

## Snapshot health

The post-boundary ledger held 17,735 rows: 3,298 `desktop-ntfy-1` and 14,437
`log-only-0`. All rows were `hook-pulse/v1`, production, derived evidence;
3,550 came from Claude Code and 14,185 from Codex. The canonical content-key
denylist and private-reference shape checks both found zero violations.
Byte-identical duplicate rows were zero in the replay input.

The nine post-boundary permission starts were all `AskUserQuestion`: eight
sharp and one comparison. The strict matcher attributed all nine without a
guess or ambiguity. Eight closed on exact-ID `PostToolUse`; one sharp bracket
was tombstoned honestly at `SessionEnd`. No matched bracket remained open, and
every closed terminal carried `durationMs`.

## Treatment results

The eight sharp starts produced seven closed waits and one tombstone, for an
87.5% observed closure rate. Closed waits in milliseconds, sorted, were:

```text
4,435  5,003  5,251  7,439  7,599  9,025  27,430
```

Nearest-rank p50 was 7.439 s; p90, p95, and max were all 27.430 s because only
seven closed treatment observations exist. Against the fixed baseline's 80
closed waits and 37.464 s p50, the first descriptive median estimate is
-30.025 s, or an 80.1% reduction.

Permission mode is a material imbalance, so the aggregate delta is not treated
as an unqualified causal estimate:

- `auto`: the fixed baseline had four closures and p50 37.464 s. Treatment had
  seven starts, six closures, one tombstone, and p50 5.251 s. The descriptive
  median is 32.213 s / 86.0% lower, with small denominators.
- `bypassPermissions`: the fixed baseline had 77 starts, 76 closures, one
  tombstone, and p50 31.738 s. Treatment has one start and closure at 27.430 s,
  so no stratum effect is inferred.

The sole post-boundary comparison request closed at 2.319 s. One comparison
observation is reported for completeness and is not used as a concurrent
control estimate.

## Delivery and damping receipts

The notification ledger contained 18 valid `sequence-break-notification/v1`
rows across two shards and all eight sharp request timestamps. It recorded:

- two initial desktop sends accepted by the Plasma bus;
- six initial desktop plus six initial ntfy decisions skipped by the
  15-minute per-session/target storm damper;
- two initial ntfy decisions skipped as `transport-unconfigured`; and
- one desktop plus one ntfy reminder skipped because exact-bracket replay found
  the originating request resolved.

All notification rows were derived `desktop-ntfy-1` evidence. Schema/shape and
content-key scans found zero invalid rows. The instrument remained armed. The
ntfy base URL, topic, and token were absent from the runtime environment, so
these are desktop-delivery receipts, not phone-delivery receipts.

## Decision

The sharp human-input denominator is no longer zero, and the first measured
effect is directionally large enough to retain the treatment while sampling
continues. This readout does not claim a stable interrupted-series effect:
seven closures cannot characterize a long tail, the `auto` stratum dominates
treatment but not baseline, and one sharp tombstone must remain visible.

The fleet gate is separately dispositioned as 19 adopters plus three explicit
protected/archive exclusions. P1 therefore remains current until one real ntfy
phone-delivery receipt exists. P2 remains gated until that condition is met.
