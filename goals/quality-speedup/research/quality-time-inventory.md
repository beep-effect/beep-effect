# Quality-time inventory — where the time actually goes

Captured 2026-08-03/04 on `chore/improve-speed-of-things`. Every number below
is reproducible from a committed data file or cited `file:line`; single-sample
timings are labeled estimates. Data files:

- [`data/ci-lane-timings.tsv`](./data/ci-lane-timings.tsv) — 1,932 job rows
  from the last 100 `check.yml` runs (92 completed), via `gh` REST.
- [`data/fleet-yeet-runs.tsv`](./data/fleet-yeet-runs.tsv),
  [`data/fleet-lane-observations.tsv`](./data/fleet-lane-observations.tsv),
  [`data/fleet-turbo-task-timings.tsv`](./data/fleet-turbo-task-timings.tsv) —
  anonymized scan of 49 local clone checkouts: 251 recorded yeet runs
  (2026-06-11 → 2026-08-04), 728 lane observations (220 timed), 16,007 Turbo
  task executions from 199 summaries across 11 clones.

Prior art is cited, not re-derived: `repo-quality-throughput` (348-task
duplicate-feedback fix and the rqt-001..009 speedups are DONE — do not
re-benchmark), `agent-pipeline-velocity` (baseline pipeline map),
`coding-agent-effectiveness-evidence-loop` (waits, mistrial/exhibit contract,
durable per-lane proofs), `box-typecheck-cost` (instantiation method).

## 1. Instrument audit (read this before trusting any number)

Verdict per instrument — what it records, what it cannot, smallest fix. Full
citations in the audit working notes; key lines inline.

| Instrument | Records | Does NOT record | Smallest fix (owner) |
| --- | --- | --- | --- |
| `yeet-verdict/v1` | outcome, lanes (id/status/optional aggregate `durationMs`/exit/repair), base-freshness, terminal `createdAt` | run start/end, phase totals, failure stage when no result returned; stable `runId` per branch ⇒ attempts overwrite, no history | add `startedAt`/`endedAt`/`elapsedMs` + `attemptId`; add `failedStepId`/`failureKind` (this packet → CLI follow-up) |
| ProofState | per-lane command hash, diff fingerprint, one shared `verifiedAt`; full-proof lock | per-lane timing/outcome; written only after the WHOLE proof succeeds — interruption forfeits everything (`ProofState.ts:529-557`) | transactional per-lane checkpoints — already prescribed by `coding-agent-effectiveness-evidence-loop/PLAN.md:221-239` (owned there) |
| `RepoStepRunResult` | stepId, command, exit code, bounded output | any time field (`RepoRun.models.ts:354-366`); Handler times steps separately and only into the verdict | `startedAt`/`endedAt`/`elapsedMs` on the result — already proposed by `repo-quality-throughput/research/batch-02:66-74` (owned there) |
| Quality-issue index | normalized issues + routing | run id, timestamps, durations; overwritten snapshot ⇒ no recurrence history | index-level `runId`+`createdAt` |
| Turbo summaries | per-task start/end/cache — the ONE real per-task timing source | any join to a yeet run/lane; CLI picks newest-by-mtime summary (`Ci.command.ts:155-198`), which can select the wrong invocation | persist chosen summary path + `yeetRunId` in the verdict |
| `ai-metrics` / `agent-effectiveness` | benchmark runs have `elapsedMs`; hook/transcript evidence | any yeet linkage; **agent-effectiveness writes `elapsedMs: 0` unconditionally** (`EvalRecord.ts:96-127`) — unusable for speed by construction | wrap scoring in `Effect.timed`; add optional `yeetRunId` |
| Hosted CI (`gh`) | job start/end/conclusion | cache-hit rates, step-level splits, cancellation causes | none needed for lane-level p50/p95 |

Empirical confirmation from the fleet: **508 of 728 lane observations carry no
duration at all**; verdicts have no run-level duration field anywhere in 251
runs; 4 run dirs have status but no verdict. The four suspected gaps are all
confirmed (two exactly, two as structural classes — the historical "12/23
missing-lane" and "byte-identical 17-min rerun" counts are not reproducible
from retained artifacts precisely because the instruments don't retain
attempts; the mechanisms that produce them are confirmed at
`Handler.ts:194-205,767-772` and `Planner.ts:164-190` + `resume: "never"`).

**Fallow envelope poisoning (gap 4), qualified:** check-mode envelopes are not
misread as advisory findings (`FallowFeedback.ts:359-375` filters
`advisory === true`), but full pre-push overwrites the same fixed filenames
with check-mode content (`GithubChecks.ts:314-325`) and the consumer checks no
freshness/mode — so the next run's advisory feedback can be silently emptied.
Smallest fix: distinct filenames per mode + reject envelopes older than the
yeet run start.

## 2. Per-lane tables

### Hosted CI (92 completed check.yml runs; success-only durations)

| Lane | n | p50 s | p95 s | fail | fail rate | critical path |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Coverage Regression | 66 | 692 | 828 | 22 | ~25% | YES — slowest required lane |
| Test Unit | 82 | 635 | 727 | 8 | ~9% | YES (includes tstyche `type-test` via `--types`) |
| Lint Policy | 66 | 588 | 963 | 18 | ~21% | YES |
| Property Laws | 82 | 538 | 654 | 8 | ~9% | YES |
| Docgen | 79 | 498 | 1085 | 2 | ~2% | YES |
| Check | 65 | 429 | 553 | 11 | ~14% | YES |
| Lint | 81 | 327 | 808 | 9 | ~10% | YES |
| JSDoc Ratchet | 88 | 289 | 371 | 0 | 0% | YES |
| Test Integration | 78 | 277 | 345 | 13 | ~14% | YES |
| Build (push-only) | 12 | 98 | 185 | 2 | — | no (post-merge) |
| Repo Sanity | 89 | 93 | 120 | 2 | ~2% | YES |
| 10 further lanes | — | 7–87 | 8–122 | ≤3 | ≤3% | mixed |

Queue wait p50 ≈ 8–9s on every lane — the hosted queue is not a bottleneck.
Successful-PR makespan: n=37, p50 **12.2 min**, p95 **36.0 min**, max 45 min.
Cache-hit per hosted lane is **not measurable** from gh data (instrument gap);
the audit lane forces `--force` on CI by design (`Quality/Tasks.ts:494-513`).

### Local yeet lanes (the 220 timed of 728 observations)

| Lane | timed n | failed/observed | mean s | total h |
| --- | ---: | ---: | ---: | ---: |
| `full:pre-push` | 39 | 20/101 | 1022 | 11.07 |
| `monitor:pr-checks:watch` | 18 | 9/42 | 489 | 2.44 |
| `publish:head-install-preflight` | 45 | 0/49 | 6.3 | 0.08 |
| `fallow-advisory-feedback` | 42 | 0/104 | 1.9 | 0.02 |
| feedback:check / test / build / lint | 1 each | 0 | 548 / 254 / 139 / 133 | — |

The entire pre-push group (21 sub-lanes: build, check, knip, jsdoc-ratchet,
lint, docgen, test, fallow ×2, repo-sanity ×7, secrets, security, SAST, Nix)
runs strictly serial — outer phases `concurrency: 1` (`Handler.ts:185-208`),
lane group serial (`Quality/Tasks.ts:889-923`); parallelism exists only inside
lint (3) and policy groups (2). Its sub-lane durations are console-only — not
persisted (instrument gap above).

### Turbo tasks (16,007 executions, 11 clones; task time ≠ wall time)

Top repeated sinks: `@beep/repo-cli#test` (27 exec, p50 114s, 11% hit),
`@beep/repo-cli#type-test` (27 exec, p50 35s, 3.7% hit — root-config re-run
from a workspace task, see tstyche inventory), `@beep/oip-web#build` (30 exec,
p50 16s), `@beep/storybook#build` (30 exec, p50 11s), then a long tail of
test/check tasks at 2–13s p50 with 12–30% cache-hit rates.

## 3. Ranked bottlenecks (impacted wall time × frequency)

1. **Local full verify (`full:pre-push`)** — mean 17 min timed, 101
   observations, 20% failed ⇒ repeat runs. Largest measured wall sink
   (11.07 recorded hours). Mix of real work + rerun.
2. **Hosted rerun multiplier** — Coverage Regression (~25% fail), Lint Policy
   (~21%), Test Integration/Check (~14%): every failure converts a 12-min
   makespan into a second (and third) full gauntlet. Rerun class, not real
   work: at observed rates, roughly one in three PR attempts pays ≥1 retry.
3. **The `@beep/schema` MimeType check-time regression** — inflates *every*
   tsgo check program (hosted Check, local check, IDE) since `880c620e89`;
   quantified in the census report (Workstream C) — biggest single
   reduce-work lever.
4. **Waiting: PR-check monitoring + human approval** — `monitor:pr-checks:watch`
   mean 489s × 42 obs local; upstream packet measured plan-approval p95
   105 min and polling at 3.4× tool time (owned by
   `coding-agent-effectiveness-evidence-loop`; not re-derived here).
5. **Docgen** — hosted p50 498s / p95 1085s; cold-local ~24 min (single
   observation, estimate). Only 2 genuine failures in 92 runs (one
   self-inflicted on a jsdoc branch) ⇒ mostly insurance; scope-reducible.
6. **Interrupted-proof forfeiture** — `resume: "never"` + all-or-nothing
   ProofState makes a byte-identical ~17-min rerun structurally guaranteed
   after any interruption. Fix owned by evidence-loop packet (transactional
   lane proofs).
7. **Tstyche surface** — `type-test` 38.9 min task-time across 546 recorded
   executions + local-only `dtslint-tsgo` in every root check; being deleted
   by Workstream A of this packet.
8. **Coverage lane cost itself** — 692s p50 every PR for a lane whose regression
   signal overlaps Test Unit; candidate for scope/architecture review, needs
   its own falsification before touching (see candidates).

## 4. Three cost classes

- **Real work**: hosted lane p50s (§2), warm local verify ~9–17 min. Reducible
  by deleting work (tstyche), shrinking scope (docgen, coverage), or cutting
  per-program type cost (MimeType; census report).
- **Rerun / duplicated**: ~25%/21%/14% hosted lane failure rates × full-run
  retries; 20/39 timed local pre-push failures; forfeited proofs after
  interruption; local cache-hit rates of 12–30% on repeated tasks; CI `--force`
  on the audit lane. This class is the cheapest large win: it spends full
  gauntlets without adding proof.
- **Waiting**: hosted queue negligible (~9s); PR-check watching 489s mean;
  human approval/polling dominates end-to-end (p95 105 min, owned upstream).

## 5. Reduce vs redistribute

Deleting tstyche, scoping docgen/coverage, and the MimeType fix **reduce**
total work. Changing `YEET_TURBO_CONCURRENCY` (currently literal 3,
`Planner.ts:155-162`), the serial 21-lane pre-push group, or `--concurrency=3`
(`Quality/Tasks.ts:494-513`) **redistributes** it — potentially valuable on a
64-thread/128GB workstation (independent lane families: repo-sanity vs
security vs fallow), but bounded by the census-measured memory peaks
(professional-desktop ~9GB per check program) and the standing
machine-usability stop condition. Any concurrency proposal must present both
wall-time AND peak-RSS before/after.

## 6. Remediation candidates

| Candidate | Measured upside | Owner | Falsification test |
| --- | --- | --- | --- |
| Remove tstyche surface (WS-A, this packet) | dtslint-tsgo out of every local check; `type-test` out of Test Unit + local test; ~330 files + 3 generator paths gone | this packet | before/after timed `yeet verify` + Test Unit p50 over next 20 runs |
| Scope docgen: `docgen:local` semantics in verify; changed-package scope hosted | up to ~8 min hosted p50 + ~24 min cold local per run | this packet → follow-up (user-approved direction 2026-08-03) | docgen true-positive count on unchanged packages over 50 runs (currently 2/92 total) |
| Diagnose Coverage Regression + Lint Policy failure sources | ~25%/21% rerun multiplier shrinks toward base rate | needs owner (new follow-up) | classify last 40 failures: real regression vs flake/infra; >50% flake ⇒ lane bug, fix; else keep |
| MimeType type-slicing fix | ~17s check time × every tsgo program (see census report) | this packet (WS-C plan) | re-measure `@beep/schema` barrel probe pre/post |
| Verdict/RepoRun timing fields + `failedStepId` | converts §1's "not measurable" column into measured; enables per-lane p50/p95 locally | prescribed by `repo-quality-throughput` batch-02; implementation unowned | fleet re-scan after 2 weeks: % of lane observations with duration ⇒ target >95% |
| Transactional per-lane proofs + resume | eliminates the 17-min forfeiture class | `coding-agent-effectiveness-evidence-loop` (locked design) | interrupt verify at lane k; next run must skip lanes <k |
| Fallow envelope mode-split + freshness | removes advisory-starvation poisoning | this packet → CLI follow-up | run verify then publish; advisory rows survive |
| `agent-effectiveness` `elapsedMs: 0` bug | makes the instrument usable | trivial CLI fix | recorded benchmark rows show real elapsed |
| Parallelize independent pre-push lane families | redistribution only; up to minutes on 64 threads | blocked on RSS evidence (census) | wall + peak RSS before/after on this workstation |

Hard constraint honored: no Turbo/Biome/Vitest/TS replacement is proposed —
nothing here requires one.

## 7. Not measurable with today's instruments

End-to-end yeet run duration; per-sub-lane pre-push durations (console-only);
local per-lane p50/p95 beyond the 220 timed observations; repair-command
execution cost/outcome; base-freshness (fetch/rebase) cost; issue recurrence
across runs (snapshots overwrite); hosted cache-hit rates; yeet↔Turbo↔agent
correlation (no shared id anywhere). Each has its smallest fix named in §1;
the first four become measurable with the two timing-field candidates alone.
