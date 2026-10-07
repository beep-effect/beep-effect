# KPI verdict: fleet time-to-certainty beside time-to-certainty's M1

Hand-written W9 verdict for `goals/ciops-ontology-pipeline` phase P4, under P4 launch-sitting Rulings
4, 5, 8 and 10 and W8 implementation-sitting Rulings 13–16. It sits beside time-to-certainty's M1 in
content only; no file under `goals/time-to-certainty/` is edited (Ruling 10). Every figure is copied
from the cited source, never recomputed. "Cut" and "uncut" carry the KPI law's sense (§7.2: censored
episodes excluded, or included at their observed lower bounds) unless "M1's 24 h cut" is written.

Citation key (repository-relative paths; `:n` is a line number):

| Key | Path | SHA-256 at authoring |
| --- | --- | --- |
| READ | `goals/ciops-ontology-pipeline/research/kpi-reading.md` | `92ae675b4ebbd30c46b19272a0b3a1ae29f8cff0652121e07079b801169af0e3` |
| READ.json | `goals/ciops-ontology-pipeline/research/kpi-reading.json` | `63f3535c27c1a1d8b25e25782a18653ef2d2f6cd3de27696760ee5586296bc21` |
| LAW | `explorations/beep-ci-operational-ontology/research/kpi-measurement-rules.md` (v1.2) | — |
| GD | `goals/ciops-ontology-pipeline/research/decisions.md` | — |
| EC | `goals/time-to-certainty/research/economics-close.md` | `11969e5ee90dd3d894801613cbc5a138892044a38a49b8af32670add7c218697` |
| EC.json | `goals/time-to-certainty/research/economics-close.json` | `cc75d260c7076fba4e5fada7ba5dbcdf09302a43402648fe9a2a60932f002924` |
| ECON | `goals/time-to-certainty/research/scripts/economics.py` | — |
| TTC-D | `goals/time-to-certainty/research/decisions.md` | — |
| S7E | `goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md` | `2103ad0c03750a379646baf549a5cf6ac91366694cda2cac0e44d6f99d9049da` |
| LEDGER | `explorations/beep-ci-operational-ontology/research/control-interventions.yaml` | `f520b302424f871804c050d9698dcb8e10f19c081fd3dc48a9a19932308d724d` (READ:14) |
| GATE | `goals/ciops-ontology-pipeline/ops/manifest.json` (`completionGate.statement`, :27) | — |

The reading's pinned inputs and their digests are listed at READ:9-15; its estimator is nearest-rank and
its durations are milliseconds (READ:5).

## 1. Verdict

The fleet time-to-certainty reading under KPI law v1.2 is stated per slice and tier: on the window W
(2026-09-03T06:29:33.572Z to 2026-10-06T03:19:28.440Z, READ:21), TierRepairGreen reads cut P50
2844340 ms / P95 40096719 ms (n 8) and uncut P50 1498916 ms / P95 40096719 ms (n 30, 22
right-censored); TierLocalFullProof reads cut P50 3671966 ms / P95 45451837 ms (n 87) and uncut P50
3959832 ms / P95 86632840 ms (n 189, 102 right-censored), its merged-preview sub-partition cut and
uncut P50 3518428 ms / P95 4845542 ms (n 2); the unassigned bucket and the W-a and W-b slices follow
in §4 (READ:31-55). TierCiMergeGreen is unmeasured: no pin carries hosted input (READ:34, :57; GD:1457).
The normative starvation count at the declared 120000 ms bound is nonzero: 165 of 473 requests in W
and 109 of 245 in W-b wait beyond it (READ:63, :69; READ.json:318-327). Under LAW §4 (LAW:72-73) and
§7.6 (LAW:280-281) a nonzero count makes the report failing, whatever the percentiles say, so this
reading is a **failing report**, which is a lawful verdict (GD:1497-1501, Ruling 9). Improvement
against M1 is reported, not required (GATE:27, "improvement reported, not required"); §3 reports it.

## 2. Episode-definition mapping

| Concept | This KPI (law v1.2, the W8 reading) | time-to-certainty M1 |
| --- | --- | --- |
| Keying | One `(checkout, branch)` red streak (LAW:18-21); streaks are computed within each tier's attempt subsequence per `(checkout, branch)` (LAW:210). | Groups attempts by `(checkout, branch)` (ECON:1421, :1434); its ruling keys by `(checkout, runId)` with a branch-derived `runId`, the same partition (TTC-D:997; LAW:166-172, the §7.1 erratum to §6's "keys per branch"). |
| Population | The law's whole population: no mode filter (GD:1468). | Modes verify, repair and publish; lock bounces and left-censored episodes excluded (TTC-D:1001-1004; ECON:1542; EC:27). |
| Tiers | By attempt `stage`, with `proofTier` as a guard (LAW:189-200; GD:1448-1455, Ruling 3): repair-loop → TierRepairGreen; pre-push full → TierLocalFullProof; merged-preview → its sub-partition; hosted → TierCiMergeGreen; cheap-gates and review-fix → unassigned; stage-less → untiered (93 in W, READ:25). | None (LAW:141-143, :171-172). |
| Clock (opening) | The earlier of the first attempt's `startedAt` and a joined ticket's enqueue (LAW:223-227; GD:1474-1478, Ruling 6). On these pins every joined enqueue follows its attempt's start (132 of 132 joins), so every episode opens at attempt start (LAW:231-236; GD:1537-1548, Ruling 13). | The first red attempt's `startedAt` (TTC-D:1000; LAW:136-143). |
| Stop rule | The closing attempt's `attempt-finished.recordedAt`, else its `startedAt`; a reconciler-stamped termination never ends a duration (LAW:237-240). | The same: the green's `endedAt`, else its `startedAt` (TTC-D:999-1000); reconciler-stamped terminations have no elapsed time and end no duration (TTC-D:1014-1018). |
| "Cut" | The law's two meanings, named apart (LAW:174-185): law cut/uncut = censored excluded/included at lower bounds; no duration ceiling. | M1's 24 h cut: `comparable24h` keeps closed episodes of at most 24 h; M1's `uncut` drops the ceiling but still excludes right-censored streaks (LAW:179-182; TTC-D:1003-1004; ECON:1536-1551). The 24 h ceiling appears here only in the M1-replica (GD:1470-1471). |
| Right-censoring | An open streak enters uncut at its observed lower bound: last member's finish, else start, and a reconciler-stamped termination's start (LAW:244-246). | The same lower bound, reported as counts and a summed span, never inside a percentile (TTC-D:1006-1010). |
| Left-censoring | By `journal-compacted` receipt (cutoff at or after the opening), reported as a count (LAW:247-253; GD:1480-1483, Ruling 7). | Excluded from the population by compaction cutoff (TTC-D:1004-1006). |
| Possibly truncated | Streaks opening at the first retained attempt of an at-cap journal with no receipt, counted (LAW:249-253). | Not a category; EC reports a lower-bound truncation count and an unknown lifetime truncation (EC:195-196). |
| Survivorship | Enqueues naming an attempt with no pinned journal, one count on this pin (228 in W, READ:25; GD:1558-1563, Ruling 15). | Subject to the same loss, not counted (LAW:254-256). |
| Window | W = [2026-09-03T06:29:33.572Z, 2026-10-06T03:19:28.440Z), from time-to-certainty's post-baseline start to the `run4-fleet` capture, membership by episode start (GD:1461-1464, Ruling 5; READ:21). W-a ends at M1's measurement instant 2026-09-28T12:57:53.988Z, inclusive (READ:22). W-b is the canonical admission root's retained window, 2026-10-01T09:32:09.602Z to 2026-10-06T01:51:50.495Z, inclusive (READ:23; S7E:13; GD:1521-1523). | Post-P0 column: attempts started after 2026-09-03T06:29:33.572Z, as of 2026-09-28T12:57:53.988Z (EC:24, :212; EC.json:7191). |
| Starvation | Reported beside the percentiles at the declared 120000 ms bound (LAW:266-281). | None (LAW:141-142). |

The clock finding (Ruling 13) stands beside this mapping: the seat-request label exists in the contract and
the reading and reports zero in every row (READ:31-55, column "Seat-request"); queue wait stays inside the
KPI because it lies inside the attempt span (GD:1542-1544).

## 3. The M1-replica beside M1

The replica runs M1's definition (its modes, no tiers, M1's 24 h cut and its uncut) over the fleet pin on
W-a. It carries the label **"M1 definition over the fleet pin, not M1"** (READ:79; READ.json:401-419) and
is never this KPI. M1's post-P0 column is the comparison (GD:1470); its union and P0 baseline columns are
context only.

| Measure | M1 post-P0 (EC:216-222; EC.json:7601-7627) | M1 definition over the fleet pin, not M1 (READ:79; READ.json:405-417) |
| --- | --- | --- |
| comparable24h closed episodes | 58 (EC:218; EC.json:7602) | 57 |
| comparable24h P50 | 1.02 h = 3671966 ms (EC:216; EC.json:7610) | 3671966 ms |
| comparable24h P95 | 10.21 h = 36741278 ms (EC:217; EC.json:7611) | 36741278 ms |
| Closed episodes over 24 h excluded | 3 (EC.json:7603) | 3 |
| uncut closed episodes | 61 (EC.json:7617) | 60 |
| uncut P50 | 1.11 h = 3998760 ms (EC:221; EC.json:7624) | 3785418 ms |
| uncut P95 | 13.50 h = 48593855 ms (EC:222; EC.json:7625) | 48593855 ms |
| Right-censored streaks | 129 (EC:219; EC.json:7613) | 122 |
| Left-censored episodes excluded | 0 (EC.json:7605) | 0 |

Agreement, stated exactly: the comparable24h P50, the comparable24h P95 and the uncut P95 are equal to the
millisecond; closed episodes are 57 against 58 (comparable24h) and 60 against 61 (uncut); right-censored
streaks are 122 against 129; the uncut P50 is 3785418 ms against 3998760 ms. The attributed cause is the
later capture (the fleet pin is captured 2026-10-06, M1 as of 2026-09-28T12:57:53.988Z, EC:193) and the
retired lanes' lost attempt journals (survivorship, LAW:254-256); this is an attribution, not a proof
(GD:1583-1585).

Context, not comparison: M1's union column reads P50 42.3 min / P95 4.33 h comparable and 43.5 min /
7.21 h uncut, and its P0 baseline 43.3 min / 3.95 h and 43.6 min / 6.12 h (EC:216-222).

**Improvement, reported.** Under M1's own definition the post-P0 percentiles sit above the P0 baseline
(comparable P50 43.3 min → 1.02 h, P95 3.95 h → 10.21 h; EC:216-217), and M1 states that its post-P0
closed-episode percentiles are a lower-bound sample because 129 long streaks are still open (EC:242).
The replica reproduces that post-P0 figure on the fleet pin. This KPI's tiered reading has no pre-W
counterpart (tiers and adoption are derivable only from W, GD:1462-1464), so no improvement is claimed
for it; movement across change events is observational (§5, §6).

## 4. The reading by slice and tier

Columns as in the reading: cut and uncut nearest-rank P50/P95 with n, then right-censored, left-censored,
possibly truncated, and the clock-label counts (seat-request, attempt-start). The `local-full-proof` row
includes its merged-preview sub-partition (READ:57).

**W** (READ:27-35; READ.json:51 onward)

| Tier | Cut n | Cut P50 ms | Cut P95 ms | Uncut n | Uncut P50 ms | Uncut P95 ms | Right-censored | Left-censored | Possibly truncated | Seat-request | Attempt-start |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TierRepairGreen | 8 | 2844340 | 40096719 | 30 | 1498916 | 40096719 | 22 | 0 | 0 | 0 | 30 |
| TierLocalFullProof | 87 | 3671966 | 45451837 | 189 | 3959832 | 86632840 | 102 | 0 | 0 | 0 | 189 |
| └ merged-preview | 2 | 3518428 | 4845542 | 2 | 3518428 | 4845542 | 0 | 0 | 0 | 0 | 2 |
| TierCiMergeGreen | unmeasured | — | — | — | — | — | — | — | — | — | — |
| unassigned | 10 | 1201356 | 67243756 | 36 | 355706 | 7043308 | 26 | 0 | 0 | 0 | 36 |

**W-a** (READ:37-45)

| Tier | Cut n | Cut P50 ms | Cut P95 ms | Uncut n | Uncut P50 ms | Uncut P95 ms | Right-censored | Left-censored | Possibly truncated | Seat-request | Attempt-start |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TierRepairGreen | 8 | 2844340 | 40096719 | 26 | 1498916 | 40096719 | 18 | 0 | 0 | 0 | 26 |
| TierLocalFullProof | 73 | 3671966 | 50090986 | 166 | 4170288 | 90230991 | 93 | 0 | 0 | 0 | 166 |
| └ merged-preview | 2 | 3518428 | 4845542 | 2 | 3518428 | 4845542 | 0 | 0 | 0 | 0 | 2 |
| TierCiMergeGreen | unmeasured | — | — | — | — | — | — | — | — | — | — |
| unassigned | 9 | 1201356 | 67243756 | 28 | 370445 | 7043308 | 19 | 0 | 0 | 0 | 28 |

**W-b** (READ:47-55)

| Tier | Cut n | Cut P50 ms | Cut P95 ms | Uncut n | Uncut P50 ms | Uncut P95 ms | Right-censored | Left-censored | Possibly truncated | Seat-request | Attempt-start |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TierRepairGreen | 0 | — | — | 3 | 1048852 | 1735117 | 3 | 0 | 0 | 0 | 3 |
| TierLocalFullProof | 11 | 6608513 | 26787502 | 17 | 3397976 | 26787502 | 6 | 0 | 0 | 0 | 17 |
| └ merged-preview | 0 | — | — | 0 | — | — | 0 | 0 | 0 | 0 | 0 |
| TierCiMergeGreen | unmeasured | — | — | — | — | — | — | — | — | — | — |
| unassigned | 0 | — | — | 1 | 195486 | 195486 | 1 | 0 | 0 | 0 | 1 |

**TierCiMergeGreen** is reported unmeasured in every slice (READ:34, :44, :54, :57; GD:1457-1459, Ruling 4).
Beside it, and only as workflow durations, never as episodes, time-to-certainty's hosted envelope reads:
hosted Check on `pull_request`, 977 runs, P50 17.7 min, P95 1.96 h; on `main-push`, 157 runs, P50 36.8 min,
P95 2.21 h (EC:177-180); the hosted PR Check workflow envelope, n 977, P50 17.7 min, P95 1.96 h, measured
`createdAt` → `updatedAt` over parallel jobs (EC:186). No tier verdict is printed for this tier.

**Starvation** (declared bound 120000 ms; READ:59-73; READ.json:318 onward). Normative rows first;
the 15 min and 60 min rows are non-normative sensitivity rows (LAW:278-279).

| Slice | Bound | Normative | Requests | Beyond bound | Open at capture | Exceptions |
| --- | --- | --- | ---: | ---: | ---: | --- |
| W | 120000 ms | yes (declared) | 473 | 165 | 0 | unobservable |
| W | 900000 ms | no (sensitivity) | 473 | 71 | 0 | unobservable |
| W | 3600000 ms | no (sensitivity) | 473 | 8 | 0 | unobservable |
| W-a | 120000 ms | yes (declared) | 10 | 0 | 0 | unobservable |
| W-a | 900000 ms | no (sensitivity) | 10 | 0 | 0 | unobservable |
| W-a | 3600000 ms | no (sensitivity) | 10 | 0 | 0 | unobservable |
| W-b | 120000 ms | yes (declared) | 245 | 109 | 0 | unobservable |
| W-b | 900000 ms | no (sensitivity) | 245 | 62 | 0 | unobservable |
| W-b | 3600000 ms | no (sensitivity) | 245 | 7 | 0 | unobservable |

Exceptions are unobservable over history: the only modelled exception derives from a snapshot-global
flag no journal row records (LAW:275-277). The bound was declared before computing (LAW:268-271).

**CQ-012 queue-wait share (W-b): void.** 7 of 21 episodes decompose, and the share is printed only when
every episode in the slice decomposes (READ:81-83; READ.json:420-424; LAW:257-264; GD:1550-1556,
Ruling 14).

## 5. The change-event table

All 44 rows of the ledger, in the reading's order (READ:85-132; READ.json:425 onward for the rows,
:691 onward for the partitions). Every row is OBSERVATIONAL (LAW:46-50). Membership is
adoption-qualified (LAW:41-45): a W episode is post-adopted only when its resolved head's ancestry
includes the row's merge commit, read from the committed adoption table
`goals/ciops-ontology-pipeline/research/kpi-adoption-table.json` (READ:15; GD:1488-1491, Ruling 8).
Squash-adoption caveat: when a change lands as a squash, checkouts that ran its branch before `landedAt`
do not carry the merge commit and file pre-period, so the post-period is undercounted (stated for #1427
at LEDGER:1118 and §6).

Cell format per local tier: `pre cut n + censored c / post-adopted cut n + censored c / post-unadopted`.
The `unknown` class is 0 in every row (READ:89-132). Series is the row's tier series (`local` covers both
local tiers and the unassigned bucket; `hosted` is unmeasured; GD:1519-1521, Ruling 12a); a `local +
hosted` row partitions its local half only. The last column is the reading line.

The six pre-window rows (iv-870, iv-929, iv-874, iv-871, iv-891, iv-894) are **context**: their
partitions are degenerate, every W episode post-adopted (READ:89-90, :92-95; GD:1580-1583). The
in-window `iv-953-turbo-remote-read-isolation` also partitions nothing in fact: no W episode in a local
tier is in its pre-period (READ:96). Ten in-window rows are hosted only and unmeasured (Ruling 4).

| # | Id | landedAt | Series | In W | repair-green | local-full-proof | merged-preview | unassigned | Reading |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `iv-870-weighted-admission` | 2026-08-27T19:52:03Z | local | no | context | context | context | context | :89 |
| 2 | `iv-929-origin-lock-retirement` | 2026-08-31T08:20:46Z | local | no | context | context | context | context | :90 |
| 3 | `iv-1006-wave-order` | 2026-09-04T05:34:17Z | local | yes | 7+1c / 1+21c / 0 | 13+10c / 74+92c / 0 | 0+0c / 2+0c / 0 | 1+6c / 9+20c / 0 | :91 |
| 4 | `iv-874-publish-before-admission` | 2026-08-30T02:39:33Z | local | no | context | context | context | context | :92 |
| 5 | `iv-871-docgen-direct-package-check` | 2026-08-30T08:34:57Z | local + hosted | no | context | context | context | context | :93 |
| 6 | `iv-891-per-user-runtime-root` | 2026-08-30T09:20:21Z | local | no | context | context | context | context | :94 |
| 7 | `iv-894-invariant-runtime-root` | 2026-08-30T10:23:55Z | local | no | context | context | context | context | :95 |
| 8 | `iv-953-turbo-remote-read-isolation` | 2026-09-03T08:28:17Z | local | yes | 0+0c / 8+22c / 0 | 0+0c / 87+102c / 0 | 0+0c / 2+0c / 0 | 0+0c / 10+26c / 0 | :96 |
| 9 | `iv-982-hosted-lint-unit-shards` | 2026-09-03T19:35:51Z | hosted | yes | unmeasured (hosted only) | — | — | — | :97 |
| 10 | `iv-1007-deprecated-apis-tooling-shards` | 2026-09-04T03:09:20Z | local + hosted | yes | 7+1c / 1+21c / 0 | 12+9c / 75+93c / 0 | 0+0c / 2+0c / 0 | 1+6c / 9+20c / 0 | :98 |
| 11 | `iv-1019-proof-reuse-key-narrowed` | 2026-09-09T00:51:25Z | local | yes | 7+4c / 1+18c / 0 | 21+11c / 65+91c / 1 | 0+0c / 2+0c / 0 | 1+8c / 9+18c / 0 | :99 |
| 12 | `iv-1022-proof-reuse-key-full-env` | 2026-09-09T02:41:53Z | local | yes | 7+6c / 1+16c / 0 | 26+14c / 61+88c / 0 | 1+0c / 1+0c / 0 | 2+8c / 8+18c / 0 | :100 |
| 13 | `iv-1021-fallow-health-lane` | 2026-09-09T03:33:07Z | local | yes | 7+6c / 1+16c / 0 | 28+14c / 58+88c / 1 | 2+0c / 0+0c / 0 | 2+8c / 8+18c / 0 | :101 |
| 14 | `iv-1029-package-scripts-policy-checks` | 2026-09-09T08:00:35Z | local + hosted | yes | 7+6c / 1+16c / 0 | 35+20c / 51+81c / 2 | 2+0c / 0+0c / 0 | 2+10c / 8+16c / 0 | :102 |
| 15 | `iv-1050-heavy-pool-on-demand` | 2026-09-09T09:13:51Z | hosted | yes | unmeasured (hosted only) | — | — | — | :103 |
| 16 | `iv-1053-check-typechecks-tests` | 2026-09-09T11:50:17Z | local + hosted | yes | 7+6c / 1+16c / 0 | 40+23c / 47+78c / 1 | 2+0c / 0+0c / 0 | 2+11c / 8+15c / 0 | :104 |
| 17 | `iv-1049-quality-lanes-pr1` | 2026-09-09T12:04:17Z | local | yes | 7+6c / 1+16c / 0 | 40+23c / 47+78c / 1 | 2+0c / 0+0c / 0 | 2+11c / 8+15c / 0 | :105 |
| 18 | `iv-1054-storybook-config-typecheck-lanes` | 2026-09-09T13:46:50Z | local | yes | 7+6c / 1+16c / 0 | 41+24c / 46+77c / 1 | 2+0c / 0+0c / 0 | 2+12c / 8+14c / 0 | :106 |
| 19 | `iv-1061-docgen-full-proof-metadata-check` | 2026-09-09T17:45:48Z | local + hosted | yes | 7+7c / 1+15c / 0 | 45+24c / 42+77c / 1 | 2+0c / 0+0c / 0 | 3+13c / 7+13c / 0 | :107 |
| 20 | `iv-1064-heavy-build-dispatch` | 2026-09-09T18:53:05Z | hosted | yes | unmeasured (hosted only) | — | — | — | :108 |
| 21 | `iv-1079-policy-lint-on-turbo` | 2026-09-10T06:49:51Z | local | yes | 8+7c / 0+15c / 0 | 51+26c / 36+76c / 0 | 2+0c / 0+0c / 0 | 3+13c / 7+13c / 0 | :109 |
| 22 | `iv-1080-api-docs-docgen-config-removed` | 2026-09-10T07:48:11Z | local + hosted | yes | 8+7c / 0+15c / 0 | 51+26c / 36+76c / 0 | 2+0c / 0+0c / 0 | 3+13c / 7+13c / 0 | :110 |
| 23 | `iv-1067-effect-vitest-cheap-gate` | 2026-09-10T22:38:37Z | local | yes | 8+7c / 0+15c / 0 | 53+27c / 34+75c / 0 | 2+0c / 0+0c / 0 | 3+14c / 7+12c / 0 | :111 |
| 24 | `iv-1068-cache-policy-gate` | 2026-09-10T22:38:53Z | local | yes | 8+7c / 0+15c / 0 | 53+27c / 34+75c / 0 | 2+0c / 0+0c / 0 | 3+14c / 7+12c / 0 | :112 |
| 25 | `iv-1098-effect-vitest-in-lint-policy` | 2026-09-12T05:45:35Z | local | yes | 8+9c / 0+13c / 0 | 55+28c / 32+74c / 0 | 2+0c / 0+0c / 0 | 3+14c / 6+12c / 1 | :113 |
| 26 | `iv-1112-coverage-fixture-owners` | 2026-09-12T12:57:03Z | local + hosted | yes | 8+10c / 0+12c / 0 | 55+34c / 32+68c / 0 | 2+0c / 0+0c / 0 | 3+14c / 6+12c / 1 | :114 |
| 27 | `iv-1102-turbo-policy-plan` | 2026-09-12T23:26:03Z | local + hosted | yes | 8+10c / 0+12c / 0 | 55+34c / 32+68c / 0 | 2+0c / 0+0c / 0 | 3+14c / 6+12c / 1 | :115 |
| 28 | `iv-1141-heavy-pool-containment` | 2026-09-16T00:18:38Z | hosted | yes | unmeasured (hosted only) | — | — | — | :116 |
| 29 | `iv-1146-turbo-input-isolation` | 2026-09-16T08:01:40Z | local | yes | 8+15c / 0+7c / 0 | 63+40c / 24+62c / 0 | 2+0c / 0+0c / 0 | 4+16c / 6+10c / 0 | :117 |
| 30 | `iv-1155-heavy-admission-gate` | 2026-09-16T13:15:22Z | hosted | yes | unmeasured (hosted only) | — | — | — | :118 |
| 31 | `iv-1165-heavy-skip-satisfied` | 2026-09-16T16:08:36Z | hosted | yes | unmeasured (hosted only) | — | — | — | :119 |
| 32 | `iv-1182-identity-lint-inputs` | 2026-09-22T08:54:47Z | local | yes | 8+16c / 0+6c / 0 | 66+50c / 21+52c / 0 | 2+0c / 0+0c / 0 | 5+16c / 5+10c / 0 | :120 |
| 33 | `iv-1195-repo-cli-vitest-shards` | 2026-09-22T12:49:42Z | hosted | yes | unmeasured (hosted only) | — | — | — | :121 |
| 34 | `iv-1221-fallow-hash-exclusion-shared-cache` | 2026-09-25T06:08:47Z | local | yes | 8+17c / 0+5c / 0 | 68+55c / 19+47c / 0 | 2+0c / 0+0c / 0 | 6+17c / 4+9c / 0 | :122 |
| 35 | `iv-1232-shared-turbo-cache-dir` | 2026-09-25T11:57:07Z | local | yes | 8+17c / 0+5c / 0 | 71+58c / 16+43c / 1 | 2+0c / 0+0c / 0 | 7+17c / 3+9c / 0 | :123 |
| 36 | `iv-1233-pilot-dependency-lint-uncached` | 2026-09-25T16:09:11Z | local + hosted | yes | 8+17c / 0+5c / 0 | 72+70c / 15+31c / 1 | 2+0c / 0+0c / 0 | 7+18c / 3+8c / 0 | :124 |
| 37 | `iv-1269-cache-policy-seed` | 2026-09-25T21:46:53Z | local | yes | 8+17c / 0+5c / 0 | 72+71c / 15+31c / 0 | 2+0c / 0+0c / 0 | 7+18c / 3+8c / 0 | :125 |
| 38 | `iv-1364-spot-pool-spread` | 2026-10-01T12:05:00Z | hosted | yes | unmeasured (hosted only) | — | — | — | :126 |
| 39 | `iv-1381-app-env-out-of-build-hash` | 2026-10-01T16:16:58Z | local | yes | 8+19c / 0+3c / 0 | 77+97c / 10+5c / 0 | 2+0c / 0+0c / 0 | 9+20c / 1+6c / 0 | :127 |
| 40 | `iv-1380-shadcn-lint-lane` | 2026-10-01T20:15:16Z | local | yes | 8+19c / 0+3c / 0 | 78+97c / 9+5c / 0 | 2+0c / 0+0c / 0 | 9+20c / 1+6c / 0 | :128 |
| 41 | `iv-1384-rerun-runner-loss` | 2026-10-01T20:15:29Z | hosted | yes | unmeasured (hosted only) | — | — | — | :129 |
| 42 | `iv-1389-deprecated-apis-tool-shards` | 2026-10-02T18:58:02Z | local + hosted | yes | 8+19c / 0+3c / 0 | 83+97c / 4+5c / 0 | 2+0c / 0+0c / 0 | 9+20c / 1+6c / 0 | :130 |
| 43 | `iv-1427-push-first-publish` | 2026-10-06T01:36:13Z | local | yes | 8+21c / 0+1c / 0 | 87+101c / 0+0c / 1 | 2+0c / 0+0c / 0 | 9+21c / 1+5c / 0 | :131 |
| 44 | `iv-1422-spot-pool-drop-r6a` | 2026-10-06T02:22:00Z | hosted | yes | unmeasured (hosted only) | — | — | — | :132 |

## 6. #1427 (`iv-1427-push-first-publish`)

#1427 landed at 2026-10-06T01:36:13Z and partitions the **local series only** (READ:136; GD:1493-1495).
Its post-period is the last 1 h 43 min of W before the capture, so the reading compares populations across
the event (which tiers the episodes fall in), never a shift in one population's percentiles (READ:136).
The post-period holds 8 episodes in W across every adoption class: TierRepairGreen 0 cut + 1 censored
post-adopted; TierLocalFullProof 0 post-adopted and 1 post-unadopted; unassigned 1 cut (2077942 ms) +
5 censored post-adopted; the merged-preview sub-partition none (READ:136-143). The pre-period carries
the bulk of W: TierLocalFullProof 87 cut + 101 censored (P50 3671966 ms, P95 45451837 ms), TierRepairGreen
8 + 21, unassigned 9 + 21 (READ:140-143). Adoption-qualified membership undercounts the post-period:
#1427 is a squash of the `goals/push-first-publish` branch, so checkouts on that branch and on the lanes
merged into it (#1431, #1433, #1442) ran push-first before `landedAt` without the merge commit in their
ancestry and file pre-period (READ:145; LEDGER:1118). The hosted confounder is named, not partitioned:
local admission demand falls at the same instant because the push-first default takes no admission
ticket, and on the hosted tier the same default adds the heavy-admission label at pull-request creation,
turns `--pr` on and sends heads with cheap-gates as their only local proof; the hosted series is
unmeasured (READ:146; LEDGER:1122). `iv-1422-spot-pool-drop-r6a` lands 46 min later on the hosted tier
and partitions nothing local (READ:132, :146; LEDGER:1123, :1165). Every comparison here is
OBSERVATIONAL (READ:147; LAW:46-50): "the KPI moved after #1427 landed" is never "#1427 moved the KPI".

## 7. The S9 statement

What the projection says the route should be, and whether the deployed route matches (GD:1506-1510,
Ruling 10):

- **Admission route.** The projection's first prescribed admission agrees with the deployed grant in
  197 of 200 `admission-admitted` rows on the `run4-fleet` canonical journal, and 41 of 41 on the frozen
  golden (S7E:20-25). The 3 disagreements (event indexes 69, 259 and 284) are attributed
  `same-checkout-active-lease`: since #929 the deployed scheduler skips a request whose checkout already
  holds an active grant, and admission v1 does not model that skip (S7E:29-35). The attribution is
  diagnostic, joined by nonce over the pinned rows (S7E:35).
- **CQ-009 under the deployed route.** The same-checkout arm holds: 0 pairs across 200 evaluated grants,
  none without a checkout (S7E:64-68). The legacy-origin-drain arm is unobservable in the journal: the
  deployed writer records no coordination protocol (0 of 689 rows carry it), and reading an absent field
  as an answer would be a false green (S7E:70-74). The two arms carry no combined verdict (S7E:62).
- **Lane route.** Lane-route agreement holds by construction: `planEpisode` orders the handoff's existing
  lanes by its rank chain (GD:400-404, :419-424), and the handoff is a fixture-guarded document whose
  bytes the deployed order computes (TTC-D:1125-1132), so agreement is a consistency check, not
  independent evidence (GD:1508-1509).
- **What the projection does not say.** The projection proposes no route other than the deployed one and
  makes no route claim; no KPI figure is attributed to it, and none is emitted to the A-Box (GD:1509-1510).
- **The `ciops-yeet-projection` trigger.** Its trigger needs the KPI verdict to show the projected order
  beating the deployed one (`explorations/beep-ci-operational-ontology/DECISIONS.md:1437-1440`). That is
  not measurable on the pins: no episode ran under a projected order, so there is no counterfactual to
  compare (GD:1509-1510; `goals/ciops-ontology-pipeline/research/p4-survey.md`:351-354).

## 8. What the pins cannot show

- **A seat-request opening.** In all 132 pinned ticket joins the enqueue follows its attempt's start by
  90 ms to 54 s, so the seat-request clock opens no episode and its count is 0 in every row
  (GD:1537-1548, Ruling 13; LAW:231-236). Queue time before an attempt starts is not visible on these
  pins.
- **Left-censoring and possible truncation.** Both are 0 for pin reasons, not because no history was
  lost: the pin carries no compaction receipts, and the six at-cap journals open with August attempts
  that carry no `stage`, so no tiered streak opens at a first retained attempt (GD:1579-1581;
  LAW:247-253).
- **Survivorship by reason.** 228 enqueues in W name an attempt with no pinned journal; they are one
  count, never imputed, and a by-reason split needs a pin with receipts (READ:25; GD:1558-1563,
  Ruling 15).
- **TierCiMergeGreen.** No pin carries hosted input (GD:1457-1459; LAW:211-213).
- **The KPI over M1's exact window.** W-a reproduces M1's span for the replica only; the KPI cannot be
  read there with a complete admission journal (W-a retains 10 requests, READ:66), which is why
  Ruling 5 rejected the exact M1 window (GD:1471-1472).
- **Adoption reproducibility.** The adoption table reproduces only in a clone whose object stores hold
  the fleet's heads: 58 of 215 resolved heads exist only in unpushed lane clones, so CI verifies the table
  by sha256 and never regenerates it (GD:1574-1577; `kpi-adoption-table.json`:5).

## 9. Completion-gate reading

The gate (GATE:27) reads clause by clause as follows. (1) The fleet P50/P95 per verification episode is
computed under KPI law v1.2, which extends v1.1 without retracting it (§1–§6 stand except where §7 says
otherwise, LAW:157): it is reported per tier with merged preview as a sub-partition of
TierLocalFullProof, cut and uncut with censored counts, and starvation beside the percentiles (§4); the
seat-request clock is implemented and reports zero (Ruling 13, §8); the post-baseline window W is
charter-ratified, as the launch sitting reads "operator-ratified" (GD:1426-1427, Ruling 5); every
in-window change event is tagged under adoption-qualified membership (§5, 38 in-window rows); and the
verdict stated beside M1 with the episode-definition mapping is this document (§1–§3), improvement
reported, not required. (2) The CQ suite and the packet validators are green on the tree #1524 left
(CQ suite digest `3eed0c3f73de`, GD:1411); PR-B's own checks prove them on the final tree. (3) The S7
projection is byte-deterministic (`apps/labs/ciops/test/projection.test.ts`:145), differential replay
passes on the frozen golden (41 of 41) and reports first-choice agreement on the run-4 Stage C pin (197 of
200, S7E:24-25), and `planEpisode` consumes `gate-order-handoff/v1` by path and sha256 (GD:400-402;
`apps/labs/ciops/test/lane-plan.test.ts`:36-38). (4) Auditor run 4 is ratified with the gate PASSED and
its sittings scribed (#1490; GD:1383, :1415-1417). (5) PR-B is the final PR and carries the status flip
and the closeout reflection (GD:1512-1517, Ruling 11); the clause is met when PR-B reaches Yeet
merge-ready.
