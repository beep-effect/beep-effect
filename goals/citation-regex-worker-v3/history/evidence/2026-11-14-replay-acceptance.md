# Citation replay acceptance — 2026-11-14

Evidence collected at main 34964a3fdc0fe0d5ade1916b0fffa4a63ee65c65 in the closeout lane. No local suite or coverage was run.

## Scope and sources

SPEC.md acceptance B3 requires five serial replays under half their watchdog on hosted CI; its verification matrix additionally requires identical results and a remote-worker run in history/evidence/.

The README in explorations/citation-engine-install-and-worker-reuse records the historical 180 s Bun FullSpan watchdog. Its research/design-2026-11-12.md sections 5–6 name the ten-call FullSpan measurement fixture and test churn, but do not enumerate five replay files. The exact five are explicitly enumerated in that exploration's RESEARCH.md, “Tests, fixtures and measurement” (lines 254–260), and CAPTURE.md (lines 20–25): FullSpan, ExtractionLoop, PinSpan, PageCorrection, ParsedEquality. These are the chosen families, rather than five arbitrary integration corpora. All five currently reside directly under packages/law-practice/server/test/, not test/integration/. Their layers declare concurrent: false. vitest.integration.sequencer.ts routes both integration and unit shard plans; it does not make these five integration tests.

FullSpan is now ten separate Bun call tests sharing one installation, plus a construction assertion and a Node first-call test. ExtractionLoop is twelve three-case Bun slices plus boundary tests and a Node first-slice test. Therefore there are five replay families, not five individual timed tests. No aggregate family watchdog exists for these split families. The table below uses the slowest replay test for each family, and the complete per-test table preserves all evidence.

Watchdogs: CitationCanonicalFullSpan.test.ts:35 and :46; CitationCanonicalPinSpan.test.ts:15 and :20; CitationCanonicalPageCorrection.test.ts:22 and :27; CitationCanonicalParsedEquality.test.ts:18 and :23 set timeout: 180000 per replay test. FullSpan's nested layer timeout “120 seconds” (:24) bounds layer setup, not the cohort. CitationExtractionLoop.test.ts uses the package default (vitest.shared.ts:314, packageTestTimeout(30000)); its layer timeout “5 seconds” (:17) is a layer hook budget, not the replay test timeout. The shared config raises that default to 300000 when coverage or the deep sweep is active, and the hosted Test Unit (law-practice-*) shards run with --coverage, so on hosted CI ExtractionLoop's watchdog is 300000 ms; 30000 ms applies only without coverage, as in the remote-worker run. @effect/vitest documents layer timeout as a hook budget. The runner's internal/VitestInstrumentation.ts:74–86 subtracts a margin of at most 250 ms: effective hang watchdogs are 179750 ms for the four 180 s families, 299750 ms for ExtractionLoop on hosted CI and 29750 ms for ExtractionLoop without coverage. Ratios below use configured timeout as requested; every after result also passes against half the stricter effective watchdog.

## Hosted provenance and method

Before: [B1 #3336 Check run 43594025859](https://github.com/beep-effect/beep-effect/actions/runs/43594025859), head b9089f34c6bb2a7d6910bbc86742e4be832eb06a, success. This head precedes B2 bbf67b946b (verified Git ancestry).

After: [B3 #3355 Check run 43650572273](https://github.com/beep-effect/beep-effect/actions/runs/43650572273), head d39b13d10392e06e77af504a11e274be08ffd91b, success. Main's 34964a3fdc0 Check run 43652334601 was queued at collection, so the permitted last green B3 fallback is used. The hinted 43651... run was not needed: the API returned this successful Check for the exact requested B3 head.

Retrieved workflow runs by head_sha, paginated jobs, then downloaded logs with gh api --allow-escape-sequences repos/beep-effect/beep-effect/actions/jobs/<job>/logs. Extracted each structured effect-vitest test end record's durationMillis, outcome and testName, once per record (the logger also repeats unstructured output). Durations below are test-body lifecycle timings, not shard/file timings or committed shard estimates. Timing comparisons include runner-load variation and are not a controlled benchmark.

| Replay family (maximum individual replay test) | Configured watchdog ms | Before ms | After ms | After/watchdog | Under half | Before / after job |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| FullSpan | 180000 | 29112.749 | 29140.059 | 0.1619 | yes | 132445009999 / 132618308361 |
| ExtractionLoop | 300000 (hosted, see note) | 32401.329 | 5360.168 | 0.0179 | yes | 132445009976 / 132618308379 |
| PinSpan | 180000 | 52417.099 | 31637.672 | 0.1758 | yes | 132445010022 / 132618308372 |
| PageCorrection | 180000 | 39920.170 | 17630.609 | 0.0979 | yes | 132445010022 / 132618308379 |
| ParsedEquality | 180000 | 41727.284 | 25893.981 | 0.1439 | yes | 132445009976 / 132618308372 |

Note on ExtractionLoop. Its tests set no timeout of their own (the layer `timeout: "5 seconds"` is the hook budget), so they take the package default `packageTestTimeout(30_000)` from `vitest.shared.ts`. That function returns 300000 ms when coverage is active, and the hosted `Test Unit (law-practice-*)` shards run `bunx --bun vitest run ... --coverage` (job 132618308379 log: `Coverage enabled with v8`). So the hosted watchdog for ExtractionLoop was 300 s both before and after, which is why the 32.4 s before test passed. The four other families set an explicit 180000 ms per test, which applies with or without coverage. Without coverage (the remote-worker run below) ExtractionLoop's watchdog is 30 s, and its slowest test there took 6.03 s, 20%.

### Every timed test (milliseconds)


File: packages/law-practice/server/test/CitationCanonicalFullSpan.test.ts

| Exact test name | Before ms | After ms | Before / after job | After outcome |
| --- | ---: | ---: | --- | --- |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > installs the stage tree once at engine construction | 1.243 | 1.143 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > recomputes original call 1 of 10 | 18330.646 | 4598.482 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > recomputes original call 2 of 10 | 4096.935 | 1461.886 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > recomputes original call 3 of 10 | 4088.663 | 1311.911 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > recomputes original call 4 of 10 | 6428.383 | 1910.096 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > recomputes original call 5 of 10 | 5213.223 | 2180.150 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > recomputes original call 6 of 10 | 5770.159 | 2361.660 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > recomputes original call 7 of 10 | 14434.841 | 5165.553 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > recomputes original call 8 of 10 | 9563.991 | 2984.438 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > recomputes original call 9 of 10 | 4134.485 | 2044.389 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes all thirteen original full-span equalities on bun > recomputes original call 10 of 10 | 3834.421 | 1446.777 | 132445009999 / 132618308361 | success |
| original full-span assertions > recomputes the first original full-span call on node | 29112.749 | 29140.059 | 132445009999 / 132618308361 | success |

File: packages/law-practice/server/test/CitationExtractionLoop.test.ts

| Exact test name | Before ms | After ms | Before / after job | After outcome |
| --- | ---: | ---: | --- | --- |
| original connected extraction loop > pins the corpus size and refuses malformed input on bun | 1541.466 | 940.155 | 132445009976 / 132618308379 | success |
| original connected extraction loop > pins the corpus size and refuses malformed input on node | 1636.801 | 924.705 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 0-2 | 12221.000 | 2580.470 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 3-5 | 17189.709 | 4046.247 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 6-8 | 19542.526 | 3524.660 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 9-11 | 29130.380 | 5009.334 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 12-14 | 32401.329 | 5285.650 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 15-17 | 23294.069 | 4262.891 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 18-20 | 5249.704 | 2077.366 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 21-23 | 3798.354 | 1751.841 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 24-26 | 11108.047 | 3051.624 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 27-29 | 17049.402 | 4174.946 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 30-32 | 16267.153 | 4307.871 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original pre-filter and returned state on bun for cases 33-35 | 30107.450 | 5360.168 | 132445009976 / 132618308379 | success |
| original connected extraction loop > preserves original identities and state on node for cases 0-2 | 15511.073 | 2804.204 | 132445009976 / 132618308379 | success |

File: packages/law-practice/server/test/CitationCanonicalPinSpan.test.ts

| Exact test name | Before ms | After ms | Before / after job | After outcome |
| --- | ---: | ---: | --- | --- |
| original pin-cite-span assertions > recomputes all nine original pin-cite-span equalities on bun | 52417.099 | 31637.672 | 132445010022 / 132618308372 | success |
| original pin-cite-span assertions > recomputes the first original pin-cite-span call on node | 22567.544 | 22048.543 | 132445010022 / 132618308372 | success |

File: packages/law-practice/server/test/CitationCanonicalPageCorrection.test.ts

| Exact test name | Before ms | After ms | Before / after job | After outcome |
| --- | ---: | ---: | --- | --- |
| original parsed page correction > recomputes all twelve original page-correction equalities on bun | 39920.170 | 17630.609 | 132445010022 / 132618308379 | success |
| original parsed page correction > recomputes the first original page-correction call on node | 17220.349 | 12015.666 | 132445010022 / 132618308379 | success |

File: packages/law-practice/server/test/CitationCanonicalParsedEquality.test.ts

| Exact test name | Before ms | After ms | Before / after job | After outcome |
| --- | ---: | ---: | --- | --- |
| original parsed model equality and hash > recomputes all four original parsed equality and hash assertions on bun | 41727.284 | 25893.981 | 132445009976 / 132618308372 | success |
| original parsed model equality and hash > recomputes the first original equality cohort on node | 26658.422 | 22268.155 | 132445009976 / 132618308372 | success |

## Identical replay results

All listed after tests have explicit outcome=success; none is inferred merely from a green workflow. The corresponding *.fixtures.ts files assert pinned semantic observations: FullSpan compares source text and each independently computed full-span observation to captured operands (lines 303–329); PinSpan compares source text, Unicode-coordinate start/end and extracted substring (lines 102–116); PageCorrection compares corrected citation/page text to captured expected operands (lines 112–114); ParsedEquality compares exact source citation hashes to captured hashes and the original equality predicate (lines 130–138). ExtractionLoop compares tag, index, token, metadata, spans, full-span boundaries, year, edition and document attachment, then selected IDs, warning pairs and returned-object identities (lines 111–145, 225–234). These are exact assertions against pinned observations, not timing-only checks. Passes establish identical results for those asserted observations; they do not establish byte identity of every unasserted internal field. FullSpan additionally checks the new process-count expectations, which intentionally differ from before. No output digest was invented or substituted for these assertions.

## Remote worker run

The owner ran the replays on beep-worker through its T3 environment link (an Opus 5.5 child there, no SSH and no human step), in a disposable detached worktree of the existing clone at main `34964a3fdc0`, with bun 1.4.4 (the repo pin), one file at a time with the Bun parent (`bunx --bun vitest run test/<file>.test.ts`). The machine has 4 CPUs; the 1-minute load at each file start was 0.67 to 1.79. All 33 tests in the five files passed; the worktree was removed afterwards.

| Replay file | Tests | Vitest file duration | Slowest test | Its timeout | Ratio |
| --- | ---: | ---: | --- | ---: | ---: |
| CitationCanonicalFullSpan | 12/12 | 95.83 s | node first-call parity, 25.79 s | 180 s | 14% |
| CitationExtractionLoop | 15/15 | 60.52 s | bun cases 33-35, 6.03 s | 30 s (package default) | 20% |
| CitationCanonicalPinSpan | 2/2 | 45.86 s | bun all nine equalities, 24.07 s | 180 s | 13% |
| CitationCanonicalPageCorrection | 2/2 | 42.70 s | bun all twelve equalities, 20.91 s | 180 s | 12% |
| CitationCanonicalParsedEquality | 2/2 | 40.82 s | bun all four equalities and hashes, 18.72 s | 180 s | 10% |

The bun full-span calls are timed individually (0.97 s to 4.03 s each). FullSpan spent about 27% of its file time in transform on a cold cache in the fresh worktree.

## Criterion verdicts

- Hosted timing: **met**, on the permitted green B3 PR head, for all five families' current individual replay tests, including Node parity tests; split families have no aggregate watchdog. Main-head hosted proof remains unobserved.
- Identical asserted results: **met**, every after replay test passed exact pinned-observation assertions described above.
- Remote-worker replay recorded: **met**, all 33 tests passed on beep-worker with every slowest test at 10% to 20% of its timeout (section above).
- Combined Citation replays verification row: **met**: identical asserted results and under half the watchdog on hosted CI and on the remote worker.
