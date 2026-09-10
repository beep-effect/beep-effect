# rc.113 final scanner timing

## Accepted tagged-value candidate

Root accepts three consecutive ordinary `bun run beep lint effect-vitest` runs
on the final 7,775-row, 1,110-path canonical baseline. All exit zero; the complete
source and canonical artifact hashes are unchanged. All source/package writers
had finished, and no owned coverage command was active.

| Run | Full command seconds | Child CPU seconds | Host load1 before | Available GiB before | Host swap pages in / out |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 9.943252 | 16.076 | 2.43 | 66.63 | 15109 / 316 |
| 2 | 9.503443 | 15.771 | 2.67 | 66.28 | 336 / 0 |
| 3 | 9.587565 | 15.760 | 2.57 | 66.29 | 4 / 0 |

The host exposes 64 logical CPUs. Ten-second CPU, memory and IO pressure averages
were zero at the captured boundaries. The raw receipts also retain affinity,
inherited niceness, cgroup limits and counters. Swap/page and cgroup counters are
shared host context, not scanner-only attribution. Existing swap use is distinct
from activity during a sample. No numeric load adjustment or scheduler changes
were made.

The slowest observation leaves 0.057 seconds under D4. These observations satisfy
the final current-cohort gate; they do not guarantee the bound under other loads.
All earlier failed and passing cohorts below remain historical, source-bound
evidence. The preceding post-spelling cohort of 10.725s, 9.369s and 9.498s remains
a failure and was not dropped or relabeled.

Runtime: Bun 1.4.2, Node 24.20.0, Effect and adapter rc.113, Vitest 4.1.11.
Payload SHA256: `7ff770991382f4efe628ba23d81b897556e5743cc6ab6c056d9bdc394bfbab22`.
Private raw captures are retained in post-round2-tagged-timing under
`~/.cache/beep/effect-vitest-canon/pr1067-resume/`; Root acceptance is recorded
in post-round2-tagged-timing-root-acceptance.json.

## Historical Fallow candidate

After the behavior-preserving Fallow repairs, Root repeated the normal command
on the final 8,026-row baseline: **9.404512s, 9.606115s and 9.547228s**, all exit
zero. Complete source and canonical hashes remain unchanged. The only D9 source
change moves one runtime-helper finding by one line and updates its body anchor;
all other 8,025 full finding payloads are exact, with no count/classification,
replacement, status, reason or exception transfer. The final candidate retains
all earlier observations below as historical evidence.

Current payload SHA256:
`450675866d9e1102a17dfc96a91b61f450cf1b934b5671e0ff5fe40a538bf753`.
Raw evidence and resource context are retained in
`~/.cache/beep/effect-vitest-canon/pr1067-resume/post-fallow-timing/`.
Root's final timing receipt is `post-fallow-timing-root-acceptance.json`.
These observations satisfy the current D4 target; they do not establish a
worst-case guarantee under different workstation load.


## Prior policy candidate acceptance

Root accepts three consecutive ordinary `bun run beep lint effect-vitest` runs
on the merged implementation and the adopted **8,026-row / 1,106-path** baseline:
**9.489577s, 9.530767s and 9.748002s**. All exit zero; the full source set and
canonical artifact hashes remain unchanged. The narrow membership-index repair
preserves complete ordered finding payloads, including duplicate semantics.
The final baseline delta is independently accounted for with no unexplained loss
or exception transfer. No package, coverage or source writer was active during
these three observations.

| Run | Full command seconds | Child CPU seconds | Load1 before | Available GiB before | Swap pages in / out |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 9.489577 | 15.509 | 5.01 | 70.50 | 40 / 0 |
| 2 | 9.530767 | 15.580 | 4.93 | 70.74 | 26 / 0 |
| 3 | 9.748002 | 15.932 | 4.79 | 69.71 | 28 / 0 |

The host exposes 64 logical CPUs. Raw captures retain CPU/IO/memory pressure,
CPU counters, affinity, cgroup limits, memory availability and swap/page deltas.
Memory pressure averaged zero during these observations; existing swap use is
not treated as activity during a run. These are observed durations under the
recorded load, not normalized scores or a worst-case latency guarantee. The
slowest observation leaves 0.252s of margin; workstation load remains relevant.
All earlier observations and failures below remain historical evidence.

Runtime: Bun 1.4.2, Node 24.20.0, Effect and adapter rc113, Vitest 4.1.11.
The declared adapter peer mismatch remains separately disclosed. Current finding
payload SHA256: `b21cba0b20cf184184b6e2c06f0e649cb0931172bda2537a7a6fa92c16472bc2`.
Private evidence: `~/.cache/beep/effect-vitest-canon/pr1067-resume/policy-final-timing/`
and `policy-final-timing-root-acceptance.json`.

## Historical pre-adoption observations


Root accepts the initial scan and all three ordered repeat runs against the frozen
1,106-file D9 census. Each produced the identical 8,023 complete finding payloads.
The initial full CLI command took 9.591994 seconds; every repeat remained under D4's
ten-second bound. Package and coverage writers had finished before capture.

| Run | Full command seconds | Child CPU seconds | Host load1 before → after | Aggregate CPU busy | Available GiB before → after | Swap pages in / out |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 9.691730 | 15.981 | 13.27 → 14.04 | 23.5% | 63.16 → 59.96 | 1102 / 0 |
| 2 | 9.975795 | 16.393 | 14.04 → 14.50 | 23.3% | 65.11 → 71.06 | 644 / 0 |
| 3 | 9.677361 | 15.800 | 14.50 → 13.88 | 20.2% | 70.12 → 67.82 | 12066 / 0 |

The host exposed 64 logical CPUs. Raw receipts retain CPU counters, load, affinity,
memory availability, memory/CPU/IO pressure, swap/page deltas and cgroup ancestor
limits. These are observed resource conditions, not a load-normalized score. No
cache manipulation or scheduler changes were made for the measurements. Existing
swap use is distinguished from activity during each sample.

The slowest repeat leaves only 0.024 seconds of margin. This evidence satisfies
the bounded current-cohort acceptance; it does not establish a worst-case latency
guarantee under other workstation loads. Earlier failed timings remain historical
evidence and were not dropped from their reports.

Runtime: Bun 1.4.2, Node 24.20.0, Effect and @effect/vitest 4.0.0-rc.113,
Vitest 4.1.11. The inherited declared Vitest peer mismatch remains separately
disclosed in the integration record. Finding payload SHA256:
`05263b2d6d15fef625c621bf6878b97e0353f8a5d574ff2980d20cfe55d5c121`. Private raw captures and Root acceptance are retained under
`~/.cache/beep/effect-vitest-canon/pr1067-resume/rc113-final-variability/`
and `rc113-timing-root-acceptance.json`. Current-row reconciliation and canonical
publication are separate gates.


## Post-adoption qualification

The four observations above used the prior 5,016-row canonical baseline as an
input while collecting the 8,023-row preview. After accepted canonical adoption,
the ordinary membership ratchet passes functionally but takes 10.319232 seconds.
This later observation exceeds D4. The earlier bounded cohort does not establish
final performance with the larger baseline, so Root has reopened that integration
gate. The failed bound is retained under rc113-canonical-publication/ratchet.log
and status.json; no normalization or waiver is applied.
