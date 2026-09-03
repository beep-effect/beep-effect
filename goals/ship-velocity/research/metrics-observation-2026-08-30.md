# Ship velocity representative observation

Status: operator-authorized evidence volume accepted; concurrency green; authenticated cache
observation and final closeout PR remain open.

## Window

PR #874 merged at `2026-08-30T02:39:33Z`. This receipt treats the required seven consecutive
days as the half-open, 168-hour UTC interval
`[2026-08-30T02:39:33Z, 2026-09-06T02:39:33Z)`.

The first post-merge sample found a recurring locally catchable required-check failure. This
candidate interval therefore cannot satisfy the completion gate. A later 168-hour interval must
run after the repair reaches `main` without the cause recurring. P5, lifecycle, and initiative
status remain open; this receipt makes no goal migration.

### Fresh repair interval

PR #892 merged at `2026-08-30T08:47:00Z`. The replacement observation interval is
`[2026-08-30T08:47:00Z, 2026-09-06T08:47:00Z)`. Its first current-main Check run is
`33302435645`; it completed successfully, including Test Unit, Coverage Regression, and Property
Laws. The packet remains active and no goal migration is included.

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
`@beep/repo-cli` package verification passed locally.

PR #892 passed every required hosted context, including Test Unit and Coverage Regression, at
head `fde3afad1c2d8b34b91c5811891b9571e89cb6b9`. It merged as
`a35e8cc3c6e688a8689de8b0227b73d9bbff6d54` at the fresh interval start. The first current-main
run `33302435645` completed successfully. The remaining 168-hour interval and non-parity gates
remain pending.

## Fresh interval gate status

- Zero recurring locally catchable required-check failures: first post-repair main-push sample
  green; continue observing through `2026-09-06T08:47:00Z`.
- Attached watch p95 under 60 seconds: pending fresh-interval events.
- Dead-owner takeover under 5 minutes: pending fresh-interval incidents.
- Every active sibling checkout reads the remote cache: repair and fresh sample pending.
- Two concurrent verifies without OOM: live trial pending.
- No hot-file publish rework: continue counting through the interval.

### Fresh scheduler sample

Snapshot time: `2026-08-30T09:12:23Z`.

The machine-wide journal recorded three admissions after the fresh interval opened:

- one released full proof, with a 90-second queue wait, 117-second lease, and 2.25 GiB peak;
- one released merged preview, with no queue wait, 263-second lease, and 12.49 GiB peak;
- one full proof still active at the snapshot, with no queue wait and a 29.72 GiB peak so far.

The intervals did not overlap. Scheduler status reported capacity 9, three active tokens,
58.87 GiB available, and no queued, dead, or quarantined row. This is valid single-lease memory
evidence, but it does not prove the two-concurrent-verify gate or a terminal no-OOM result for the
active lease.

## Operator-authorized evidence-volume closeout

On 2026-08-30 the operator accepted a closeout judgment from the observed production volume
instead of requiring the original duration proxy to elapse. This does not relabel the sample as a
seven-day interval. It records the operator's judgment that the concentrated merge and proof
traffic is representative enough for this closeout and keeps every outcome condition mandatory.

Snapshot time: `2026-08-30T16:50:03Z`.

- 24 PRs merged in the rolling 24 hours;
- 16 PRs merged after #874, including eight that were both opened and merged after the anchor;
- median open-to-merge time for those eight PRs: 50.95 minutes (mean 85.31, range 21.82–192.18);
- eight main-push Check runs after #892: seven successful and one failed;
- the failure was #869's isolated T7 capacity-preflight fixture I/O mismatch on run
  `33303853318`; its PR-head coverage run was green and the next six main-push Check runs were
  green, so `parity-ledger.md` classifies it as nonrecurring rather than erasing it;
- eight main-push Storybook runs after #892: six successful, two cancelled, and zero failed.

### Backpressure and takeover refresh

The corrected user service is enabled and active with a 30-second poll, 240-second stale lease,
and therefore a 270-second worst-case takeover-detection bound. The installer now targets the
shared projects root, while the watcher enumerates only sanctioned top-level checkouts and
`*-worktrees/*` roots. After restart it completed multiple polls with zero restarts, no journal
diagnostics, 13.4 MiB peak memory, and 0.161 seconds of CPU in its first minute. The prior generic
recursive scan had peaked at 548.6 MiB and was rejected before closeout. A final full dry scan
completed in 0.21 seconds at 3.7 MiB after fresh leases were filtered before mutex acquisition;
stale-looking candidates still receive the full locked recheck.

The focused watcher suite exercises stale P0 detection, CAS transfer, resume, retired-owner
refusal, abandoned-claim recovery, and blank cache-placeholder repair; all seven focused tests
pass. Two live optional
Vercel P1 rows for #897 reached the inbox on their observing timestamp. No required P0 hosted red
or dead-owner incident occurred, so there is no fabricated production takeover latency. The
configured bound plus the executable takeover tests are the acceptance evidence for the absent
incident class.

This paragraph records the architecture that existed during the sample. Operator PR #921 merged
at `2026-08-31T00:53:53Z` as `5a4fc2707a792c510f98b6c14b8cae1851e3118b` and intentionally
removed the published-PR lease, user watcher, automatic takeover, and mutation fence. It retained
P0 inbox delivery and the hard Stop/SubagentStop gate. Closeout therefore treats A4 as superseded,
not satisfied: the historical 270-second bound remains evidence of the retired implementation,
current main has no ownership lease that can strand a dead harness, and no automatic takeover
latency is claimed.

### Cache provisioning refresh

A post-repair activity scan found 11 checkout roots. All 11 now carry a git-ignored, reference-only
remote-read quad. Five `.env` files were created from the sanctioned template; six older roots had
blank `TURBO_TEAM` placeholders repaired. No secret value was read, printed, or written. The
1Password MCP was unavailable and the local `op` CLI was signed out, so a dry plan correctly
degraded to `--cache=local:rw`. Configuration coverage is complete, but a fresh remote-read probe
remains required after the operator authorizes a 1Password CLI session.

### Admission and hot-file refresh

The live dual-verify trial was submitted from clean current-main `beep-effect6` and `beep-effect7`
checkouts. After 58 minutes behind a valid merged-preview lease, `beep-effect7` was admitted at
three tokens with seven tokens free. `beep-effect6` nevertheless remained queued because
`QualityScheduler.ts` skips every same-origin ticket while a lease exists and `Handler.ts` retains
the same exclusive per-origin proof lock. All sibling checkouts share that origin key, making the
manifest's required overlap unreachable by construction. The redundant queued waiter was
interrupted cleanly. The admitted `beep-effect7` proof then passed every cheap-gate and pre-push
lane and released normally at `2026-08-30T18:03:41Z`. Its scheduler journal recorded a
32,089,321,472-byte peak with no OOM, dead lease, or quarantine. The next same-origin waiter was
admitted immediately after release despite seven capacity tokens having been free throughout,
which separates the origin guard from machine-capacity pressure.

The closeout repair retains the original concurrency outcome instead of weakening the gate. New
tickets and leases identify the scheduler-origin-concurrency protocol; older entries decode as
legacy, and same-origin legacy state drains before migration. The first current contender then
installs a persistent v4
origin-lock retirement marker that older clients fail closed against. Current siblings may overlap
under weighted admission, while below-envelope hosts serialize through a separate fallback lock.
After the first closeout review repaired both mixed-version ticket orders and typed filesystem
failures, the focused scheduler/coordinator suites pass 56 tests and the full Yeet unit file passes
all 132 tests. An untouched pre-change decoder accepts and discards the additive protocol field. A
live dual-full-proof run on the repaired implementation remains required for the terminal no-OOM
receipt.

Across the 17 merged PRs from the #874 anchor through this snapshot, only #874 itself touched
`goals/INDEX.md` or `explorations/ATLAS.md`. The 16 subsequent merges touched neither projection,
and no sampled publish failure named either path as its retry cause.

### Terminal dual-full-proof receipt

Two independent frozen-install clones at commit `70883b352406f78789acb9c88012c2fa4fd43e4c`
ran full Yeet verification under `scheduler-origin-concurrency/v1`. Both used origin key
`4cc31eeb4dec`, held three admission tokens, and completed every preflight, build, lint,
typecheck, coverage, Desktop IPC, unit, integration, JSDoc, and full docgen lane at exit 0.

- proof C admitted at `2026-08-30T21:04:51.871Z` and released at
  `2026-08-30T21:58:52.316Z`; its verdict elapsed 3,240,467 ms and recorded 10,878,916 KiB for
  cheap gates and 17,966,264 KiB for pre-push;
- proof D admitted at `2026-08-30T21:10:03.115Z` and released at
  `2026-08-30T22:03:21.782Z`; its verdict elapsed 3,203,699 ms and recorded 11,005,400 KiB for
  cheap gates and 18,001,708 KiB for pre-push;
- the admission intervals overlapped for 2,929,201 ms, or 48 minutes 49.201 seconds;
- capacity contracted below the six already-admitted full-proof tokens during pressure and later
  recovered to ten without engaging the hard floor, killing a lease, or quarantining state;
- both terminal verdicts report `outcome: success`; no OOM or interrupted proof occurred.

The durable journal retains both admitted and released timestamps, but its event schema does not
carry the coordination protocol and both release rows omitted the verdict's available peak RSS.
`OPPORTUNITIES.md` records that evidence-join gap rather than overstating the journal.

### Final remote-read preparation

The original reference repair covered 11 roots, but checkout liveness moved before the terminal
sample. A fleet scan at `2026-08-31T02:45:59Z` classified 16 roots as live. Four intersected the
historical set, and nine of the current roots lacked one or more members of the remote-read quad.
The sanctioned provisioning helper copied only the missing fields from an existing
reference-only source. A sanitized follow-up found all 16 roots with a git-ignored `https`
endpoint, `op://` token reference, nonblank team, and `local:rw,remote:r` posture; it did not
render any field value. Alternate nonblank references were preserved for authenticated proof
rather than overwritten by assumption.

This is configuration readiness, not a cache outcome. The 1Password MCP remained unavailable,
and the last safe CLI identity check was signed out. The final sample must rescan liveness after
the operator authorizes the exact `op run` wrapper, use an isolated local cache directory per
root, and observe at least one first-touch `source: REMOTE` result from each frozen root before
this gate closes.

### Authenticated cache canary

On 2026-08-31, an output-suppressed `op run --env-file=.env -- true` preflight resolved the
existing references. The configured endpoint and team also matched the live repository variables.
The canary `beep cache probe` still returned `Remote caching unavailable (Authentication failed)`.
Sanitized control-plane metadata showed that the authoritative AWS read-token parameter changed on
2026-08-12, while the referenced 1Password item was last updated in February. No secret value or
reference path was printed, copied, or stored.

The timestamp difference makes mirror drift the leading hypothesis. It does not prove that the
secret values differ or that drift caused the authentication failure. Reference resolution
therefore does not close the cache gate. The operator must verify or refresh the existing
1Password mirror, or otherwise repair cache authentication, then authorize the exact `op run`
wrapper and rerun the cross-checkout sample.

After PR #937 merged on 2026-08-31, a fresh canary on current `main` reproduced the same remote
authentication failure. Its second pass replayed eight local cache hits, which does not count as a
remote-read receipt.

### Closeout state after the terminal trial

The evidence-volume ruling closes the calendar-duration question, and the terminal dual proof
closes the concurrency condition. PR #929 reached Yeet `merge-ready: yes` and merged on
2026-08-31 as the implementation-repair PR. The packet remains active because cache authentication
still blocks a fresh remote-read observation from every active root. Lifecycle and P5 status remain
unchanged until authentication is repaired and the sample succeeds. PR #937 merged as
`c57f63ac76cd3f25fbc700bad3032d6ce6a06d94` before those artifacts landed. Its green hosted checks
and Greptile `5/5` do not satisfy the semantic completion gate. A successor final-evidence PR now
owns the cache receipt, status flip, reflection, and terminal Yeet `merge-ready: yes` proof.

### 2026-09-02 authenticated remote-read sample

The final repair identified a stale checkout reference, not a stale mirror. Digest-only comparison
proved that the infra-vault read-only item still matches its SSM source, while the checkout
reference resolved to a different February item that predates the AWS cache. The helper gained an
explicit comparison-and-replacement mode and corrected or completed 27 ignored checkout quads.

A fresh `worktree fleet` snapshot at `2026-09-03T00:11:59Z` froze six in-scope live roots. All six
carry the canonical reference. Five exact output-suppressed wrappers resolved and returned 200 for
a known hosted artifact; the sixth was skipped before HTTP because an unrelated non-cache
reference in the same `.env` names a missing field. A separately labelled TURBO-only canary in
that root then resolved, returned 200, and reported eight first-touch remote hits. Five roots
therefore reported eight first-touch remote hits each from fresh local cache directories. One
GET-200 root reported eight misses on a different revision and lockfile and is classified
`authenticated-cold`; no root was `auth-failed`. `research/cache-proof.md` is authoritative for
the per-root counts, summary paths, and the explicit reference-coverage →
authenticated-resolution → observed-hit distinction.

The packet now carries its P5/lifecycle flip and closeout reflection on the successor branch. PR
#937 remains historical evidence, not the final PR. The successor final-evidence PR must still be
published and driven to terminal Yeet `merge-ready: yes` before merge.
