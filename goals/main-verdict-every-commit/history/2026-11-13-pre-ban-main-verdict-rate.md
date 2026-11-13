# Pre-ban main verdict rate (7 days before the cancel ban)

The "before" read of the SPEC acceptance criterion on the main verdict rate: the 7 UTC days before the cancel
ban (2026-11-03 to 2026-11-09; checkpoint `cancel-ban-start-anchor`), read from the certainty scorecard
(`beep ci certainty`, #3118) at `origin/main` 7a462a27d4f.

## Read 1: refused (api-partial), 2026-11-13T00:55Z

```sh
bun run beep ci certainty --since 2026-11-03 --until 2026-11-10 --json
```

Result: exit 1, `Certification refused: api-partial. Pass --preview to accept an uncertified report.` The JSON
report was still written:

| Field | Value |
| --- | --- |
| `capturedAt` | 2026-11-13T00:55:10Z |
| `certified` / `refusals` | false / `api-partial` |
| `requestCount` | 2709 (reads attempted, including the ones refused at the bound) |
| `partialReads` | 436, every one "GitHub request bound of 1500 reached before ..." (the default `--max-requests`) |
| heads by state | green 349, red 237, cancelled 528, held 25, api-partial 444 |
| `main` | 283 non-docs commits, 109 docs commits, `verdicts` 0, `noRun` 283, `rate` 0 |
| `admissionToHeavy` | n 1166, p50 2.37 min (pre-#3144 definition) |

**The main block is not a reading.** The capture lists the main push runs after it has read the pull-request
job lists; the bound was exhausted first, so the main listing failed (`mainListingPartial`) and every main
commit was folded with no runs, as `no-run`. A spot check confirms it: main commit fda98a2c4bd (2026-11-09
23:08Z) has Check push run 42717956683 (failure), which the report lists as `no-run`. The refusal guards the
certification, but the JSON's `main` block still prints `rate` 0 with no partial marker of its own.

Both defects were reported to the certainty-scorecard owner rather than fixed here, since this goal builds no
second census (SPEC "Stop Conditions"), and #3168 (3b85830d051) fixed them: the push listing is now read before
the pull-request job reads, and an incomplete listing marks every main commit `unread` with no `rate` instead
of `no-run` (certainty-scorecard decision `main-listing-unread`).

## Read 2: main census complete, 2026-11-13T03:44Z

At `origin/main` 2968573cf50, after #3168. Since the main listing is read first, a small request bound reads the
whole main census and only stops the pull-request job reads, which this note does not need:

```sh
bun run beep ci certainty --since 2026-11-03 --until 2026-11-10 --max-requests 200 --preview --json
```

Result: exit 0 under `--preview`; `certified` false with refusal `api-partial`, from pull-request heads only
(1,898 partial job reads at the bound). The main block is complete: `unread` 0 and `noRun` 0.

| Field | Value |
| --- | --- |
| `capturedAt` | 2026-11-13T03:44:56Z |
| Non-docs first-parent commits (`commits`) | 283 (docs commits 109) |
| Completed verdicts (`verdicts`) | 70: 28 `success`, 42 `failure` |
| `cancelled` / `noRun` / `open` / `unread` | 213 / 0 / 0 / 0 |
| **Main verdict rate (`rate`)** | **0.247 (70 of 283)** |

This is the "7 days before the cancel ban" read of the SPEC acceptance criterion: 24.7% of non-docs main SHAs
got a completed hosted verdict over 2026-11-03..09, against the plan's 95% bar and D7's earlier 13% sample.
Every miss is a cancelled push run; none is missing or still pending. The PR-head latency rows of this report
are not read (their job reads stopped at the bound) and nothing here uses them. The "7 days after" read
(2026-11-11..17) is due once that window closes and the runs settle.
