# rc.113 final scanner timing

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
