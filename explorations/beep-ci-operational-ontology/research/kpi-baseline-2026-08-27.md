# S0 first-cut KPI baseline — 2026-08-27

> **EPOCH BOUNDARY (added same day, from the partner review; verified against GitHub):
> every number in this document is PRE-INTERVENTION evidence.** PR #870 merged
> 2026-08-27T19:52:03Z (merge commit `debbbb51f7`) layering a machine-wide weighted
> admission scheduler OVER the retained per-origin proof lock (durable
> `YeetAdmissionTicket`/`YeetAdmissionLease`, `AdmissionWorkKind`
> full-proof|merged-preview|review-fix|publish, `AdmissionPriority` publish|verify,
> capacity/aging/quarantine). The lock itself remains (round-2 seat F, verified against
> `QualityScheduler.ts` and the D1 design record); what changes is contender behavior —
> new-binary contenders QUEUE instead of bouncing. The 27%/17% lock-bounce economy
> below is the behavior #870 was built to retire. #870 is the packet's **first
> ControlIntervention** (`landedAt 2026-08-27T19:52:03Z`) — with one hard attribution
> caveat (seat F): **merge time is NOT the fleet boundary.** Adoption is staggered:
> checkouts running pre-#870 binaries keep bouncing after 19:52Z, so intervention
> membership must be qualified per (checkout, HEAD ancestry ≥ `debbbb51f7`), never by
> wall clock alone. The adoption census at partition time lives in the evidence
> snapshot's `CHECKOUT_HEADS.txt`. This checkout (api-ref-scratch, merge-base
> `6041ec475a`) predates #870 — its journals are pure pre-intervention telemetry.

First deterministic computation of the packet's KPI from existing telemetry, per the
baseline-first ruling in [`../DECISIONS.md`](../DECISIONS.md). Two tiers below: a
single-checkout v0 (`beep-effect8`, raw) and the fleet v0.5 extension (all sibling
checkouts, filtered recipe); machine-local inputs throughout.

## KPI definition (v0 operationalization)

**Time-to-certainty per verification episode**: wall-clock time from the first failed yeet
attempt in a branch's red streak to the end of the next successful attempt — the closest
existing proxy for "agent writes code that must be validated → that agent knows with
certainty it passes its requirements." Reported as a distribution (P50/P95), never a
scalar. Tier/epoch qualification (per the kpi-shape ruling) enters at v1; v0 episodes span
all attempt modes on one checkout.

## Vein

`.beep/yeet/runs/<branch>-<hash>/attempts.ndjson` — schema `yeet-attempt-journal/v1`
(`packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts`): branch-scoped
`attempt-started`/`attempt-finished` events, each finish embedding the full
`yeet-verdict/v2` (wall `elapsedMs`, `outcome`, `mode`, `failedStepId`, `failureKind`,
per-lane statuses `passed | failed | not-run`, timestamps).

> **RING BUFFER, not append-only** (round-1 seat C correction, 2026-08-27): the journal
> retains only the newest ~50 attempt starts per branch (`RETAINED_ATTEMPTS = 50`,
> AttemptJournal.ts:25,203-224 — older lines are dropped on write). Every number in this
> document is a fact about the **retained window**, not full history: episodes crossing
> the retention boundary are truncated or missing, and busy branches under-report their
> past. The durable ETL must snapshot journals continuously to build real history.

Vein-shape findings that cost an hour to learn, recorded so nobody relearns them:

- `verdict.json` per run dir is **last-write-only** (no history); the journal is the
  episode source. 41 verdict files vs 18 journals with 186 finished attempts here.
- Lane `durationMs` is optional; lane status vocabulary is `passed|failed|not-run`, not
  success/failure.
- Machine-lock contention failures are **first-class recorded data**: the verdict `message`
  carries the owning checkout, pid, and lock path.

## Numbers (beep-effect8, 186 attempts, 18 branches)

| Metric | n | P50 | P95 |
| --- | --- | --- | --- |
| Green attempt wall time | 65 | 11.9m | 24.2m |
| Red attempt wall time | 121 | 4.1s | 24.2m |
| **Red→green episode (KPI proxy)** | 27 | **37.2m** | **3.3h** |

- **65% of attempts are red** (121/186) — the operator's axiom ("I have yet to see a
  single PR in the last year that didn't fail CI or typecheck once") holds in the data;
  fail-fast ordering optimizes the common case, not the exception.
- **27% of ALL attempts (51/186) are proof-lock contention bounces** — the "constipated
  hose" is a quarter of the telemetry before any ontology exists. Top failed step is
  `publish:00-head-install-preflight` (52), dominated by those bounces
  (`failureKind: handler-error` 74).
- Worst episodes: 5.2h across 8 attempts (`feat/runners-bake`), 3.3h across 13 attempts
  (`feat/knowledge-refs-rewrite-pass`).
- Per-mode P50 wall: repair 5.0m · publish 8.6m · monitor 15.2m · closeout 4.2s · verify
  ~0s (the retained verify sample is dominated by 11–21ms lock bounces).
- **Right-censoring (probe v3)**: 3 branches end the retained window still red — 59 red
  attempts in open streaks (open-streak age P50 45.2m, max 1.5h) that the closed-episode
  distribution above EXCLUDES, biasing P50/P95 downward. Survivorship caveat applies to
  every closed-episode number in this document.

Spot-check (hand-verified against the raw journal for `chore/committed-idea-config`): the
red streak opening 08:24:45Z (docgen repair failure, 195s) resolves at the 08:32:56Z repair
success (+137s) ≈ 10.5m — matching the probe's reported episode. Sequence structure
(red streak → green resolution, interleaved publish/monitor/closeout) confirmed real.

## Reproduction

Single-checkout table above (raw, all modes):

```bash
python3 explorations/beep-ci-operational-ontology/research/scripts/kpi_baseline_probe.py <checkout-root>
```

Fleet v0.5 table below (probe v3 committed the fleet filters that produced it —
round-1 seat C reproducibility repair):

```bash
python3 explorations/beep-ci-operational-ontology/research/scripts/kpi_baseline_probe.py \
  ~/YeeBois/projects/* --modes verify,repair,publish --exclude-bounces --max-episode-hours 24
```

Percentiles are nearest-rank on the sorted sample (`round(p/100*(n-1))`) — named here so
an independent rerun does not invent estimator semantics. Inputs are machine-local
(`.beep` is gitignored), so determinism here means: same journal bytes → same numbers.
The durable ETL (labs-incubated per the incubation ruling) will snapshot its input
inventory (journal digests) alongside each published distribution.

Measurement-rule caveats the fleet filters embed (named by the round-1 adversarial seat;
kept deliberately, each a documented censorship to revisit at v1):

- `--exclude-bounces` removes bounce ATTEMPTS from episode opening and attempt counts —
  17% of fleet attempts. It does NOT remove waiting wall time from episode durations
  (round-2 seat F correction): episodes are still measured first-red → next-green, so
  idle/bounce wall time between those endpoints remains inside the 292-hour pool.
  CQ-007/CQ-012's decomposition (`queueWaitMs`/`lockWaitMs`) is the v1 fix that makes
  the wait components separable instead of merely unlabeled.
- `--max-episode-hours 24` censors the long tail the P95 is supposed to expose (multi-day
  branch sagas read as "no episode"). Report both cut and uncut at v1.
- Right-censored open streaks are now REPORTED but still excluded from the closed-episode
  distribution; the reported span is first-red → last recorded event (a lower bound —
  no common observation cutoff exists in the vein).
- The lock-bounce class rests on an exact prose substring (`"Another Yeet full proof"`
  in the verdict message, `failureKind handler-error`): a wording change in Yeet
  silently moves contention attempts into the KPI. The evidence snapshot preserves
  matching messages for re-derivation; a structured bounce marker in the journal is the
  real fix.

## Fleet baseline (v0.5, same day)

Sweep of every checkout under `~/YeeBois/projects/` carrying attempt journals — **27
checkouts, 2,433 finished attempts, 244 (checkout, branch) pairs, window 2026-08-04 →
2026-08-27** (~3.5 weeks).

Provenance honesty (round-2 seat F): the numbers in this section were first computed by
a one-off sweep; the committed probe gained the equivalent path afterwards. As of probe
v3.1 the **episode row reproduces exactly** — `282 episodes, P50 41.3m, P95 3.1h`
re-derived 2026-08-27 with correct `(checkout, branch)` episode keying (branch-only
keying was a real defect: same-named branches exist in sibling checkouts; the corrected
keying happens to leave the published quantiles unchanged). Row semantics: the
green/red ATTEMPT rows are the RAW census (no filters); the EPISODE row applies the
fleet recipe (`--modes verify,repair,publish --exclude-bounces --max-episode-hours 24`).
The same rerun surfaced fleet-scale right-censoring the original sweep never reported:
**90 (checkout, branch) pairs end the retained window still red (236 red attempts,
observed open-streak span up to 65.2h)** — excluded from the closed-episode
distribution, biasing P50/P95 downward.

| Metric | n | P50 | P95 |
| --- | --- | --- | --- |
| Green attempt wall time | 1,001 | 10.9m | 31.1m |
| Red attempt wall time | 1,432 | 15.7s | 24.9m |
| **Red→green episode (<24h)** | 282 | **41.3m** | **3.1h** |

- **59% of fleet attempts are red** (1,432/2,433).
- **17% of ALL fleet attempts are proof-lock contention bounces** (416) — the constipation
  measured at fleet scale.
- **292 machine-hours of wall time inside red→green episodes in 3.5 weeks (~84 h/week)** —
  the toil pool the KPI attacks.
- Top non-lock failed steps: `full:01-pre-push` 387 (the gauntlet itself),
  `monitor:02-pr-checks-watch` 184 (CI-tier certainty wait), `commit:01-git-commit` 144,
  `closeout:01-pr-context` 69, `publish:00-head-install-preflight` 48.

## CI-tier certainty (v0 sketch, last 100 hosted runs)

From `gh run list` durations (createdAt → updatedAt; `run_started_at` is rewritten on
retry, so queue time is not separable in v0 — see memory `actions-run-started-at-rewritten`):

| Workflow | n | P50 | P95 | red |
| --- | --- | --- | --- | --- |
| Check | 50 | 12.0m | 28.6m | **80%** |
| Storybook | 49 | 9.8m | 11.7m | 18% |

The Check P50 is a WORKFLOW-DURATION sample only (round-2 seat F correction: without
the per-PR head-push→checks-green join it cannot establish an interval "after local
green" — the earlier additive reading overclaimed). Caveats: chronic-red main runs
inflate the red rate; the join is the v1 metric, routed to a Codex lane.

## v0 limitations → v1 refinements

(Items 1–4 describe the earlier single-checkout v0 run; the fleet v0.5 section above
already applies the item-1 filters via the probe v3 flags.)

1. Episode boundaries currently span ALL modes: `closeout:01-pr-context` bookkeeping
   failures and 11ms lock bounces open "red streaks" that aren't code-red. v1 filters
   episode-relevant modes (verify/repair/publish), classifies lock bounces as a separate
   contention metric, and keys certainty tiers per the kpi-shape ruling.
2. Single checkout. Fleet aggregation = sibling checkouts' `.beep/yeet/runs/*/attempts.ndjson`
   plus the GitHub-runs join (CI-merge-tier certainty).
3. Episode end uses local green; CI-tier certainty (merge-ready) needs the
   `monitor` lane + GitHub check data joined in.
4. No epoch qualification yet: an episode spanning a `git merge origin/main` mixes epochs.
