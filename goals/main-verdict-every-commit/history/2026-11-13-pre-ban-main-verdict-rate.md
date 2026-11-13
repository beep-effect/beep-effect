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

Two consequences, reported to the certainty-scorecard owner (the lane of open #3144) rather than fixed here,
since this goal builds no second census (SPEC "Stop Conditions"):

- With the default bound a 7-day window cannot read the main census at all: the pull-request job reads
  (about 2,700 for this week) come first and starve it.
- A partial main listing should mark the main stat partial (or leave `rate` empty), not report a 0% rate.

## Read 2

Pending: a retry with a larger `--max-requests` once the shared GitHub REST quota has room for about 3,000
reads (it resets hourly and other lanes draw on it). Its result is added here with the same command line.
