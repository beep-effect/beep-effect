# Prior-work ledger: merge queue, strict policy, main-red, merge authority

Compiled 2026-11-09 against `origin/main` at `b730601053f`, read-only (ripgrep and file reads; no `gh`,
no API, no `bun run`). Every figure is quoted from the cited file; nothing was re-measured. A figure
marked "not stated" has no number in its source.

Path shorthand: `ARCH:` = `.repos/goals-archive/` (local checkout of `beep-effect/beep-effect-goals-archive`,
HEAD `6187b83`, 2026-11-09). `SV` = `ARCH:goals/ship-velocity/`, `FC` = `ARCH:explorations/fleet-coordination/`,
`TTC` = `goals/time-to-certainty/`, `SL` = `goals/speed-loop/research/`, `SPA` = `explorations/stacked-pr-adoption/`,
`TMC` = `explorations/ten-minute-certainty/`, `CLE` = `goals/ci-lane-economics/research/OPPORTUNITIES.md`.

## 1. Chronological ledger

| Date | Source | Kind | Content |
| --- | --- | --- | --- |
| 2026-08-04 | `SL/OPPORTUNITIES.md:207-211` | finding | Ledger #22 "Evaluate GitHub merge queue": full gauntlet once per merge-group commit, PR checks trimmed to fast lanes, kills the base-refresh treadmill; pairs with deferred lane consolidation. |
| 2026-08-04 | `SL/OPPORTUNITIES.md:200-206`, `:236-243` | finding | #21 input-hash proof-carrying jobs; #25 prove-the-merged-object (`yeet predict-squash`), which subsumes #21. |
| 2026-08-04 | `SL/GRILL-DECISIONS.md:140-160` (decision 21) | deferral | #21 closed into #25; #22 "triggers on E-wave monitor data (treadmill tax quantified)". |
| 2026-08-04 | `FC/research/T4-merge-queue.md:47-60` | measurement | Ruleset 10240248 has 17 required checks "not ~24"; `strict_required_status_checks_policy: FALSE`. |
| 2026-08-04 | `FC/research/T4-merge-queue.md:79-103` | measurement | PR gauntlet p50 ~15, p90 ~19 min; main push 21-46 min; 253 merges in 30 d, 8.4/day mean, 26 peak. |
| 2026-08-04 | `FC/research/T4-merge-queue.md:276-304` | cost figure | Serial queue 18-40 merges/day; `max_entries_to_build = 5` gives 82-116/day; "not a bottleneck at 8.4/day". |
| 2026-08-04 | `FC/research/T4-merge-queue.md:515-540` | ruling (track) | `strict=true` rejected as 67 extra gauntlets/day mean, 208 peak (O ~8 open x M merges). |
| 2026-08-04 | `SL/GRILL-DECISIONS.md:245-252` (decision 34); `FC/research/AMENDMENTS-from-beep-effect3.md:10-14` | ruling | fleet-coordination owns the merge-queue design half: mechanism, cost, batch bisection. |
| 2026-08-04 | `FC/research/AMENDMENTS-from-beep-effect3.md:21-58` (A2, A3) | ruling | Verdict must not wait on the treadmill series; #56 scoped checks must enter the cost model. |
| 2026-08-04 | `SL/GRILL-DECISIONS.md:280-286` (decision 38); `SL/OPPORTUNITIES.md:577-600` (#56) | ruling | #56 sequences before any #22 adoption; evaluated as one composition; fleet names the flip condition. |
| 2026-08-04 | `FC/research/SYNTHESIS.md:46` (K7); `FC/RESEARCH.md:35` | measurement | Queue "DEAD at measured shape": 2 open PRs, median base drift 1 commit, main gauntlet 19% (39 success / 167 failure / 40 cancelled, 30 d). |
| 2026-08-04 | `FC/research/SYNTHESIS.md:381-384` | ruling (flip condition) | Never enable the queue before all three: #56 landed; main push pass rate >=80% over 14 d; >=5 concurrent open PRs. Fix `merge_group` commitlint/gitleaks first regardless. |
| 2026-08-04 | `FC/research/SYNTHESIS.md:437-446`; `explorations/fleet-coordination/DECISIONS.md:186-194` (Q6) | ruling | Neither strict nor queue now; correction: strict costs ~1 run per merged PR (~8/day), not the T4 herd. |
| 2026-08-05 | `SL/GRILL-DECISIONS.md:346-355` (decision 44); `SL/OPPORTUNITIES.md:684-690` (#62) | ruling | Under `merge_group`, commitlint degrades to one commit and gitleaks to `-1` (check.yml:599-609, :657-681 then); fix independent of adoption; strict re-opened as #22-adjacent, gated behind a green gauntlet. |
| 2026-08-05 | `explorations/fleet-coordination/BRIEF.md:159-161`; `ARCH:goals/fleet-mirror/SPEC.md:38-40` | no-go | No queue, no strict until the flip condition; binding term 19% (39/206). |
| 2026-08-13 | `CLE:30-38` | measurement | Live ruleset returns 16 required contexts (JSDoc Ratchet absent); repo descriptor froze 17. |
| 2026-08-13 | `SV/research/c6-conflicts-queue.md:154-175`, `:184` | cost figure | Not queue-ready (9 `event_name` branches); 16 contexts; 39.1 fleet job-min per suite; fleet cap 14 one-job VMs; batch-2 pilot last in wave 1. |
| 2026-08-13 | `SV/research/g1-external-research.md:371-378` | finding | Do not enable yet; if later, batch+bisect not GitHub serial; revisit after local=CI, warm cache, no derived conflicts, >~15 PRs/day plus two-step CI. |
| 2026-08-13 | `SV/research/g2-design-ideas.md:35`, `:629-644` | finding | "Not the answer. Not yet"; flip `strict` before adopting a queue. |
| 2026-08-13 | `SV/SPEC.md:307-311` (E8) | ruling (spec) | Not now: no `merge_group`, context drift 16-vs-17, ~39 EC2 job-min/suite, flip condition at 19%; flip strict first; revisit batch-2 only against the flip condition. |
| 2026-08-24 | `goals/lexical-playground-capability-atlas/research/OPPORTUNITIES.md:6-27` | finding | `goals/INDEX.md` treadmill: 2.5 h to land a docs-only PR; option (a) a merge queue. |
| 2026-08-27 | `SV/research/merge-queue-evaluation.md:9-21`, `:34-38`, `:56-62` | measurement + ruling | E8: 104/159 = 65.4% non-cancelled; 17 contexts, strict false, no `merge_group`. Keep off; prove `merge_group` for all 17, flip strict first, then a small batch. |
| 2026-08-27 | `standards/architecture/DECISIONS.md:1741-1760` | ruling (Active) | "Merge Queue Stays Off Until the Recorded Reliability Gate": same gate, same order. |
| 2026-08-30 | `goals/packet-convention-migration/research/OPPORTUNITIES.md:614-630` | finding | PR #900 merged at 4/5 Greptile with an open thread; asks a queue to require 5/5 and zero threads. |
| 2026-09-02 | `SV/PLAN.md:144-147`; `SV/ops/manifest.json:6` | closure | E8 struck through; ship-velocity `completed-retained`. |
| 2026-09-03 | `CLE:874-882`; `TTC/research/baseline.md:18` | measurement | 18 required contexts; M4 false-red proxy "unmeasurable", 0 fingerprinted attempts. |
| 2026-09-10 | `TTC/research/OPPORTUNITIES.md:1100-1109` | finding | #1082 green but broken after main moved; asks for up-to-date rule or queue. |
| 2026-09-12 | `CLE:932-941`, `:1104` | measurement | 17 contexts; Coverage Regression left the required set 09-12. |
| 2026-09-16 | `TTC/research/decisions.md:511-527` (ruling 44) | measurement | Ruleset lists 17 contexts, `gh pr checks --required` lists 16. |
| 2026-09-16 | `TTC/research/decisions.md:528-532` (ruling 45) | rejected | Treat unreported as failed ("merge-queue semantics, but it lies"). |
| 2026-09-16 | `TTC/research/decisions.md:641-646` (ruling 56) | ruling | B9 captured not scheduled: needs `merge_group` on every required workflow, flake budget, merge-group tail in `--until-ready`, `/explore` grill; never a global `concurrency` group. |
| 2026-09-16 | `TTC/research/decisions.md:648-651` (ruling 57) | ruling | Throughput = heavy duration x queue depth; pool size is the operator's lever. |
| 2026-09-16 | `TTC/research/b8-brief.md:198-202`, `:212-220`; `b8-implementation.md:82`, `:292-311` | probe | `merge_group` -> verdict `run`, source `merge-group`; PR C #1164 probe failed then passed after #1165. |
| 2026-09-16 | `TTC/research/b7-research.md:75-77` | finding | GitHub queue waits for required checks on the group; after the status-check timeout unreported checks count as failed. |
| 2026-09-16 | `explorations/github-merge-queue/CAPTURE.md` | capture | This packet; "red a third of the time" (`:52-53`) rests on 65.4%. |
| 2026-09-25 | `CLE:1076-1093` | measurement | Ruleset version 50918272 removed `Heavy / Lint Policy`: 16 contexts; nobody recorded it. |
| 2026-09-26 | `TTC/research/OPPORTUNITIES.md:2597-2612` | obligation | Heavy queue 19-173 min on two runners; record `created_at -> started_at` per Heavy job "before the B9 merge-queue capture is judged". |
| 2026-09-28 | `TTC/research/decisions.md:1172-1199`; `TTC/PLAN.md:93-98`; `TTC/GOAL.md:33-34`, `:47-48` | closure | B9 closes in TTC as captured; grill stays behind E8 and moves with this exploration. |
| 2026-09-28 | `TTC/research/economics-close.md:147-151`, `:232-234`, `:244` | measurement | M4 measured: 16 failed-unchanged-fingerprint-then-green over 1,060 fingerprinted attempts. |
| 2026-10-01 | `explorations/beep-ci-operational-ontology/BRIEF.md:260`, `MAP.md:226` | no-go | "No merge queue (ship-velocity E8 stays the flip condition)". |
| 2026-10-05 | `SPA/RESEARCH.md:128-131`, `:348-352` | measurement | E8 gate reads 22.5% (32/142); queue free for a public org repo; #62 vacuous gates still open. |
| 2026-10-06 | `SPA/RESEARCH.md:15-20`, `:55-56`; `AGENTS.md:303-310` | finding / ruling | Native stacks GA, a stack enters the queue as one merge group; ruleset gained a bypass actor 10-06T17:22Z; 20-min review window (#1483). |
| 2026-10-09 | `AGENTS.md:311-315` | ruling | S11: finals may merge over failing required jobs (standing since 10-13, same-day fix duty). |
| 2026-10-13 | `SPA/RESEARCH.md:41-63` | measurement | 23.2% whole-run, 63.4% all-required-green, required-red 54.7% of wall-clock; 30/36 post-S11 merges bypassed required checks. |
| 2026-10-13 | `SPA/DECISIONS.md:66-89` (main-red-definition) | ruling | Main red = any of 16 required contexts red on the newest commit with a result; restating E8 "is left to the github-merge-queue exploration". |
| 2026-10-13 | `SPA/DECISIONS.md:15-40`, `:42-64`, `:91-127`, `:233-236`, `:290-330` | ruling / deferral | s11-standing; non-required lanes handed to ci-lane-economics; one unblocker per episode; `merge-async merge_action=merge_queue` deferred; stacks-reopen and hold triggers cite the queue bar. |
| 2026-10-14 | `CLE:1095-1114` | input | Two non-required Heavy lanes take 63% of PR Heavy minutes; "the E8 merge-queue gate reads 23.2% ... 63.4%". |
| 2026-10-14..27 | `CLE:1150-1166` | measurement | Knip out 10-14, `beep-reviewer` in 10-14 out 10-27, `Heavy / Effect Diagnostics` in 10-15 out 10-27; Actions listing caps at 1,000 runs (1,202 in one week). |
| 2026-10-27 | `SV/research/branch-protection-contexts.json:3-26` | measurement | Snapshot: 15 required contexts, strict false (overwrote the 17-context file E8 cites at `:34-38`). |
| 2026-10-28 | `explorations/verification-route/BRIEF.md:36-39`; `goals/verification-route/SPEC.md:28-30`; `goals/verification-route/ops/manifest.json:131` | scope exclusion | Queue (B9/E8) out of scope; delivered per-lane hosted `skip-satisfied` in check.yml/heavy-admit.yml/heavy.yml. |
| 2026-11-05 | `AGENTS.md:203-210`; `goals/agent-pool-doctrine/history/2026-11-05-base-conflict-merge-main.md:11-30` | ruling | Three merges in 41 s left 11 siblings `CONFLICTING` for >43 h; gate merges finals one at a time, siblings merge main between; at most 3 open PRs per packet. |
| 2026-11-09 | `TMC/DECISIONS.md:183-196` (D7), `:246-258` (D2), `:157-165` (D9) | ruling / measurement | 13% of main commits get a verdict; 27 of 60 main runs cancelled by hand; per-SHA groups cost 20-36k runner-min/day; full replay stays per PR (no merge-group replay). |
| 2026-11-09 | `TMC/research/phase2/merged/hosted-ci.md:5`, `:15`, `:144-160` | measurement | Heavy p95 84 min at cap 2; 59 concurrent hosted jobs vs a 60 default; 54-100 main commits/day; ~360 runner-min per full main run. |
| 2026-11-09 | `TMC/BRIEF.md:92-93`; `TMC/MAP.md:131`; `TMC/research/phase1/levers-compact.md:111`, `:117` | deferral | Queue and stacks wait on "80% main required-green over 14 days"; L12 smoke-per-PR depends on a queue. |
| 2026-11-09 | `explorations/github-api-quota/DECISIONS.md:124-138`; `goals/github-state-worker/SPEC.md:32`, `:203`; `goals/yeet-monitor-app-identity/SPEC.md:51-52`; `goals/github-budget-ledger/SPEC.md:43-44` | deferral | Replacing merge-gate with the native queue "stays in explorations/github-merge-queue"; absorbing it rejected as scope creep. |

## 2. Measurements

| Date | Window | Basis | Num / den | Value | Required contexts then | Source |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-04 | 30 d to 08-04 | whole-run, `check.yml` main push, non-cancelled | 39 / 206 (40 cancelled excluded) | 19% | 17 | `FC/research/SYNTHESIS.md:46`, `:536` |
| 2026-08-27 | 08-13..08-27 (14 d) | whole-run, non-cancelled terminal | 104 / 159 | 65.4% | 17 | `SV/research/merge-queue-evaluation.md:10-17` |
| 2026-08-27 | same | whole-run, all completed | 104 / 184 | 56.5% | 17 | same `:17` |
| 2026-10-05 | not stated ("today's window") | stated as the E8 basis | 32 / 142 | 22.5% | 16 | `SPA/RESEARCH.md:128-131` |
| 2026-10-13 | 09-29..10-13 | whole-run, non-cancelled | 26 / 112 | 23.2% | 16 | `SPA/RESEARCH.md:43` |
| 2026-10-13 | 10-06..10-13 | whole-run, non-cancelled | 6 / 50 | 12.0% | 16 | `SPA/RESEARCH.md:43-44` |
| 2026-10-13 | 09-29..10-13 | required-contexts, per run (all 16 green) | 71 / 112 | 63.4% | 16 | `SPA/RESEARCH.md:45` |
| 2026-10-13 | 09-29..10-13 | required-contexts, wall-clock red share | not stated | 54.7% red; 41.3% excluding an 81.4 h gap | 16 | `SPA/RESEARCH.md:46-47` |
| 2026-11-09 | "60 recent main runs" | verdict rate (any terminal verdict) | 11 / 60 (49 cancelled) | not stated as % | 15 (10-27 snapshot) | `TMC/research/phase2/merged/hosted-ci.md:155` |
| 2026-11-09 | 58 main runs (other seat) | verdict outcome | 3 green, 7 red of 58 | not stated as % | 15 | `TMC/research/phase2/merged/hosted-ci.md:5` |
| 2026-11-09 | not stated | main commits with a completed verdict | not stated | 13% | 15 | `TMC/DECISIONS.md:185` |
| 2026-11-09 | 2026-11-09 only | main runs cancelled | 12 / 15 | not stated as % | 15 | `TMC/DECISIONS.md:256` |
| 2026-09-03 | 08-04..09-03 | M4 false-red proxy (local journals) | 0 fingerprinted attempts | unmeasurable | 18 | `TTC/research/baseline.md:18` |
| 2026-09-28 | 08-04..09-28 | M4: red then green on same `diffFingerprint` | 16 over 1,060 fingerprinted attempts | measured | 16-17 | `TTC/research/economics-close.md:147-151`, `:233-234`, `:244` |

M4 is a local attempt-journal proxy (ruling 75 method), not a hosted or merge-group false-red rate; no
source measures hosted flake rate per required context. No measurement on either basis exists after
2026-10-13; `TMC/research/phase1/rejected-questions-gaps.md:226` asks the same question.

## 3. Cost-model figures on record

| Figure | Value | Date | Source |
| --- | --- | --- | --- |
| Merges per day | 8.4 mean, ~11 median, 26 peak (253 in 30 d) | 2026-08-04 | `FC/research/T4-merge-queue.md:98-103` |
| Merges per day (strict cost basis) | ~8/day | 2026-08-04 | `FC/research/SYNTHESIS.md:441` |
| Main first-parent commits per day | 54 (11-05), 100 (11-06), 83 (11-07), 56 (11-08) | 2026-11-09 | `TMC/research/phase2/merged/hosted-ci.md:155` |
| Check push runs per day | 93 (11-07), 66 (11-08) | 2026-11-09 | same `:155` |
| Concurrent open PRs | 2 (Little's law 1.8-3.0); T4 assumed O ~8 | 2026-08-04 | `FC/research/SYNTHESIS.md:46`; `T4-merge-queue.md:519-522` |
| Siblings open on two packets at once | 11 | 2026-11-04 | `goals/agent-pool-doctrine/history/2026-11-05-base-conflict-merge-main.md:11-15` |
| Heavy cost per suite | ~39 EC2 job-min (39.1 p50 sum of 5 lanes); coverage p95 29.5 min | 2026-08-13 | `SV/SPEC.md:308`; `SV/research/c6-conflicts-queue.md:164` |
| Runner-min per full main run | 257-384 (five runs), ~360 typical; 62 jobs, 12 Heavy | 2026-11-09 | `TMC/research/phase2/merged/hosted-ci.md:155` |
| Main per day today | ~4,600 hosted + ~1,600 heavy for ~5 verdicts; 38% burned by cancels | 2026-11-09 | same `:148` |
| Per-SHA main verdicts | ~9,000 hosted + ~660 heavy (lever) vs 20-36k runner-min/day (skeptic, adopted by D7) | 2026-11-09 | same `:148`, `:155`; `TMC/DECISIONS.md:192-193` |
| PR Heavy runner-min | 31,347 (09-29..10-13), 19,838 in two non-required lanes | 2026-10-13 | `SPA/RESEARCH.md:60-64` |
| Durations | PR p50 ~15 / p90 ~19; push 21-46 min; push vs PR p50 18.8 vs 15.6 | 2026-08-04 | `FC/research/T4-merge-queue.md:90`; `SYNTHESIS.md:541` |
| Durations | push to every required green, code heads: p50 48.5, p95 124.5 min | 2026-11-09 | `TMC/BRIEF.md:9-10` |
| Heavy capacity | cap 14 one-job VMs | 2026-08-13 | `SV/research/c6-conflicts-queue.md:164` |
| Heavy capacity | two standing `beep-ec2-heavy` runners (burst to six) | 2026-09-26 | `TTC/research/OPPORTUNITIES.md:2600-2604` |
| Heavy capacity | cap 2 | 2026-11-09 | `TMC/DECISIONS.md:134-144` |
| Heavy queue wait | 19-34, 150-173, 52-61, 21-33 min (four runs) | 2026-09-26 | `TTC/research/OPPORTUNITIES.md:2598-2604` |
| Heavy queue wait | p90 60-68 min, red or green main | 2026-10-13 | `SPA/RESEARCH.md:69` |
| Heavy queue wait | p75 36, p90 51, p95 84 min | 2026-11-09 | `TMC/research/phase2/merged/hosted-ci.md:5` |
| Hosted job ceiling | 60 (documented Team default, unverified); 59 measured concurrent | 2026-11-09 | same `:5`, `:15`; `TMC/BRIEF.md:93` |
| Queue throughput model | serial 18-40/day; build concurrency 5 at p=0.06 ~116/day, p=0.17 ~82/day | 2026-08-04 | `FC/research/T4-merge-queue.md:279-304` |
| Strict cost | 67/day mean, 208 peak (T4) vs ~1 extra run per merged PR | 2026-08-04/05 | `T4-merge-queue.md:519-523`; `SL/GRILL-DECISIONS.md:351-353` |
| Stack test | ~3 Heavy matrices, ~160 runner-min | 2026-10-13 | `SPA/DECISIONS.md:354` |
| Graphite MQ price | $18/user/month Team (T4) vs $40/user/month Team (g1) | 2026-08-04 / 08-13 | `T4-merge-queue.md:395`; `SV/research/g1-external-research.md:72` |

Disagreements: merges/day moved from 8.4 to 54-100, so every T4 throughput and strict-cost number is
on an obsolete input. Per-SHA cost differs 2-4x between the lever and its skeptic (D7 adopted the higher).
Heavy capacity fell from 14 VMs to cap 2 (ruling 57 makes that the operator's lever). The two Graphite prices
conflict. No source gives runner-minutes per merge-group run, merge-group build concurrency for this repo, or
a measured queue wait on a merge group.

## 4. Obligations other packets place on this one

| Who | What | Where |
| --- | --- | --- |
| stacked-pr-adoption | Restate the E8 bar on the required-contexts basis; this packet "owns that gate" | `SPA/DECISIONS.md:83-89` |
| time-to-certainty | `merge_group` on every required workflow, a flake budget, a merge-group tail in `--until-ready`, an `/explore` grill; no global `concurrency` group | `TTC/research/decisions.md:641-646` |
| time-to-certainty | Grill and implementation move with this exploration, not TTC | `TTC/PLAN.md:93-98`; `TTC/research/decisions.md:1196-1199` |
| time-to-certainty | Record Heavy queue time (`created_at -> started_at`) before B9 is judged | `TTC/research/OPPORTUNITIES.md:2608-2612` |
| E8 / architecture decision | Prove `merge_group` parity for all required contexts, evaluate the strict flip first, then a small batch | `SV/research/merge-queue-evaluation.md:58-62`; `standards/architecture/DECISIONS.md:1747-1751` |
| speed-loop #62 / fleet | Fix commitlint depth and gitleaks base-pinned config under `merge_group` before any ruleset flip | `SL/OPPORTUNITIES.md:684-690`; `FC/research/SYNTHESIS.md:383-384` |
| speed-loop decision 38 | Evaluate the queue only as a composition with #56 scoped PR checks | `SL/GRILL-DECISIONS.md:280-286` |
| fleet amendment A3 / decision 38 | The flip condition was owed as a testable predicate on a monitor-emitted treadmill-tax metric | `FC/research/AMENDMENTS-from-beep-effect3.md:134-141` |
| ship-velocity C6 | Measure queue wait, groups rebuilt, fleet job-min per merged PR, PR-head suites avoided; raise batch only if cost per merged PR falls | `SV/research/c6-conflicts-queue.md:172` |
| github-api-quota and its three goals | Own the gate-semantics decision (`merge_group` triggers, admission verdict, meaning of `--until-ready`) if merge-gate is ever replaced | `explorations/github-api-quota/DECISIONS.md:130-137`; `goals/github-state-worker/SPEC.md:32` |
| stacked-pr-adoption | `merge-async merge_action=merge_queue` routing waits on the E8 bar | `SPA/DECISIONS.md:233-236` |
| ten-minute-certainty | L6 and L12 (smoke integration per PR, full replay in the merge group) depend on this packet | `TMC/research/phase1/levers-compact.md:111`, `:117`; `TMC/DECISIONS.md:157-165` |
| packet-convention-migration | A queue must still require Greptile 5/5 and zero unresolved threads | `goals/packet-convention-migration/research/OPPORTUNITIES.md:627-630` |

## 5. Options rejected or deferred

| Option | Status and reason | Source | Depends on a changed number? |
| --- | --- | --- | --- |
| Enable the native queue now | Deferred: below 80%; no `merge_group` triggers; CI paid twice | E8 `:56-62`; `standards/architecture/DECISIONS.md:1741-1760` | Yes: 65.4% was the last E8-basis reading; later readings are 22.5%, 23.2%, 63.4% on two different bases |
| Enable now (fleet K7) | Dead: 2 open PRs give single-entry groups; drift 1 commit | `FC/research/SYNTHESIS.md:46` | Yes: 8.4 merges/day became 54-100 commits/day; open-PR count not re-measured |
| `strict_required_status_checks_policy: true` | T4: rejected at 67-208/day; fleet: ~8/day, gated on green; E8: flip strict first | `T4-merge-queue.md:515-540`; `SYNTHESIS.md:437-446`; E8 `:60-62` | Yes: "~8/day" assumes 8.4 merges/day |
| Auto-rebase bot | Rejected: O x M herd, does not converge | `T4-merge-queue.md:515-540` | Yes: O and M both moved |
| Global `concurrency` group as a queue | Rejected: one pending slot, no FIFO | `TTC/research/b8-brief.md:219`; ruling 56 | No |
| GitHub serial queue (batch 1) | Rejected for agent bursts; use batch+bisect if ever | `SV/research/g1-external-research.md:371-378` | Yes: burst size is a merges/day function |
| Graphite / Mergify / Aviator / Trunk | Deferred with the queue; Graphite incompatible with GitHub MQ and paid (money escalation) | `FC/research/SOURCES.md:55`; g1 `:72`, `:412` | No (price conflict, see section 3) |
| Batch-2 pilot | Last item of C6 wave 1, after context drift and cancellation are fixed | `SV/research/c6-conflicts-queue.md:175`, `:184` | Context count changed 16 -> 15 |
| Native stacks now; `merge-async merge_action=merge_queue` | Deferred behind stacks-reopen-gate (80% required-green 14 d + 3 chains/week) and no-force-push | `SPA/DECISIONS.md:129-166`, `:233-236`, `:290-309` | Yes, same gate |
| Automated main-red Heavy hold | Deferred: under S11 held PRs merge anyway | `SPA/DECISIONS.md:91-127`, `:311-330` | S11 still standing (`AGENTS.md:311-315`) |
| Per-SHA main groups now | Rabbit hole until a throughput layout lands | `TMC/BRIEF.md:91`; `TMC/DECISIONS.md:183-196` | New figure (20-36k/day) |
| Smoke integration per PR, full replay in merge group | Rejected for now: 13% main verdict rate | `TMC/DECISIONS.md:157-165` | Yes: revisit at >=95% verdicts |
| Treat unreported checks as failed in settle | Rejected ("merge-queue semantics, but it lies") | `TTC/research/decisions.md:528-532` | No |
| Absorb the queue into github-api-quota | Rejected: scope creep into gate semantics | `explorations/github-api-quota/DECISIONS.md:136-138` | No |
| Workflow `paths:` filters; gating the caller job | Rejected: required checks stay "Expected" | `TTC/research/b8-brief.md:212-221` | No |

## 6. Contradictions and drift

1. **Gate basis.** E8 and the architecture decision measure whole-run success of non-cancelled `check.yml`
   push runs ("full gauntlet"). stacked-pr-adoption redefines main red per required context on the newest
   commit (`SPA/DECISIONS.md:72-74`), and its stacks-reopen-gate says "80% of the time" (`:295`), which reads
   as wall-clock; its own figures are per run (63.4%) and wall-clock (54.7% red). ten-minute-certainty writes
   "required-green" (`TMC/BRIEF.md:92`, `levers-compact.md:111`) and calls it the E8 condition. This packet's
   README and CAPTURE still say "full-gauntlet". Three bases, one gate, no ratified restatement.
2. **Flip-condition legs.** Fleet's condition had three legs plus the #62 prerequisite
   (`FC/research/SYNTHESIS.md:381-384`) and was meant to be a predicate on the treadmill-tax series
   (`AMENDMENTS-from-beep-effect3.md:136-141`). ship-velocity E8 kept only the 80% leg; TTC, the README and
   CAPTURE cite only E8. The #56 leg is plausibly met by verification-route's per-lane `skip-satisfied`
   (`goals/verification-route/ops/manifest.json:131`), but no source says so.
3. **Window and sample.** The 19% figure is a 30-day window against a 14-day gate. E8's denominator
   excludes cancelled runs, yet by 2026-11-09 most main runs are cancelled (per-ref group plus hand cancels
   licensed by `AGENTS.md:198-202`), so the non-cancelled set is about 10 of 60 runs and self-selected
   (`TMC/research/phase2/merged/hosted-ci.md:155`). E8's `gh api --paginate` query hits the 1,000-run
   listing cap on a busy window (`CLE:1150-1166`). For 68.4 h (10-06..10-09) one runnerless main run held
   the per-ref group and main produced no verdict at all (`SPA/RESEARCH.md:51-53`).
4. **Required-context count.** ~24 (speed-loop brief) / 17 (T4, 08-04) / 16 (CLE and C6, 08-13) / 17 (E8,
   08-27) / 18 (09-03) / 17 (09-12) / 17 vs 16 (`gh pr checks`, 09-16) / 16 (09-25 to 10-13) / 15 (10-27
   snapshot). The archive file E8 cites as the frozen 17-context result now holds a 2026-10-27, 15-context
   capture (`SV/research/branch-protection-contexts.json:3`), so E8 `:34-38` no longer matches its own
   evidence file.
5. **Owner of the design.** speed-loop decision 34 gave the design half to fleet-coordination; fleet
   delivered only a no-go and graduated to `goals/fleet-mirror` (`completed-retained`). TTC ruling 56,
   stacked-pr, github-api-quota and three active goals name this packet. No record transfers ownership.
6. **What "merge_group handled" means.** E8 says no workflow handles `merge_group`; stacked-pr says
   "Workflows already list `merge-group` as an admission source" (`SPA/RESEARCH.md:348-349`), which is
   repo-cli code (`HeavyAdmission.ts`), not a workflow trigger. `.github/workflows/` has no `merge_group`
   today (ripgrep, 2026-11-09). #62's line cites (`check.yml:599-609`, `:657-681`) are 2026-08 offsets.
7. **S11 and a queue.** S11 lets finals merge over required reds, and 30 of 36 merges did
   (`SPA/RESEARCH.md:54-59`). A queue merges only on green merge groups. No source reconciles the two.
8. **CAPTURE premises.** "Red a third of the time" (`CAPTURE.md:52-53`) assumes 65.4%; the capture names
   ruling 57's pool but not cap 2, the 60-job hosted ceiling, or the 11-05 one-at-a-time rule, which is
   already a hand-run serial queue.

## 7. Rows for `research/SOURCES.md` (in-repo table)

| Brick or source | Path | Disposition |
| --- | --- | --- |
| E8 evaluation (65.4%, 17 contexts, decision order) | `ARCH:goals/ship-velocity/research/merge-queue-evaluation.md:9-62` | reuse (method), restate basis |
| Ruleset context snapshot (15 contexts, 2026-10-27) | `ARCH:goals/ship-velocity/research/branch-protection-contexts.json` | reference; note overwrite |
| Ship-velocity E8 spec line (19%, 39 job-min, strict first) | `ARCH:goals/ship-velocity/SPEC.md:307-311` | reference |
| C6 queue design and cost (39.1 job-min, batch-2 pilot, metrics) | `ARCH:goals/ship-velocity/research/c6-conflicts-queue.md:154-187` | reuse (metrics list) |
| g1 external research (batch+bisect, burst warnings) | `ARCH:goals/ship-velocity/research/g1-external-research.md:14-80`, `:371-378` | reference |
| Architecture decision "Merge Queue Stays Off" | `standards/architecture/DECISIONS.md:1741-1760` | supersede or amend when the gate is restated |
| T4 merge-queue track (throughput model, strict herd) | `ARCH:explorations/fleet-coordination/research/T4-merge-queue.md` | reference; inputs obsolete |
| Fleet synthesis flip condition (three legs) and Q6 | `ARCH:explorations/fleet-coordination/research/SYNTHESIS.md:46`, `:381-384`, `:437-446` | reconcile |
| Fleet amendments A1-A3 (design ownership, #56 composition) | `ARCH:explorations/fleet-coordination/research/AMENDMENTS-from-beep-effect3.md:10-58`, `:128-141` | inherit obligation |
| Speed-loop ledger #21, #22, #25, #56, #62 | `goals/speed-loop/research/OPPORTUNITIES.md:200-243`, `:577-600`, `:684-690` | reference; #62 reuse |
| Speed-loop decisions 21, 34, 38, 44 | `goals/speed-loop/research/GRILL-DECISIONS.md:140-160`, `:245-252`, `:280-286`, `:346-355` | reference |
| TTC rulings 44, 45, 56, 57 and round 25 | `goals/time-to-certainty/research/decisions.md:511-532`, `:641-651`, `:1172-1199` | reuse (constraints) |
| TTC M4 close values | `goals/time-to-certainty/research/economics-close.md:147-151`, `:232-244` | reuse (flake budget input) |
| TTC heavy queue-time obligation | `goals/time-to-certainty/research/OPPORTUNITIES.md:2597-2612` | reuse (measurement owed) |
| Stacked-PR main-red definition, S11, gates, deferrals | `explorations/stacked-pr-adoption/DECISIONS.md:15-127`, `:233-236`, `:290-330` | reuse (basis) |
| Stacked-PR 2026-10-13 measurements | `explorations/stacked-pr-adoption/RESEARCH.md:41-63`, `:128-131` | reuse (method) |
| Ruleset history and listing cap | `goals/ci-lane-economics/research/OPPORTUNITIES.md:30-38`, `:874-941`, `:1076-1166` | reuse (census discipline) |
| Ten-minute D7 main verdicts, D9 replay, D11 heavy cap | `explorations/ten-minute-certainty/DECISIONS.md:134-196` | reference |
| Ten-minute hosted-ci HOST-01 cost and ceiling | `explorations/ten-minute-certainty/research/phase2/merged/hosted-ci.md:5`, `:15`, `:144-160` | reuse (cost inputs) |
| Verification-route per-lane `skip-satisfied` (#56 leg) | `goals/verification-route/ops/manifest.json:131`; `goals/verification-route/SPEC.md:28-30` | reuse |
| Merge-authority law: S11, review window, one-at-a-time | `AGENTS.md:198-210`, `:303-315`; `goals/agent-pool-doctrine/history/2026-11-05-base-conflict-merge-main.md` | constraint |
| Deferrals into this packet | `explorations/github-api-quota/DECISIONS.md:124-138`; `goals/github-state-worker/SPEC.md:32`, `:203`; `goals/yeet-monitor-app-identity/SPEC.md:51-52`; `goals/github-budget-ledger/SPEC.md:43-44` | inbound obligation |

## 8. Status of cited packets (as of 2026-11-09)

| Packet | Kind | Status / stage | Source |
| --- | --- | --- | --- |
| `explorations/github-merge-queue` | exploration | `active` / `capture`, created and updated 2026-09-16 | `ops/manifest.json:6-18` |
| `goals/ship-velocity` | goal | `completed-retained` (closed 2026-09-02), archived 2026-11-09, tombstone on main | `goals/ship-velocity/README.md`; `SV/ops/manifest.json:6` |
| `goals/time-to-certainty` | goal | `paused` since 2026-09-28 (ruling 80 resume condition) | `goals/time-to-certainty/ops/manifest.json:6`, `:13` |
| `goals/speed-loop` | goal | `completed-retained`, updated 2026-08-08 | `goals/speed-loop/ops/manifest.json:6-8` |
| `explorations/fleet-coordination` | exploration | `graduated` / `graduate` -> `goals/fleet-mirror` (`completed-retained`); archived 2026-11-09 | `explorations/fleet-coordination/ops/manifest.json:6-23` |
| `explorations/stacked-pr-adoption` | exploration | `parked` / `align`, updated 2026-10-13 | `ops/manifest.json:6-16` |
| `explorations/ten-minute-certainty` | exploration | `active` / `decompose`, updated 2026-11-09, no goals yet | `ops/manifest.json:6-24` |
| `explorations/verification-route` -> `goals/verification-route` | exploration / goal | `graduated` (2026-10-28) / `completed-retained` (final PR #2885) | both `ops/manifest.json` |
| `goals/ci-lane-economics` | goal | `active`, updated 2026-10-01 | `ops/manifest.json:6-8` |
| `explorations/beep-ci-operational-ontology` | exploration | `graduated` / `graduate`, updated 2026-10-01 | `ops/manifest.json:6-16` |
| `explorations/pr-event-awareness` -> `goals/yeet-pr-events` | exploration / goal | `graduated` (2026-09-25), archived 2026-11-09 / `completed-retained`; neither mentions queue entry, ejection or `merge_group` | manifests; ripgrep |
| `explorations/github-api-quota` | exploration | `graduated` / `graduate`, updated 2026-11-09 | `ops/manifest.json:6-20` |
| `goals/github-state-worker`, `goals/yeet-monitor-app-identity`, `goals/github-budget-ledger` | goals | `active`, all phases pending, updated 2026-11-09 | each `ops/manifest.json:7-9` |
| `goals/agent-pool-doctrine` 2026-11-05 record | ruling record | in force via `AGENTS.md:203-210` | file |
| Architecture decision 2026-08-27 | standard | `Active` | `standards/architecture/DECISIONS.md:1743` |
