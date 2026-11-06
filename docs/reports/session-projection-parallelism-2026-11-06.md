# Session projection parallelism: measured and rejected

The second Opus audit proposed running the existing goal-index and exploration-atlas
writers concurrently. The declared acceptance threshold was at least 500 ms lower
median latency over 20 alternating runs per variant, with identical outputs.

The fixed-source confirmation did not meet that threshold, so the hook remains
serial. There is no shipped performance gain from this candidate.

| Measurement | Serial | Parallel candidate |
| --- | ---: | ---: |
| Samples | 20 | 20 |
| Median | 1.136953 s | 0.657681 s |
| p95 | 1.257187 s | 0.680034 s |
| Largest individual command peak RSS | 320,320 KiB | 322,236 KiB |
| Largest sum of command peak RSS values | 547,096 KiB | 549,116 KiB |

The median reduction was **479.272 ms**, below the prespecified 500 ms gate.
These are local component measurements, not end-to-end session-start timings.
GNU time measured each command independently; summing their peaks provides a
conservative bound, not a measurement of simultaneous memory use. Parallel
execution overlaps the two processes and therefore trades concurrency for latency.

The confirmation used an isolated checkout at
`13574da71c8a1049a7054362bd729e4d13595da3`, Bun 1.4.4, one serial warmup, and
alternating order. Both real commands executed in every measured sample. All
118 generated output hashes matched, and hashes of all 940 relevant CLI and
Palantiri TypeScript source files remained unchanged throughout the confirmation.

An exploratory run in the shared implementation checkout measured 498.258 ms
lower median latency. A subsequent run in that checkout was confounded by
concurrent runtime-source edits and is excluded from acceptance. The isolated
confirmation above was the final planned measurement; the threshold was not
rounded down and no further runs were selected to obtain a passing result.

No production hook or failure-handling behavior changed. Output equivalence
was tested, but additional failure/timeout regression tests were not implemented
because the timing gate had already rejected the candidate. Reopening this
candidate requires new evidence or an explicitly revised tradeoff, not the same
unmeasured claim that parallel execution must be worthwhile.
