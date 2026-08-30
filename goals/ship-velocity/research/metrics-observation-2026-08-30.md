# Ship velocity representative observation

Status: candidate window failed; parity repair in progress.

## Window

PR #874 merged at `2026-08-30T02:39:33Z`. This receipt treats the required seven consecutive
days as the half-open, 168-hour UTC interval
`[2026-08-30T02:39:33Z, 2026-09-06T02:39:33Z)`.

The first post-merge sample found a recurring locally catchable required-check failure. This
candidate interval therefore cannot satisfy the completion gate. A later 168-hour interval must
run after the repair reaches `main` without the cause recurring. P5, lifecycle, and initiative
status remain open; this receipt makes no goal migration.

## Implementation PR anchor

- Final head: `9b40e17c250d8e419d937385612be9475975190d`.
- Squash commit: `d324544d3a3b333b8ef1f9eb225df2d065b70338`.
- Hosted closeout: 29 contexts, 25 successful, none pending, and two skipped. The two failures
  were optional Vercel deployment contexts; all required repository contexts passed.
- Review closeout: 22 threads, zero unresolved or unresolved-outdated; Greptile reported `5/5`.
- Result: merged into `main` at the window start timestamp.

## Day 1 evidence

Snapshot time: `2026-08-30T07:36Z`.

### Backpressure and takeover

No post-merge hosted-watch failure capsule or takeover event was present in the sampled inboxes.
The sample is therefore too small to calculate either required watch-to-inbox p95 or takeover
latency.

The same inboxes contained 12 `local-shard-failed` P0 capsules after the window opened. Seven had
ACK receipts with latencies of 21, 31, 326, 431, 565, 584, and 814 seconds; five remained unacked
at the snapshot. These rows are retained as supporting backpressure evidence but excluded from
the hosted-watch p95 because their event kind is local shard failure, not watch delivery.

### Required-check parity

The first post-#874 main push and current `main` both failed on the same test-hermeticity defect:

- `main@d324544d3a3`, run `33288500757`;
- `main@48358da036`, run `33294036758`;
- required contexts: Test Unit and Coverage Regression;
- corroborating optional context: Property Laws;
- failure: `quality-tasks.test.ts` expected the 17-command pull-request path, while the valid
  `push/main` path produced 15 commands and skipped changeset status.

The brittle count assertion originated in #837. #874 retained it while adding a test wrapper that
could not replace the active Effect `ConfigProvider`. This is one recurring, locally catchable
cause class, not three independent failures. `parity-ledger.md` records it as an open P0 defect.

### Remote cache

A merge-time-bounded dashboard sample found 100 Turbo summaries across eight active checkouts.
After excluding seven disabled runs, it reported:

- 724 eligible first touches;
- 32 remote hits, a 4.42% eligible first-touch hit rate;
- zero changed-source correctness violations;
- four checkouts with remote-eligible runs;
- four checkouts with local-only runs and no remote-eligible observation.

The four local-only checkouts prevent a claim that every active sibling checkout read the remote
cache. Zero hits alone would not prove a broken read path, but a local-only mode does not exercise
the read path. Their 30 summaries were ordinary, enabled, non-forced `check` runs. Three
worktrees lacked per-checkout remote-read configuration, while one sibling clone had an
incomplete four-name configuration with a blank team field. Every sampled revision contained the
shipped implementation and used the current repo CLI, ruling out stale code and script bypass.
The 1Password MCP was unavailable and no raw 1Password data or secret value was inspected.

The sample used regular-file copies in a temporary bounded runs directory because the dashboard
ignored symlinked summaries; `OPPORTUNITIES.md` records both tooling and provisioning gaps.

### Admission, memory, and OOM

The machine-wide journal contained 11 post-merge admissions and 11 releases:

- six full-proof admissions at weight 3;
- five merged-preview admissions at weight 5;
- eight releases with a memory-peak value;
- highest recorded memory peak: 28.55 GiB;
- longest observed queue wait: 656,042 ms;
- no overlapping full-proof admissions.

At the snapshot the scheduler had capacity 10, zero active tokens, and no ticket, dead lease, or
quarantined row. The journal does not encode an OOM outcome, so release rows alone do not prove
zero OOM. The required two-concurrent-verify trial remains unproven.

### Contention-family retries

The attempt journals contained five publish starts and four terminal publish failures. The four
classified failures stopped in cheap-gates or pre-push proof; none named INDEX, ATLAS, or another
declared contention family. The unmatched start has no terminal row and no current scheduler
lease, so its outcome and retry cause remain `UNKNOWN`.

No contention-family retry is proven in this snapshot. The missing terminal row is recorded in
`OPPORTUNITIES.md` and must remain unclassified rather than counted as zero-cost success.

## Gate status after Day 1

- Attached watch p95 under 60 seconds: insufficient events.
- Dead-owner takeover under 5 minutes: insufficient incidents.
- Zero recurring locally catchable required-check failures: failed; repair open.
- Every active sibling checkout reads the remote cache: failed in this snapshot.
- Two concurrent verifies without OOM: not proven.
- No hot-file publish rework: no qualifying retry observed; one publish outcome unknown.

The observation window cannot close until every condition is proven across a fresh full interval.

## Parity repair status

The repair models the event and ref through the active Effect `ConfigProvider`, gives pull-request
and main-push postures separate test layers, and asserts semantic lane inclusion rather than a
shared ambient command count. The focused 170-test CLI suite and the mandatory
`@beep/repo-cli` package verification passed locally. Hosted proof and the fresh observation
interval remain pending.
