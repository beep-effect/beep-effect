# Spike 4 — upgrade + failed-health rollback across SQLite stamps

Gated decision: *OpenClawGeneration state machine*
(`ops/handoffs/p0-gauntlet-contract.md` Spike 4).

Verdict: **PASS** — all three contract assertions demonstrated 2026-07-25 in
the v3 rerun. The gated decision stands; no SPEC Decision Log revision needed.

The v3 classification sequence records 20 `ASSERT-PASS` results and terminates
with `SPIKE4-V3-PASS`
([`logs/v3-classification-sequence.log:1-38`](./logs/v3-classification-sequence.log)).

## Pinned inputs

| Input | Value |
| --- | --- |
| Date | 2026-07-25 |
| Node | `v24.16.0` ([`logs/v3-pins.log:1-2`](./logs/v3-pins.log)) |
| Additive-control OpenClaw | `openclaw@2026.6.33`; git SHA `7af0cfc`; npm `dist.shasum` `b10e18afacd59228c4238dced6419da0e901211c`; npm `dist.integrity` `sha512-53MCYfnMEzQmrh/mFNpqfUcQunZASPZ2qYOmqn6wq3K4gZPzV0QOMwjxOCU2C+VmQ5FqzVU8exy7j7pyL3EBzQ==`; installed `package.json` SHA-256 `3f959e5b4463e603dbe238b4ee47b33ee2c58b71030a17bdeb69e480086f0774` ([`logs/v3-pins.log:4-9`](./logs/v3-pins.log)) |
| Generation A OpenClaw | `openclaw@2026.7.1-2`; git SHA `0790d9f`; npm `dist.shasum` `4583b987ea7277230ce1c7b2b8535d3e219f57ac`; npm `dist.integrity` `sha512-ycF3yPcbjN6bUPeaUx6Mh6vze1hQWoD3CT/wWcmD7a8xaHHHRUaAlaq+lFxMHf1ssEgODVAwjlzYqp2twkYZ7g==`; installed `package.json` SHA-256 `695b6ee36df7fc69606dc390cf97bb2ca809114337b18c573707637cd2a4e3db` ([`logs/v3-pins.log:11-16`](./logs/v3-pins.log)) |
| Generation B OpenClaw | `openclaw@2026.7.2-beta.4`; git SHA `5e63b36`; npm `dist.shasum` `95ed4f87ce8e8500e0474e07d0fa1e79616a2055`; npm `dist.integrity` `sha512-Wqk1avvuJAnJWESA+EJdCObj9i4sWYf5hGczKAs00gRcHFJ/XUlXUbHPIJ7WPKexKMN31ybP0fcVVsROFMzOgA==`; installed `package.json` SHA-256 `8b4a9dbb94b329515c5e0974be84c8e00df06ce1959c02dfaac6b8a5bdb790bb` ([`logs/v3-pins.log:18-23`](./logs/v3-pins.log)) |
| Rendered config SHA-256 | gen-A `867e9f6e98e0e98df7f5bcae837cf365f48918acb2b1f1a0743e428e0ab22941` (prefix `867e9f6e98e0e98d`); gen-B `4c25070fdc4b4ce9b57fc4ee9a97a85045702cb5a870ec55c0a842ac04af8fe3` (prefix `4c25070fdc4b4ce9`) ([`logs/v3-pins.log:34-36`](./logs/v3-pins.log), [`logs/v3-v2-setup.log:12-14`](./logs/v3-v2-setup.log)) |
| Spike-root content SHA-256 | `6fbd6c0baebb9e30c445fc1dacbc746c5a83332d82846ff32fa1d42ceba42e66`, computed over sorted root-relative regular-file names and their SHA-256 values; symlinks excluded ([`logs/v3-pins.log:25-37`](./logs/v3-pins.log)) |
| Main ports | gen-A / forced-acceptance port `19011`; gen-B `19012` ([`logs/v3-v2-setup.log:13-14`](./logs/v3-v2-setup.log), [`logs/v3-classification-sequence.log:1-18`](./logs/v3-classification-sequence.log)) |
| Control ports | additive classification `19013`; future-version guard `19014` ([`harness/v3-classification-sequence.sh:89-105`](./harness/v3-classification-sequence.sh)) |
| Shared DB `user_version` | `1 -> 5` on B migration; restored to `1` for A ([`logs/v3-classification-sequence.log:3-14`](./logs/v3-classification-sequence.log), [`logs/v3-classification-sequence.log:27-30`](./logs/v3-classification-sequence.log)) |
| Per-agent DB `user_version` | `1 -> 14` on B migration; restored to `1` for A ([`logs/v3-classification-sequence.log:4-15`](./logs/v3-classification-sequence.log), [`logs/v3-classification-sequence.log:27-30`](./logs/v3-classification-sequence.log)) |
| Additive-control DB stamp | `1` after `2026.6.33 -> 2026.7.1-2` ([`logs/v3-classification-sequence.log:32-34`](./logs/v3-classification-sequence.log)) |

The gateway-token file was outside the hashed generation root and was neither
hashed nor archived
([`logs/v3-pins.log:25-33`](./logs/v3-pins.log)).

Harness (disposable spike code, archived under [`harness/`](./harness/)):
`v3-capture-pins.sh` (exact runtime/package/config/root pins),
`v3-seed-s633.sh` (reproducible `2026.6.33` state fixture),
`v3-classification-sequence.sh` (contract sequence, classification controls,
and forward recovery), and `v3-postflight.sh` (teardown and isolation proof).
Rendered public-safe configs are archived under [`configs/`](./configs/).

## Assertions

| # | Contract assertion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Stage B side-by-side; validate with B; stop; snapshot all DBs plus WAL; switch and start B; observe migration stamps; force acceptance failure; restore snapshot and switch back; start A cleanly | PASS | Baseline, candidate validation, two WAL sidecars, and both DBs in the snapshot: [`logs/v3-classification-sequence.log:1-10`](./logs/v3-classification-sequence.log). B health, shared `1 -> 5`, per-agent `1 -> 14`, and forced failed acceptance: [`logs/v3-classification-sequence.log:11-18`](./logs/v3-classification-sequence.log). Snapshot restore, A health, both stamps restored to `1`, and legacy sessions restored: [`logs/v3-classification-sequence.log:27-31`](./logs/v3-classification-sequence.log). |
| 2 | Without snapshot restore, A refuses B-migrated state | PASS | The no-restore leg reports the exact `5` versus `1` schema refusal: [`logs/v3-classification-sequence.log:19-21`](./logs/v3-classification-sequence.log). The raw journal records the causal refusal and service exit status 1: [`logs/v3-refusal-journal.log:51-60`](./logs/v3-refusal-journal.log). |
| 3 | Classify encountered migrations and document the irreversible-class operator gate and forward-recovery plan | PASS | Rollback-benign control: [`logs/v3-classification-sequence.log:32-34`](./logs/v3-classification-sequence.log). Snapshot-required class and forward-recovery compatibility premise: [`logs/v3-classification-sequence.log:14-30`](./logs/v3-classification-sequence.log). Archived classification, operator gate, and recovery plan: [`v3-classification.md:1-50`](./v3-classification.md). |

### A1 — staged upgrade, forced failure, snapshot rollback

The stopped-state snapshot contained the shared and per-agent databases and two
WAL sidecars. After switching to B, the service became healthy on `19012`,
the shared stamp moved `1 -> 5`, the per-agent stamp moved `1 -> 14`, and the
legacy `sessions.json` was consumed by the SQLite transition
([`logs/v3-classification-sequence.log:8-16`](./logs/v3-classification-sequence.log)).

The acceptance probe was deliberately aimed at gen-A's expected port `19011`
while B was active, producing the required forced failure. After the
no-restore and forward-recovery legs, the harness restored the snapshot,
switched back to A, and proved A healthy with both stamps and the legacy
session file restored
([`logs/v3-classification-sequence.log:17-31`](./logs/v3-classification-sequence.log)).

### A2 — negative: A against still-migrated state

Before any restore, the harness switched the active pointer from B to A. A
refused to start because the shared database used schema version `5` while
that build supported `1`; systemd recorded exit status 1 and a failed unit
([`logs/v3-refusal-journal.log:51-60`](./logs/v3-refusal-journal.log)).

This proves the downgrade trap is causal, not merely a failed health probe:
selecting the old binary against the in-place migrated state is unsafe.

### A3 — migration classification and recovery policy

#### `2026.6.33 -> 2026.7.1-2`: rollback-benign / reversible

For the exercised shared database, this class is rollback-benign and
reversible in place. `2026.7.1-2` leaves `PRAGMA user_version=1`, and
`2026.6.33` then starts cleanly against the touched state without snapshot
restore
([`logs/v3-classification-sequence.log:32-34`](./logs/v3-classification-sequence.log)).
The control startup log is pinned beneath the spike root and reaches ready
([`logs/v3-ctrl-633-back.log:1-11`](./logs/v3-ctrl-633-back.log)).

This classification is limited to the database and transition exercised by
the harness; it is not a claim that every migration between those releases is
universally reversible.

#### `2026.7.1-2 -> 2026.7.2-beta.4`: snapshot-required

This class is in-place downgrade-incompatible and therefore irreversible for
in-place rollback: B stamps the shared database `1 -> 5` and the per-agent
database `1 -> 14`; A refuses the still-migrated state. Rollback to A succeeds
only after restoring the stopped-state snapshot
([`logs/v3-classification-sequence.log:11-30`](./logs/v3-classification-sequence.log)).

The encountered B shared-state work included the versioned message-lifecycle
ledger migration and conversion of shared tables to SQLite STRICT typing; the
agent database migration and legacy-session import also ran
([`logs/v3-refusal-journal.log:12-34`](./logs/v3-refusal-journal.log)).

**Operator gate:** do not activate B unless the service is stopped and a
snapshot of every database and WAL sidecar exists and has been verified
restorable. Do not permit A to start against B-migrated state
([`v3-classification.md:37-41`](./v3-classification.md)).

**Forward recovery:** if snapshot restore is unavailable or rejected, keep A
stopped; select B or a newer generation compatible with shared schema `5` and
per-agent schema `14`; start it against the migrated state and run acceptance;
preserve the failed state and snapshot for operator diagnosis. This is now
behaviorally evidenced: the v3 step-8b leg reselected B, proved B healthy
against the still-migrated state, and confirmed the stamps remained shared
`5` / per-agent `14`
([`logs/v3-classification-sequence.log:22-26`](./logs/v3-classification-sequence.log)).

The separate future-version config guard also refused automatic startup
migrations under an older binary and named the intentional recovery override
([`logs/v3-future-guard.log:1-6`](./logs/v3-future-guard.log)).

## Run history and v3 adaptations

The v2 run was interrupted by the session limit and subsequent machine reboot.
Its completed sequence proved assertions 1 and 2, but the archive lacked
assertion 3's complete classification, operator gate, and forward-recovery
plan; it also lacked exact pins and complete cleanup proof. The adjudication
therefore correctly held the gate at NOT PASS
([`v3-adjudication-of-v2.md:3-21`](./v3-adjudication-of-v2.md),
[`v3-adjudication-of-v2.md:93-108`](./v3-adjudication-of-v2.md)).

The v3 rerun re-demonstrated the full contract in one classification sequence.
It made two narrow harness adaptations driven by the adjudication:

- control-leg application logging was pinned beneath the spike root
  ([`harness/v3-classification-sequence.sh:89-100`](./harness/v3-classification-sequence.sh));
- a new step-8b forward-recovery leg reselected B before restore and proved it
  healthy against the still-migrated state
  ([`harness/v3-classification-sequence.sh:72-78`](./harness/v3-classification-sequence.sh)).

The reboot also removed the manually pre-seeded `2026.6.33` directory used by
v2. The v3 rerun replaced it with the reproducible
`harness/v3-seed-s633.sh` fixture, which starts `2026.6.33` in an isolated
state directory and requires `user_version=1`
([`harness/v3-seed-s633.sh:1-20`](./harness/v3-seed-s633.sh));
the archived seed log reaches ready and shuts down cleanly
([`logs/v3-seed-s633.log:1-20`](./logs/v3-seed-s633.log)).

## Cleanup and postflight

The final postflight proves the unit file absent, no matching registered unit,
the unit inactive, zero matching spike processes, an unchanged
`~/.openclaw` listing, `SPIKE4-V3-POSTFLIGHT-PASS`, and removal of the
disposable `SPIKE_P` after evidence archival
([`logs/v3-postflight.log:11-21`](./logs/v3-postflight.log)).

The same log intentionally retains an earlier false-positive section. Two
comparison bugs were found during postflight:

- the initial `~/.openclaw` listing comparison included the `..` parent entry,
  so an unrelated parent-directory mtime could appear as live-state mutation;
- the initial process search matched the orchestrating shell because its own
  argv contained the spike path
  ([`logs/v3-postflight.log:3-10`](./logs/v3-postflight.log)).

Both checks were corrected in the archived harness: the listing excludes the
parent entry, and the process check excludes the orchestrating shell/lookup
process before deciding whether a spike process remains
([`harness/v3-postflight.sh:22-25`](./harness/v3-postflight.sh),
[`harness/v3-postflight.sh:61-69`](./harness/v3-postflight.sh)).
The clean final section, not the retained earlier false positive, is the
postflight verdict.

## Caveats recorded for the applicator design

- The run was fully user-owned; there was no root-owned spike root. This is an
  explicit waiver for **this** gated decision, the *OpenClawGeneration state
  machine*. Ownership does not change SQLite stamp compatibility or restored
  bytes. Root-enforced immutability and privileged pointer control are Spike
  1's subject
  ([`v3-adjudication-of-v2.md:128-144`](./v3-adjudication-of-v2.md)).
- Generation setup stages installed trees with `cp -al`
  ([`harness/setup.sh:24-29`](./harness/setup.sh)). Hardlink staging requires
  the generation root and staging cache to be on the **same filesystem**. The
  rerun had to move `SPIKE_P` off tmpfs to satisfy that constraint. The
  production applicator must either guarantee co-filesystem staging or use a
  staging strategy that does not depend on cross-filesystem hardlinks.
- “Reversible” is transition- and fixture-specific. The
  `2026.6.33 -> 2026.7.1-2` control remained at stamp `1` and rolled back
  cleanly, but this is not a blanket promise about all release migrations.
- A health failure after a schema-stamping activation cannot be treated as a
  pointer-only rollback. The state machine must distinguish
  rollback-benign transitions from snapshot-required transitions and enforce
  the snapshot/operator gate before activation.
- The future-version guard is defense in depth, not the rollback mechanism.
  Production recovery must retain an explicit operator path to a
  schema-compatible forward generation while preserving failed state for
  diagnosis.
