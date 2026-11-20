# Reproduction of the 2026-11-18 transcript audit

Dated 2026-11-19. AC4 and AC5 evidence for `goals/agent-output-census`.

## Run

```sh
bun run beep ai-metrics census --since 2026-11-11T11:56:00Z --until 2026-11-18T11:57:45Z --json --write-baseline
```

Window and selection follow the decisions `reproduction-window` and `repository-match-rule`, with
`files-scanned-counts-files-touching-the-window` amending which files count as scanned. The run read
the workstation's Claude Code and Codex transcripts in place in about one minute and wrote one file,
[`standards/agent-output-census/runs/2026-11-18T11-57-45Z--census-rules-2026-11-18.json`](../../../standards/agent-output-census/runs/2026-11-18T11-57-45Z--census-rules-2026-11-18.json),
which decodes with `CensusBaselineFile`. The file and the JSON output hold counts, sizes, shares,
fitted constants, literal class names, the window timestamps and version tags only: no home path, no
path at all, no command or transcript text.

The corpus is live, so a later run on the same window can differ. About ninety minutes after the
baseline run, the same command counted 29 Codex sessions instead of 32 (139 files instead of 145):
six Codex session files had left the sessions directory. The Claude figures were unchanged. The
baseline file is the record of the run that was made, and the comparison below uses it.

## Reference

Two references, both aggregates:

- the rounded tables of
  [`transcript-audit.md`](../../../explorations/agent-verification-output/research/transcript-audit.md);
- the full-precision per-class totals, token totals, session counts and calibration fit of the
  reference run's summary, read aggregate-only from the authoring session's scratch directory, which is
  not tracked.

Tolerance (AC4): counts and totals within 2% relative, shares within 1.5 percentage points, chars per
token within 0.05. Where the audit printed a rounded figure the comparison uses it as printed and says
so. The verification line-pass total, filter-habit shares, turn classes and offender figures exist only
in the audit's prose, so those rows compare with the rounded figure.

## Result

The method reproduces. Active contexts (223), sessions (127), subagents (96), Codex sessions (32),
API calls, context tokens, Codex token totals, every tool-output class's characters, result count and
carried char-turns, every share of tool output and of context read, the verification totals by
harness, the turn classes, the dig follow-up distribution, the line-class shares and chars per token
(2.297 against 2.281) are all within tolerance. Most match to the character.

The rows outside tolerance fall into five groups. Each is a named rule difference recorded as a
decision file:

| Group | Rows | Decision |
| --- | ---: | --- |
| Files scanned: modification-time selection cannot be rebuilt later | 1 | [files-scanned-counts-files-touching-the-window](../decisions/2026-11-19-files-scanned-counts-files-touching-the-window.md) |
| Compaction boundaries: the audit's count did not survive | 1 | [compaction-boundaries-count-context-resets](../decisions/2026-11-19-compaction-boundaries-count-context-resets.md) |
| Calibration sample count: the reference sampled calls before the window | 1 | [calibration-samples-are-calls-in-the-window](../decisions/2026-11-19-calibration-samples-are-calls-in-the-window.md) |
| Pipe habit shares: the reference capture truncated commands at 600 characters | 18 | [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| Offender counts: the audit's ad-hoc queries did not survive | 3 | [offender-rules-are-written-down](../decisions/2026-11-19-offender-rules-are-written-down.md) |

For every later goal, the baseline is the census's own run file, not the audit's prose. The audit's
pipe-habit shares undercount the census's by 3 to 28 points; a goal that moves those rows compares
census run with census run.

## Row by row

| Row | Census | Reference | Difference | Result |
| --- | ---: | ---: | ---: | --- |
| claude files scanned | 226 | 342 | -33.92% | outside: [files-scanned-counts-files-touching-the-window](../decisions/2026-11-19-files-scanned-counts-files-touching-the-window.md) |
| claude contexts active | 223 | 223 | 0.00% | within |
| claude sessions | 127 | 127 | 0.00% | within |
| claude subagents | 96 | 96 | 0.00% | within |
| compaction boundaries | 113 | 104 | 8.65% | outside: [compaction-boundaries-count-context-resets](../decisions/2026-11-19-compaction-boundaries-count-context-resets.md) |
| codex sessions | 32 | 32 | 0.00% | within |
| session API calls | 34,085 | 34,085 | 0.00% | within |
| subagent API calls | 16,794 | 16,793 | 0.01% | within |
| session context tokens | 14,832,055,138 | 14,832,055,138 | 0.00% | within |
| subagent context tokens | 6,414,037,965 | 6,413,559,331 | 0.01% | within |
| session output tokens | 23,296,302 | 23,296,302 | 0.00% | within |
| codex input tokens | 524,160,457 | 524,160,457 | 0.00% | within |
| codex cached input tokens | 516,298,368 | 516,298,368 | 0.00% | within |
| claude session tool chars (audit rounded) | 48,797,267 | 48,800,000 | -0.01% | within |
| claude subagent tool chars (audit rounded) | 42,289,705 | 42,300,000 | -0.02% | within |
| claude all tool chars | 91,086,972 | 91,084,251 | 0.00% | within |
| claude all carried | 16,730,026,094 | 16,729,110,184 | 0.01% | within |
| claude ci-logs chars | 1,064,354 | 1,064,354 | 0.00% | within |
| claude ci-logs results | 790 | 790 | 0.00% | within |
| claude ci-logs carried | 224,011,788 | 224,011,788 | 0.00% | within |
| claude ci-logs share of tool output | 1.17 | 1.17 | -0.00 pp | within |
| claude ci-logs share of context read | 0.46 | 0.46 | -0.00 pp | within |
| claude yeet chars | 4,275,245 | 4,275,245 | 0.00% | within |
| claude yeet results | 4,299 | 4,299 | 0.00% | within |
| claude yeet carried | 729,309,438 | 729,309,438 | 0.00% | within |
| claude yeet share of tool output | 4.69 | 4.69 | -0.00 pp | within |
| claude yeet share of context read | 1.49 | 1.5 | -0.01 pp | within |
| codex yeet chars | 323,841 | 323,841 | 0.00% | within |
| claude ci-status chars | 763,878 | 763,878 | 0.00% | within |
| claude ci-status results | 1,136 | 1,136 | 0.00% | within |
| claude ci-status carried | 163,411,327 | 163,411,327 | 0.00% | within |
| claude ci-status share of tool output | 0.84 | 0.84 | -0.00 pp | within |
| claude ci-status share of context read | 0.33 | 0.34 | -0.00 pp | within |
| codex ci-status chars | 226,890 | 226,890 | 0.00% | within |
| claude quality chars | 830,587 | 830,587 | 0.00% | within |
| claude quality results | 1,037 | 1,037 | 0.00% | within |
| claude quality carried | 120,606,989 | 120,606,989 | 0.00% | within |
| claude quality share of tool output | 0.91 | 0.91 | -0.00 pp | within |
| claude quality share of context read | 0.25 | 0.25 | -0.00 pp | within |
| codex quality chars | 100,755 | 100,755 | 0.00% | within |
| claude test chars | 3,716,767 | 3,716,110 | 0.02% | within |
| claude test results | 3,863 | 3,862 | 0.03% | within |
| claude test carried | 654,772,734 | 654,622,666 | 0.02% | within |
| claude test share of tool output | 4.08 | 4.08 | 0.00 pp | within |
| claude test share of context read | 1.34 | 1.35 | -0.01 pp | within |
| codex test chars | 1,193,551 | 1,193,551 | 0.00% | within |
| claude check chars | 2,295,816 | 2,295,816 | 0.00% | within |
| claude check results | 1,624 | 1,624 | 0.00% | within |
| claude check carried | 487,996,524 | 487,992,610 | 0.00% | within |
| claude check share of tool output | 2.52 | 2.52 | -0.00 pp | within |
| claude check share of context read | 1 | 1.01 | -0.01 pp | within |
| codex check chars | 1,108,605 | 1,108,605 | 0.00% | within |
| claude lint chars | 2,248,872 | 2,248,872 | 0.00% | within |
| claude lint results | 1,679 | 1,679 | 0.00% | within |
| claude lint carried | 325,164,579 | 325,155,232 | 0.00% | within |
| claude lint share of tool output | 2.47 | 2.47 | -0.00 pp | within |
| claude lint share of context read | 0.67 | 0.67 | -0.00 pp | within |
| codex lint chars | 316,035 | 316,035 | 0.00% | within |
| claude docgen chars | 211,307 | 211,307 | 0.00% | within |
| claude docgen results | 160 | 160 | 0.00% | within |
| claude docgen share of tool output | 0.23 | 0.23 | -0.00 pp | within |
| codex docgen chars | 268,527 | 268,527 | 0.00% | within |
| claude turbo chars | 1,051,471 | 1,051,471 | 0.00% | within |
| claude turbo results | 663 | 663 | 0.00% | within |
| claude turbo carried | 243,406,235 | 243,406,235 | 0.00% | within |
| claude turbo share of tool output | 1.15 | 1.15 | -0.00 pp | within |
| claude turbo share of context read | 0.5 | 0.5 | -0.00 pp | within |
| claude install chars | 236,028 | 236,028 | 0.00% | within |
| claude install results | 222 | 222 | 0.00% | within |
| claude install share of tool output | 0.26 | 0.26 | -0.00 pp | within |
| claude beep-other chars | 2,171,888 | 2,171,888 | 0.00% | within |
| claude beep-other results | 1,922 | 1,922 | 0.00% | within |
| claude beep-other carried | 415,397,222 | 415,389,562 | 0.00% | within |
| claude beep-other share of tool output | 2.38 | 2.38 | -0.00 pp | within |
| claude beep-other share of context read | 0.85 | 0.86 | -0.01 pp | within |
| codex beep-other chars | 689,340 | 689,340 | 0.00% | within |
| claude gh chars | 3,270,369 | 3,270,369 | 0.00% | within |
| claude gh results | 2,151 | 2,151 | 0.00% | within |
| claude gh carried | 553,549,467 | 553,549,467 | 0.00% | within |
| claude gh share of tool output | 3.59 | 3.59 | -0.00 pp | within |
| claude gh share of context read | 1.13 | 1.14 | -0.01 pp | within |
| codex gh chars | 180,876 | 180,876 | 0.00% | within |
| claude git chars | 7,920,396 | 7,920,396 | 0.00% | within |
| claude git results | 4,145 | 4,145 | 0.00% | within |
| claude git carried | 1,200,592,259 | 1,200,583,510 | 0.00% | within |
| claude git share of tool output | 8.7 | 8.7 | -0.00 pp | within |
| claude git share of context read | 2.46 | 2.48 | -0.02 pp | within |
| codex git chars | 2,498,232 | 2,498,232 | 0.00% | within |
| claude search-read chars | 41,326,556 | 41,324,439 | 0.01% | within |
| claude search-read results | 16,807 | 16,805 | 0.01% | within |
| claude search-read carried | 8,016,990,314 | 8,016,377,423 | 0.01% | within |
| claude search-read share of tool output | 45.37 | 45.37 | 0.00 pp | within |
| claude search-read share of context read | 16.43 | 16.54 | -0.11 pp | within |
| codex search-read chars | 4,576,813 | 4,576,813 | 0.00% | within |
| claude other-shell chars | 633,813 | 633,813 | 0.00% | within |
| claude other-shell results | 1,153 | 1,153 | 0.00% | within |
| claude other-shell share of tool output | 0.7 | 0.7 | -0.00 pp | within |
| codex other-shell chars | 540,417 | 540,417 | 0.00% | within |
| claude read-tool chars | 13,691,633 | 13,691,633 | 0.00% | within |
| claude read-tool results | 1,361 | 1,361 | 0.00% | within |
| claude read-tool carried | 2,205,671,490 | 2,205,523,868 | 0.01% | within |
| claude read-tool share of tool output | 15.03 | 15.03 | -0.00 pp | within |
| claude read-tool share of context read | 4.52 | 4.55 | -0.03 pp | within |
| claude persisted-reread chars | 732,865 | 732,865 | 0.00% | within |
| claude persisted-reread results | 17 | 17 | 0.00% | within |
| claude persisted-reread carried | 140,373,882 | 140,373,882 | 0.00% | within |
| claude persisted-reread share of tool output | 0.8 | 0.8 | -0.00 pp | within |
| claude persisted-reread share of context read | 0.29 | 0.29 | -0.00 pp | within |
| claude other-tool chars | 4,599,099 | 4,598,495 | 0.01% | within |
| claude other-tool results | 8,298 | 8,295 | 0.04% | within |
| claude other-tool carried | 1,080,553,912 | 1,080,480,010 | 0.01% | within |
| claude other-tool share of tool output | 5.05 | 5.05 | 0.00 pp | within |
| claude other-tool share of context read | 2.21 | 2.23 | -0.02 pp | within |
| claude verification chars | 16,740,353 | 16,739,696 | 0.00% | within |
| claude verification share of context read | 6.22 | 6.27 | -0.04 pp | within |
| codex all tool chars | 12,191,573 | 12,191,573 | 0.00% | within |
| codex verification chars | 3,681,785 | 3,681,785 | 0.00% | within |
| calibration samples | 6,704 | 9,038 | -25.82% | outside: [calibration-samples-are-calls-in-the-window](../decisions/2026-11-19-calibration-samples-are-calls-in-the-window.md) |
| chars per token | 2.2969 | 2.281 | 0.02 | within |
| calibration intercept (informational) | 119.8785 | 126.8044 | -6.93 | within |
| yeet runs | 4,404 | 4,404 | 0.00% | within |
| yeet tail (audit rounded to 1%) | 56.18 | 42 | 14.18 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| yeet head (audit rounded to 1%) | 32.79 | 22 | 10.79 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| yeet grep (audit rounded to 1%) | 54.9 | 45 | 9.90 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| yeet unfiltered (audit rounded to 1%) | 3.66 | 4 | -0.34 pp | within |
| test runs | 4,163 | 4,162 | 0.02% | within |
| test tail (audit rounded to 1%) | 34.28 | 21 | 13.28 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| test head (audit rounded to 1%) | 58.25 | 37 | 21.25 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| test grep (audit rounded to 1%) | 59.26 | 36 | 23.26 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| test unfiltered (audit rounded to 1%) | 6.27 | 6 | 0.27 pp | within |
| check runs | 1,905 | 1,905 | 0.00% | within |
| check tail (audit rounded to 1%) | 36.22 | 23 | 13.22 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| check head (audit rounded to 1%) | 54.91 | 27 | 27.91 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| check grep (audit rounded to 1%) | 44.09 | 20 | 24.09 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| check unfiltered (audit rounded to 1%) | 6.19 | 6 | 0.19 pp | within |
| lint runs | 1,781 | 1,781 | 0.00% | within |
| lint tail (audit rounded to 1%) | 43.85 | 34 | 9.85 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| lint head (audit rounded to 1%) | 45.82 | 39 | 6.82 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| lint grep (audit rounded to 1%) | 34.92 | 29 | 5.92 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| lint unfiltered (audit rounded to 1%) | 10.95 | 11 | -0.05 pp | within |
| quality runs | 1,106 | 1,106 | 0.00% | within |
| quality tail (audit rounded to 1%) | 58.59 | 46 | 12.59 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| quality head (audit rounded to 1%) | 36.44 | 26 | 10.44 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| quality grep (audit rounded to 1%) | 48.01 | 39 | 9.01 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| quality unfiltered (audit rounded to 1%) | 2.53 | 3 | -0.47 pp | within |
| ci-logs runs | 805 | 805 | 0.00% | within |
| ci-logs tail (audit rounded to 1%) | 17.64 | 15 | 2.64 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| ci-logs head (audit rounded to 1%) | 81.49 | 68 | 13.49 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| ci-logs grep (audit rounded to 1%) | 69.19 | 62 | 7.19 pp | outside: [filter-habits-read-the-whole-command](../decisions/2026-11-19-filter-habits-read-the-whole-command.md) |
| ci-logs unfiltered (audit rounded to 1%) | 0.25 | 0 | 0.25 pp | within |
| runs redirected to a file (habit) (audit rounded; turn pass basis differs) | 16.96 | 18 | -1.04 pp | within |
| runs redirected to a file (turn pass) (audit rounded) | 17.57 | 18 | -0.43 pp | within |
| rerun-no-edit turns | 132 | 132 | 0.00% | within |
| rerun-no-edit share of turns | 0.26 | 0.3 | -0.04 pp | within |
| rerun-no-edit share of context read | 0.27 | 0.3 | -0.03 pp | within |
| run-verification turns | 10,109 | 10,117 | -0.08% | within |
| run-verification share of turns | 19.87 | 19.9 | -0.03 pp | within |
| run-verification share of context read | 21.56 | 21.6 | -0.04 pp | within |
| dig-captured-log turns | 1,533 | 1,533 | 0.00% | within |
| dig-captured-log share of turns | 3.01 | 3 | 0.01 pp | within |
| dig-captured-log share of context read | 3.4 | 3.4 | -0.00 pp | within |
| fetch-ci-log turns | 747 | 747 | 0.00% | within |
| fetch-ci-log share of turns | 1.47 | 1.5 | -0.03 pp | within |
| fetch-ci-log share of context read | 1.61 | 1.6 | 0.01 pp | within |
| runs with >=1 dig (audit rounded) | 8.87 | 9 | -0.13 pp | within |
| runs with >=3 digs (audit rounded) | 1.47 | 1 | 0.47 pp | within |
| max digs after one run | 11 | 11 | 0.00% | within |
| verification output chars (line pass) (audit rounded) | 20,422,138 | 20,400,000 | 0.11% | within |
| signal | 28.85 | 28.9 | -0.05 pp | within |
| other (unclassified) | 60.4 | 60.4 | 0.00 pp | within |
| zsh-noise | 2.66 | 2.7 | -0.04 pp | within |
| script-echo | 2.53 | 2.5 | 0.03 pp | within |
| dup-line | 2.49 | 2.5 | -0.01 pp | within |
| turbo chrome+prefix | 1.77 | 1.7 | 0.07 pp | within |
| runner-chrome | 1.17 | 1.2 | -0.03 pp | within |
| TS6305 lines | 819 | 701 | 16.83% | outside: [offender-rules-are-written-down](../decisions/2026-11-19-offender-rules-are-written-down.md) |
| TS6305 share of check/lint/quality | 4.51 | 5.1 | -0.59 pp | within |
| Tests N passed lines | 3,782 | 3,206 | 17.97% | outside: [offender-rules-are-written-down](../decisions/2026-11-19-offender-rules-are-written-down.md) |
| gate-table repeats share of yeet (audit 'about') | 3.31 | 6 | -2.69 pp | outside: [offender-rules-are-written-down](../decisions/2026-11-19-offender-rules-are-written-down.md) |
| json envelopes share of yeet (audit 'about') | 7.29 | 8 | -0.71 pp | within |
| help global flags share of yeet (audit 'at least') | 2.03 | 2 | 0.03 pp | within |

181 rows; 157 within tolerance; 24 outside, each attributed.
