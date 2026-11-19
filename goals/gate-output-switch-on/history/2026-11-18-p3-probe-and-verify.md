# P3 and P4 evidence: the unbuilt-dependency probe, and verification of the whole goal

Measured 2026-11-18 on the probe lane after the P1 and P2 slices were merged into it. Character
counts are stdout plus stderr, `wc -m`.

## AC8: one line for an unbuilt tree

Package `@beep/schema`, five referenced projects. For the unbuilt rows two upstream declaration
indexes (`@beep/identity`, `@beep/utils`) were moved aside and restored afterwards.

| Run | Tree | Exit | Characters | Lines | Seconds |
| --- | --- | ---: | ---: | ---: | ---: |
| `bun run beep:check` (the compiler alone, as before this goal) | unbuilt | 2 | 134,905 | 711 | 0.24 |
| `bun run check` | unbuilt | 1 | 269 | 3 | 0.15 |
| `beep-cli check` | unbuilt | 1 | 175 | 1 | 0.78 |
| `bun run check` | built | 0 | 165 | 3 | 0.62 |
| `beep-cli check` | built | 0 | 167 | 3 | 1.13 |
| `beep-cli quality check-probe` alone | built | 0 | 0 | 0 | 0.14 |

The probe's line, through either entry point:

```text
[beep-cli] @beep/schema check: unbuilt upstream declarations: 2 missing (first: ../identity/dist/index.d.ts); build them with: bun x turbo run build --filter=@beep/schema^...
```

Through `bun run check` Bun adds its command echo before the line and its exit line after it;
those two lines are Bun's, and the probe prints one. No compiler starts in either unbuilt run. On a
built tree the probe prints nothing and the check runs as before.

The compiler run on the unbuilt tree also did damage. It emitted the declarations of `@beep/schema`
itself with degraded types, and the next check of `@beep/repo-cli` failed with 82 unrelated errors
until `@beep/schema` was rebuilt. The probe stops before that write.

An earlier measurement on the same package with every upstream unbuilt printed 216,967 characters
in 1,348 lines from the compiler, against the same 269 from `bun run check`.

Tests: `check-probe.test.ts` in `@beep/repo-cli`, nine tests over a fixture package with one
unbuilt reference, covering the slim entry, the task path and the built case.

## AC9: cache policy

`bun run beep cache audit` reports 0 blocking findings on the merged tree. Re-recorded subjects:
the root subject (twice on the P1 lane, once here), 207 packages for the generated `check`, and
`@beep/repo-cli`, `@beep/contract-kit` and `@beep/infra-ci-runners` after base merges. Each record has a reviewed request
under `docs/reports`.

## AC10: packages verified

`bun run beep quality package-verify <package>` on the merged tree:

| Package | lint | audit | docgen |
| --- | --- | --- | --- |
| `@beep/runtime-env` | ok, 0.1 s | ok, 20.6 s | ok, 2.3 s |
| `@beep/cli-kit` | ok, 0.2 s | ok, 31.7 s | ok, 3.6 s |
| `@beep/repo-cli-kit` | ok, 0.2 s | ok, 27.8 s | ok, 6.3 s |
| `@beep/repo-cli` | ok, 2.5 s | ok, 231.7 s | ok, 55.5 s |

## Before and after, all six fixes

| Fix | Measured case | Before | After |
| --- | --- | ---: | ---: |
| 1 | Green `@beep/glob` test run through Turbo, one agent marker set | 14,238 | 820 |
| 2 | The same task as a cache hit through the task path | 15,960 (miss) | 1,098, no test summary |
| 3 | A subcommand's `--help` | 2,490 | 1,911 |
| 4 | Lane-run and GitHub-check envelopes on stdout, side channel set | 2 lines per battery | 0 |
| 5 | Readiness-monitor submit JSON on the console | 1 line | 0, kept in the step log |
| 6 | `check` in a package with two unbuilt upstream projects | 134,905 | 175 or 269 |

The P1 numbers are in `history/2026-11-18-p1-agent-signal-measurements.md` in this packet. The
character totals that remain in fixes 1 and 2 are Turbo's own header, footer and line prefix, Bun's
command echo and the task path's step banner. Removing them is the console contract of
`goals/gate-report-core`.

`agent-output-census` has not landed, so this closeout cites no census rows.
