# L2 — peripheral local and policy verification audit

## Verdict

There is one small, directly supported hosted waste removal: Repo Sanity executes changeset-graph twice. The larger L2 opportunities are conditional deduplication of Fallow computation, hook scoping, and monitor request coalescing. None establishes the required push-to-required-green p95 below ten minutes. Do not credit the twenty-minute review window, sleeping monitors, or old quarantine files as runner compute. Preserve the review window and all required contexts.

The strongest measurement defect is concrete: archive retirement excludes `.beep/yeet`, and economics enumerates live local files, not remote machines or retired archives. The fleet total is a censored workstation population, not aggregate verification use by all agent seats.

Read-only audit of live source on 2026-11-09, approximately 17:22–17:30 UTC. No proofs, commits, installs, hook writers, fleet SSH, or tracked edits ran. No other phase-2 seat's output was consulted. Source paths below are relative to `~/YeeBois/projects/beep-effect`; abbreviations: **Y** = `packages/tooling/tool/cli/src/commands/Yeet/internal`, **Q** = `packages/tooling/tool/cli/src/commands/Quality`, **C** = `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`, **R** = `packages/tooling/tool/cli/src/internal/repo-run`, **W** = `packages/tooling/tool/cli/src/commands/Worktree`.

## Measured this pass

| Command / read | Result and limits |
|---|---|
| `git status --short` | Clean at initial inspection. No checkout created. |
| `gh run list --workflow check.yml --event pull_request --limit 100 --json createdAt` | 100 runs: Nov 8 UTC 21, Nov 9 UTC 79. Oldest 2026-11-08T16:49:31Z, newest 2026-11-09T16:33:53Z. This is a capped burst sample, not two complete days. 100 / 23.7394 h = 101.1/day, or **707.7/week** if sustained; use only as sensitivity volume. |
| `bun run beep yeet economics --json` | 476 finished attempts, 46 journals; publish 188, verify 157, closeout 68, repair 35, monitor 28. Confirms the brief's single-checkout counts. |
| `bun run beep yeet economics --fleet --json` | 2,579 finished attempts in 329 journals, Aug 4 14:40:42 to Nov 9 17:03:12 UTC; publish 1,210, verify 724, repair 175, monitor 138. 2,591 starts, 16 without finish, one compaction receipt, one left-censored journal. This differs from phase 1's 2,596/331. No causal explanation is proven by the two snapshots. |
| Same economics, inner lanes | Fallow audit 185 executions: p50 14.517 s, p95 42.189 s; health 184: 7.298/26.267 s; dead-code 185: 6.812/12.871 s. Composite `ci:local:fallow` n=12: 104.579/125.188 s. These overlap and must not be added as independent costs. |
| Same economics, small gates | changeset-status n=173: 1.383/2.358 s, total 254.402 s; changeset-graph n=106: 1.826/2.765 s, total 208.251 s; commitlint n=98: 1.410/1.852 s. |
| Same economics, commit wrapper | Normal commit n=279: 2.874/9.026 s, total 1,018.776 s; amend n=33: 2.977/7.720 s. Mixed historical aggregate includes failed/early exits; **not** a measurement of current schema/instrumentation hooks separately. |
| Same economics, preflight | Publish phase n=411: 8.958/48.158 s, 409 pass/2 fail; prepare n=366: 7.407/17.125 s, 365/1. No first-red ranking inferred from handler failures. |
| `systemctl --user list-units 'beep-proof-*.service' --state=running --no-pager --plain` | Initial call lacked session-bus variables. Read retried with `XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus`: **4 running units, all mode=monitor**. Three name the same nested checkout; one another lane. Same checkout does not prove same PR/policy or redundant ownership. |
| `systemctl --user show 'beep-proof-*.service' -p ActiveState -p SubState -p CPUUsageNSec -p MemoryCurrent -p ActiveEnterTimestamp` | Four active units: CPU 246.141, 300.657, 403.297, 308.960 seconds since their respective starts (12:43–14:31 UTC); memory 220,839,936 + 263,151,616 + 264,187,904 + 229,552,128 bytes = **977,731,584 bytes**. Cumulative CPU **1,259.056 s**, not wall waiting. No controlled request trace collected. |
| `gh api rate_limit` reduced to core/graphql counters | Core 3,025 used / 5,000, 1,975 remaining; GraphQL 683 / 5,000 used. Shared credential snapshot; cannot attribute consumption to these monitors. |
| Read admission journal/quarantine with Python | 607 journal rows: 200 admitted, 202 enqueued, 201 released, 3 withdrawn, 1 evicted; retained kind-bearing rows only full-proof. Quarantine **2,068 files**, **2,326,889 content bytes**, 1,505 merged-preview and 563 full-proof. No seat/session field among journal keys. No deletion performed. |
| `du -sh ~/.cache/beep/head-install` | **0 allocated bytes** at inspection. This is current residue, not peak install I/O. |

No bounded Turbo task runs were needed: permitted single-package lint/check/test would not isolate hook writers, polling calls, or retention. Historical timing numbers are labelled as such rather than manufactured by running forbidden work.

### Ranking arithmetic

Use R=707.7 PR runs/week as the observed burst-rate scenario, with unknown eligibility q for non-skipped Repo Sanity. Fleet publish P=87.2/week and verify V=52.2/week derive from 1,210/724 over 97.10 days. Single checkout is only approximately 14.2 publish / 11.8 verify weekly over its ~93-day window. Do not multiply each lane's cost by all 2,579 attempts, and do not add single-checkout volume to fleet volume.

Score = (R × eligible hosted runner-minutes + P × publish wall-minutes + V × verify wall-minutes) / risk divisor, with low=1, medium=3, high=10. This is the requested prioritization heuristic, not a physical sum of CPU and wall. Critical path is reported separately. Unknown applicability stays explicit. Zero-credit observability/API levers follow positive candidates. No extrapolation claims a steady-state weekly forecast.

## Component map

| Component | Actual grain, implementation and recurrence | Cost / interpretation |
|---|---|---|
| Monitor/until-ready | Y/MonitorLoop.ts:196, 2529–2658: 30 s delay after polls; each poll reads remote Status. Status.ts:1174–1230 starts all checks, required checks, review threads and workflow list after PR lookup. Checks use `gh pr checks` twice (:707), not exclusively REST. Threads involve GraphQL with fail-closed fallback. | At most approximately 120 cycles/hour/service before request duration; four services ≈480/hour. If c REST calls/cycle, demand ≈480c/hour; 5,000/h exceeded at c>10.4 ignoring other consumers. This is a sensitivity model, **not measured c**. GraphQL has its own budget. |
| Review-window readers | Y/ReviewWindow.ts:51, 350–456 uses later of ready/open and first check-suite reception/force-push. Two REST reads, optional third for never-draft PR; lazy until other readiness criteria hold. GhOps.ts:99,400–426 uses fixed 20 min; readGateFacts :1297 reads PR, required contexts, checks, timeline, suites, threads. MergeGate.ts:1321 reads window and predicts squash commitlint. | Ready/new push re-arms. Force-push back to known SHA re-arms via timeline; ordinary push of already-seen SHA has documented first-reception caveat. Minimum merge time max(CI done, final-ready/head anchor+20 min, thread resolution), plus polling/read latency. Not an extra 20 min added after CI. GhOps fixed constant differs from ReviewWindow env override. |
| Lefthook | lefthook.yml: parallel hooks. Biome/docs use staged paths; typos receives no staged paths. Schema catalog splices staged files including delete/move sides; instrumentation harvests owning packages, and loads **all attribute declarations** (Observability.service.ts:235–267). Worker profile skips both writers. commit-msg invokes commitlint. | Schema ~0.6 GB is a source comment, not RSS measured here. Whole-repo typos historical ~10.8 CPU-s in inventory. Commit wrapper medians bound neither current large-package hook tail nor each subprocess individually. |
| Merged preview/parity | Y/MergedPreview.ts materializes synthetic merged tree in isolated worktree to catch clean textual merges that break semantics; ParityReuse.ts is a separate reuse path. Yeet.command.ts retains `--merged` and `--ci-parity`. R/QualityScheduler.schemas.ts:265 weight=5. | Zero retained grants means no measured current runtime cost, not dead code. Quarantine takes ~2.33 MB total. Deleting feature would remove distinct proof capability. |
| Head-install/git churn | Y/HeadInstallPreflight.ts:129 exact-commit receipt reuse; :181–240 detached checkout, install, finally remove/prune/temp removal. | Already deduped (#2631/#2767). Current cache 0 bytes; retained publish phase p50 0.149 min. No justified disk-cleanup saving. Repeated merge-base reads remain unmeasured. |
| Biome/nested lanes | biome.jsonc root=true, VCS ignore, `!.claude/worktrees`, no current reproduction collected. Source map records #2526 project scan removal. | Historical crawl hazard is a regression fixture candidate; cannot claim every nested lane still crawls primary clone. Preserve graph-aware lint semantics and package caching. |
| Attempt retention/retire | Y/AttemptJournal.ts delegates append to R/AttemptTerminationJournal.ts:37,254–352: newest 50 terminal attempts, protected/live attempt exceptions, compaction receipt. W/Worktree.service.ts:1004–1030 preserves selected `.beep` children; W/internal/ResidueReap.ts:1745–1787 explicitly says yeet=false. Y/Retire.ts:346–354 invokes archive=true removal. | Both archive retirement routes omit attempt journals under `.beep/yeet/runs`. Not all ignored `.beep` state is lost: Fallow and protected material are retained. Ledger discoverability and actual preservation are separate requirements. |
| Fleet hosts and seats | Y/Economics.ts:687–745 enumerates configured local real directories, same-origin matching, no symlink traversal; roots.json / BEEP_FLEET_ROOTS are filesystem roots. `docs/runbooks/fleet-roots-and-registry.md`. Compute-profile worker route defers proof/catalogs to hosted CI. | No remote collection in this path; beep-worker/dankserver/tbk-worker attempts are absent unless copied/mounted into discoverable local trees. Actual remote workload not sampled. Junie/Cursor/Codex/T3 identities cannot be recovered reliably from checkoutRoot+PID. No claim of measured remote cache contribution. |
| Fallow | Q/FallowQuality.command.ts:1143–1203: audit `--base --gate new-only`; dead-code full graph/zero-regression baseline; health full config complexity+file-scores/baseline, already omits costly history. C:1482–1555: three blocking + four advisory lanes, width 3, distinct envelopes; final-check runs cheap-gates and composite Fallow. turbo.json:5930 audit cache:false; health/dead-code cache:true. | Base-relative attribution ≠ file-scoped scan. Warm task caches may already remove repetitions. Audit base snapshot ~570–780 MB/root in runbook, reusable but not shared across roots; existing janitor and retire removal. Hosted phase-1 job 178–188 s includes seven lanes/setup/envelopes, **not three scans repeated three times**. |
| Changesets/commitlint | Q/ChangesetStatus.ts:438–483 diffs committed since...HEAD; private/lab exemptions. Q/internal/GithubChecks.ts:577 contains graph; C:1740–1744 runs graph explicitly then audit:github repo-sanity (graph again). MergeGate predicts actual squash message. | 431 undeclared-input misses is phase-1 ProofLedger count, not 431 expensive failures. Local p50 status=1.383 s; graph=1.826 s; commitlint=1.410 s. Hosted Commitlint 28–33 s from phase-1 runs, setup included. Keep both authored-message and squash-message semantics. |

## Ranked levers

### 1. L2-01 — Remove one duplicate changeset-graph invocation

- **Area/mechanism/grain:** L2; remove the explicit C:1742 invocation while preserving the Q/internal/GithubChecks.ts:577 graph in `audit:github repo-sanity`. Repo grain stays repo: release dependency consistency is cross-package. Do not remove changeset-status or squash commitlint.
- **Savings:** hosted runner 0.02–0.05 min per eligible PR run (central 0.0304); critical path 0 unless Repo Sanity is last, then same bound; publish 0; verify 0.02–0.05 min if composite Repo Sanity runs. CPU-seconds unknown. **Derived** from 1.826 s local graph p50; hosted duration not directly measured. Weekly central (21.5q +1.59)/1 minutes, q=eligible fraction; q=1 is an upper eligibility scenario.
- **Trust:** low; failure mode accidentally deleting the only graph execution from another entrypoint. Mitigate by plan-count assertions for standalone and composite entrypoints plus corrupt dependency-graph fixture that remains red.
- **Admission:** route replay + mutation fixture; paired logs show one identical verdict. No cached verdict or weakened required context.
- **Prior art/dependencies:** inventory lint-laws L10 names duplicate; no dependency on #3005/#3007/#3014; this is not their content. No general dedupe rejection is waived.
- **PR slice:** “Run changeset graph once in Repo Sanity”, C and its plan/graph fixtures, **S**. **Confidence:** high duplicate, medium savings. **Open:** hosted body duration, q.

### 2. L2-02 — Qualify within-attempt Fallow audit reuse before removing repeated execution

- **Area/mechanism/grain:** L2; Y/FinalCheck.ts, Q/internal/GithubChecks.ts, C and Q/FallowQuality.command.ts. Keep repo-grain audit/dead-code/health; carry one exact input/base/head audit computation to equivalent consumers inside one attempt, preserving fresh envelopes and all four advisory lanes. Do not blindly skip the composite Fallow lane. No new persistent result cache; Turbo remains the result-cache authority.
- **Savings:** hosted 0, PR critical path 0, publish 0, verify **0–0.24 min** per eligible duplicate (central scenario 0.12), final-check separately same conditional range. CPU-seconds unmeasured. **Derived ceiling / guessed realization**: audit p50 14.517 s; health/dead-code already cached and excluded from credit. Weekly central 52.2×0.12/3=2.09 risk-adjusted minutes; zero if no equivalent second audit is found. Not the whole 3-minute hosted job.
- **Trust:** medium; different base refs, dirty tree, config, tool version or overwrite of envelopes could reuse stale introduced-finding attribution. Pin all inputs, invalidate on mutation, fail closed, validate raw output and identity for every consumer.
- **Admission:** **parity ledger first** with base/head/dirty/config/deletion mutations and matched before/after A/B; any persistent reuse additionally requires cache qualification. This is a research/admission slice, not authorized immediate suppression.
- **Prior art/dependencies:** #2630/#2634 scope/cache/concurrency already shipped. Inventory rejects skipping duplicate cheap gates without task-level parity. New finding here narrows the candidate to uncached audit, but does not meet that rejection's reopening bar; the required new evidence is same-input double execution plus zero-divergence parity. Depends on that evidence, not in-flight partition PRs.
- **PR slices:** “Record duplicate Fallow identities and costs”, **S**; only after admission, “Share exact audit computation within a proof attempt”, **M**, files above. **Confidence:** medium mechanism, low realized savings. **Open:** fraction of verifies with duplicate matching audit; input-stability between stages.

### 3. L2-03 — Scope hook typos to staged files; retain catalog safety

- **Area/mechanism/grain:** L2; lefthook.yml typos accepts staged existing files with safe argv handling; full scan on typos configuration/ignore/dictionary changes. File grain is sound for ordinary spelling checks, with full hosted policy remaining authoritative. Keep schema splice and package instrumentation writer; do not remove them to save commit time.
- **Savings:** hosted 0, critical path 0, publish **0–0.05 min** when publish creates a matching commit (central 0.02); verify 0. Standalone commits also benefit but weekly count is unknown. Historical whole-scan CPU ceiling ~10.8 s/eligible commit; cannot translate CPU into wall. **Guess**, bounded by source shape and historical 2.874 s aggregate commit p50, not direct A/B. Weekly scenario 87.2×0.02/1=1.74 minutes; actual only qualifying commit-producing publishes.
- **Trust:** low; stale diagnostics for untouched files are still detected hosted, but changed spelling config or filenames/deletes can evade naive selection. Preserve policy full scan, config fallback, filename checks, spaces/newlines handling, ignore semantics. No caching of typos (rejected tracked-membership qualification remains binding).
- **Admission:** route replay + mutation fixture and A/B with controls on isolated staged fixtures. No actual commits in this audit.
- **Prior art/dependencies:** inventory L11 already proposes this; schema staged splice already landed, do not repropose. Instrumentation per-file splice would require all-declaration/owner joins demonstrated equivalent and is **not** credited here. #3014 typos hashing negation is independent.
- **PR slice:** “Check staged spelling in pre-commit”, lefthook.yml + hook fixture, **S**. **Confidence:** high unnecessary scope, low wall saving. **Open:** current typos wall versus catalog critical path; parallel hooks mean shaving typos may save zero commit wall.

### 4. L2-04 — Coalesce monitor observations and back off while only the window remains

- **Area/mechanism/grain:** L2; Y/MonitorLoop.ts/Status.ts/ProofJob launch path. Repo-scoped coordination keyed by repository, PR, policy and auth identity; reuse one observation per poll cycle. Do not conflate same-checkout jobs without inspecting targets. During a known window-only wait, next wake can be bounded by its deadline with a maximum notification lag, followed by a fresh full merge-gate read. No second compute admission authority, webhook ingress, or cached green used to merge.
- **Savings:** all four requested wall/runner metrics **0 credited**; potential extra notification delay must be reported. CPU/APIs are the primary benefit: replacing 30 s cadence with 120 s during stable waits reduces those cycles 75%, four always-stable monitors ~480→120 cycles/hour. Window reader alone saves 720–1,080 REST reads/hour in that extreme scenario (2–3 calls each); actual stable fraction unmeasured. **Derived** request model, not measured API trace. Cumulative resident CPU measured above; no causal CPU saving estimated. Weekly score 0, ranked on operational value only after positive wall candidates.
- **Trust:** medium; missed head/thread change or treating read failure as empty. Mitigate fresh terminal read, SHA pin, no merge on unknown, bounded red notification latency, multi-watcher reference/ownership handling.
- **Admission:** A/B measurement with controls plus mutation fixtures for push, force-push, new human thread, PR close, API failure, owner exit. Count REST and GraphQL separately per call site.
- **Prior art/dependencies:** lazy window reads already shipped (ReviewWindow.ts:456); Status reads already parallelized (W10). Do not propose those again. Webhook tunnel rejected. Depends on observations, not scheduler replacement.
- **PR slices:** “Attribute monitor API cycles”, **S**; “Coalesce identical watchers and deadline-aware polling”, **M**. **Confidence:** high load existence, medium avoidability. **Open:** targets of three same-checkout units; exact REST calls/page count; acceptable non-terminal notification lag (use existing cadence until tested).

### 5. L2-05 — Retain attempt evidence across retirement and label host/seat provenance

- **Area/mechanism/grain:** L2; R/AttemptTerminationJournal.ts, Y/AttemptJournal.ts/Economics.ts/Retire.ts, W/Worktree.service.ts and residue predicates. Repo-grain telemetry: export attempt journals with stable host+attempt identity into archive material before deleting lane; index archive journals in economics without copying all disposable job state. Preserve censoring markers. Add optional host and seat/provider fields at trusted launch boundaries; unknown remains unknown. Read-only imported remote summaries are distinct from local live attempts.
- **Savings:** hosted/critical path/publish/verify **0**, CPU 0 credited; likely small export/read overhead. **Measured defect**, not an efficiency outcome. Weekly score 0. Enables defensible ranking of other changes.
- **Trust:** low for proof, medium for telemetry; dedupe mistakes double counts or missing histories produce false ROI. Do not treat metadata as proof authority. Preserve original rows; namespaced host/attempt dedupe, migration compatibility and explicit live/archive/remote origin.
- **Admission:** parity ledger of census before and after archive retirement on fixtures; interruption/copy-failure/restore/duplicate-import cases; no loss before deleting source.
- **Prior art/dependencies:** inventory M-L8, scheduler L8; archive now preserves some ignored material, so blanket `.beep` fix is obsolete. Existing fleet roots registry is discovery, not a remote transport. Depends on instrumented launch boundaries for Junie/Cursor/Codex/T3, never process-name guessing. Existing QualityScheduler remains sole admission authority.
- **PR slices:** “Preserve and discover retired attempt journals”, **M**; “Stamp optional host/seat provenance and import read-only summaries”, **M**. **Confidence:** high local loss path, medium remote rollout. **Open:** retention horizon and archive byte budget can be chosen by owner with measured size; remote access not tested here.

### 6. L2-06 — Characterize changeset-status undeclared inputs before considering reuse

- **Area/mechanism/grain:** L2; Q/ChangesetStatus.ts and R proof input/ledger integration. Affected-set requirement calculation with repo workspace/release graph context; explicitly represent committed base/head, additions, workspace publish flags and configuration. Keep gate fresh until closure and qualification are proven.
- **Savings:** hosted 0, critical path 0, publish **0–0.023 min**, verify **0–0.023 min** on repeat unchanged inputs, but **0 admitted credit** today. CPU unknown. **Derived upper bound** from measured 1.383 s p50; 431 misses do not establish reusable executions. Optimistic weekly (87.2+52.2)×0.023/3=1.07 minutes before repeat fraction; current score 0.
- **Trust:** medium; reference name stays constant while merge-base moves, staged-only changes do not satisfy committed changesets, private/public graph transitions stale-green. Mitigate complete committed identities, config and graph inputs, fail-closed fallback.
- **Admission:** cache qualification + route replay/mutation fixture, not a switch based on miss count. Turbo remains the cache; no new memo.
- **Prior art/dependencies:** blanket cache tuning rejected; first-cold-lane rule and paused qualification scope apply. This is diagnostic, not reopening the entire cache certification program. No dependence on #3014 input-glob changes. Keep squash commitlint separate because GitHub's final message differs from individual commits.
- **PR slice:** “Explain changeset-status proof misses”, ledger diagnostic and fixture, **S**; optional qualified closure later **M**. **Confidence:** high low cost, low reusable fraction. **Open:** recompute actual miss count and input category distribution in a matched current cohort before investing.

## Rejected mechanisms considered

- **Shorten/disable review window:** no. Under-ten-minute required-green and twenty-minute merge readiness are separate objectives. Batch each fix wave into one push as existing doctrine requires; ten head events do not prove 200 additional minutes because windows overlap. Example fleet review ledger #3007 showed 10 heads / 4 rounds, but no counterfactual saving is claimed.
- **Remove merged-preview as dead weight:** no. Zero grants in a short retained journal proves no current sampled cost; source still provides a distinct semantic merged-tree proof. Quarantine is residue, not 1,505 running leases. Archive/compact quarantine only after status-scan time demonstrates benefit and with rollback; no wall credit now.
- **Skip frozen head install / reuse across arbitrary commits:** no. Exact-head reuse and cleanup already exist; current disk footprint is zero and cold p50 ~9 s is small. No new archive cache, no weakened lockfile validation.
- **Claim Biome nested-crawl savings without reproduction:** no. Root config excludes nested worktrees, #2526 already removed project scanning cost. A fixture demonstrating current out-of-root reads is the new evidence needed before reopening.
- **File-only dead-code or health scans:** no. Import graph reachability and baseline complexity are wider than edited files. New-only audit attribution is not a scan-scope guarantee.
- **Cache audit envelopes or delete advisory consumers:** no. Fresh report identity/raw-output validation survives any reuse, and the seven-lane job remains complete. No whole-lane suppression based on another lane's name.
- **Drop catalog hooks / substitute ts-morph flags:** no. Stale generated shards previously reached main, source already has schema splice; instrumentation imports all declarations. Per-file instrumentation needs full equivalence evidence, not a claimed ~0.6 GB saving.
- **Move proof to small hosts or another checker agent:** no. Worker compute profile intentionally routes to hosted; no remote capacity measurement, no purchases, no second scheduler. Agent attribution extends the existing scheduler/telemetry.
- **Remove commitlint:** no. Actual squash header/body must pass independently of individual commit messages. Its local ~1.4 s is not a ten-minute bottleneck.
- All 120 prior rejection rows were consulted by targeted and ledger reads. #3005/#3007/#3014 are treated as merged and not reproposed. Coverage floors, property floors, canonical census, required-context presence and every-main-commit hosted verdict remain unchanged.

## Contradictions with the inventory

1. **Monitor population:** four now, versus six in phase 1; snapshot variation, not evidence of remediation. Counting every check/thread request as core REST would be wrong: Status uses `gh pr checks` and GraphQL thread reading too.
2. **Fallow “only Fallow lanes are diff-scoped”:** too broad. Audit accepts base/new-only attribution; health/dead-code argv scans full configured content. The composite runs seven sublanes, not only the three promoted blockers.
3. **Retirement loss was only “likely”:** now source-confirmed for `.beep/yeet`; `yeet` is explicitly not retained. Conversely the old claim that all ignored `.beep` state disappears is false—selected material is preserved and digest-verified.
4. **Fleet 2,596 / 331:** current 2,579 / 329. Never present this change as increased efficiency. Retirement/discovery/ring censoring must be joined before comparing totals.
5. **Head-install footprint:** current zero, not an established storage problem. Reuse/cleanup already shipped.
6. **Review windows:** inventory description of default policy is sound, but GhOps' fixed constant and ReviewWindow's configurable duration are distinct implementations. At default they agree; overrides may not. Ordinary push of previously-received commits has an explicit timing caveat. Neither is solved by reducing polling.
7. **Hooks “per commit”:** conditional globs and worker skip narrow the population. Parallel execution means CPU saved need not reduce commit wall. Historical aggregate commit wrappers are not isolated current hook benchmarks.
8. **431 misses:** retained phase-1 statistic; measured gate body is only ~1.4 s. A miss count alone should not outrank multi-minute scans.

## Operator-only questions

**None block this report or the first evidence slices.** The operator has already resolved target statistics, scheduler ownership and in-flight dependencies. No capacity spending, trust-depth reduction or new service is proposed. Keep the twenty-minute policy. If a future proposal asks to reduce that assurance window or buy remote compute, it must return as an explicit policy/money decision with evidence; neither is needed for L2-01 through L2-06.

Open engineering questions (eligibility rate, duplicate Fallow identity, monitor API cost, hook critical path, remote census and archive retention sizing) belong to the owning implementation lane. This audit did not mutate services or retire any worktree to answer them.

```json
{
  "area": "L2 peripheral local and policy surfaces",
  "levers": [
    {
      "id": "L2-01",
      "title": "Remove duplicate changeset-graph",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.0304,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0.0304,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Deleting the only graph check on another entrypoint"
      },
      "admissionGate": "route replay + mutation fixture",
      "confidence": "medium"
    },
    {
      "id": "L2-02",
      "title": "Qualify within-attempt Fallow audit reuse",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0.12,
        "basis": "derived ceiling; guessed realization; zero until parity"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Reuse across changed base or inputs hides introduced findings"
      },
      "admissionGate": "parity ledger; cache qualification if persistent",
      "confidence": "low"
    },
    {
      "id": "L2-03",
      "title": "Scope hook typos to staged files",
      "grain": "file",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0.02,
        "localWallMinPerVerify": 0,
        "basis": "guess; conditional commit critical path"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Config or filename changes evade narrowed hook"
      },
      "admissionGate": "route replay + mutation fixture; A/B measurement with controls",
      "confidence": "low"
    },
    {
      "id": "L2-04",
      "title": "Coalesce monitors and deadline-aware polling",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived API model; no wall credit"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Stale PR or thread snapshot permits incorrect readiness"
      },
      "admissionGate": "A/B measurement with controls + mutation fixture",
      "confidence": "medium"
    },
    {
      "id": "L2-05",
      "title": "Retain attempts and host-seat provenance",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "measured defect; no direct savings"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Lost or duplicated evidence biases optimization decisions"
      },
      "admissionGate": "parity ledger across retirement and import",
      "confidence": "high"
    },
    {
      "id": "L2-06",
      "title": "Characterize changeset-status input misses",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived 0.023-minute upper bound; zero admitted credit"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Moving base or release graph gives stale green"
      },
      "admissionGate": "cache qualification + route replay + mutation fixture",
      "confidence": "low"
    }
  ]
}
```
