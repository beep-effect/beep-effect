# Verification evidence: gate-report-core

Measured 2026-11-19 on the wiring lane after `main` was merged in. Character counts are stdout plus
stderr, `wc -m`.

## The console, measured

| Case | Result |
| --- | --- |
| Green `test` for `@beep/glob` (273 tests), package task path | 1 line, 47 characters: `test @beep/glob: PASSED, 273/273 passed (4.8s)` |
| Green `check` for `@beep/glob`, the generated script | The verdict line, 70 characters, after Bun's one-line command echo |
| Red test with an assertion diff, fixture package | 14 lines, 520 characters: verdict, failing test with location, message, diff, path line with the log's size, pointer, verdict |
| `check` with unbuilt upstream declarations, fixture package | 5 lines: verdict, `TS6305 x1` with the fix command, path line, pointer, verdict; no compiler started |
| Root `test --unit --filter=@beep/glob`, miss then Turbo cache hit | Consoles identical by `cmp` |
| Root `check --filter=@beep/glob`, miss then Turbo cache hit | Consoles identical by `cmp` |
| Doctest and property-sweep runs of `@beep/schema` | The test record's run id is unchanged |
| `@beep/repo-utils`, whose test script chains two Vitest runs | 289 of 289 tests in one record, where the second run alone had left 8 |
| The CI lane's root call, `check` with the affected and summary flags | One console: 214 packages, `PASSED` |

The baseline for the first row was 13,450 characters through Turbo on 2026-11-18, and 820 after
`goals/gate-output-switch-on`.

The slim check entry, mean of ten runs on a built `@beep/glob`: 350 to 368 ms, against 328 ms for
the probe followed by the compiler script it replaces, and 180 ms for the compiler alone.

## Laws and where each is tested

| Law | Test |
| --- | --- |
| AC-L1, AC-L2, AC-L3 | Properties over the report schema's arbitrary in the model's `ConsoleLaws.property.test.ts`, including a 400-character scope and note-only documents |
| AC-L4 | The model's `Reducer.test.ts` and the retargeted upstream build-report cases; the adapter's `Synthesize.test.ts` for the Vitest duck typing |
| AC-L5, AC-L6 | The model's dispatch tests, and the gate-run library's history test layers |
| AC-L7 | 701 TS6305 diagnostics through the reducer fold to `x701` in at most 5 lines; the real-compiler cascade fixture in the gate-run library |
| AC-L8 | The gate-run library reads the record and log back at the printed paths and checks the size |
| AC-L9 | The repo CLI's `gate-query.test.ts` resolves every pointer of every cell against the real command tree |
| AC-L10 | The gate-run library: a recorder that fails, dies or hangs, a log stream that errors, incomplete events, a history that fails, dies or is late; a property over arbitrary event lists that the run entry never fails |

## Test counts

| Package | Tests (Node and Bun) |
| --- | ---: |
| `@beep/gate-report` | 276 |
| `@beep/repo-gate-record` | 33 |
| `@beep/repo-gate-run` | 66 |
| `@beep/repo-gate-vitest` | 93 |

Every new source file has 100% statement, function, branch and line coverage from its own
package's tests under the hosted provider (Bun with Istanbul). New files in `@beep/repo-cli` were
measured by single-file runs, and hosted Coverage Regression is green on the reviewed head.

## Static checks

- `bun run beep quality package-verify` passes for the four gate packages, `@beep/repo-cli-kit` and
  `@beep/repo-cli` (full default mode).
- `bun run beep lint identity-registry` passes with 216 packages.
- `bun run beep cache audit` reports 0 blocking findings after the re-record.
- No manifest lists an `@vitest-agent` or `@effected` package, and no MCP tool name appears in the
  four packages.
- Each of the four packages carries the dual-copyright `LICENSE` and the README `Provenance`,
  `Attribution` and `Deviations` sections.
- 213 package manifests carry the generated gate check.

## Not measured

`goals/agent-output-census` has not landed, so no census rows are cited. The first census run after
this goal should show the change in characters per green run and in log digs per run.

## Review

The three pull requests went through nine review rounds in total. The findings that changed
behaviour: repeated diagnostics collapsed into one item; the item fingerprint was not injective;
a long scope cut the verdict fields; the run entry could end with no console; a cut-off rerun
crashed the fallback; a tight budget could drop an omission line; tests that repeat a name in one
file lost the failure; the flake quarantine stopped detecting on the root check path; root gate steps stopped declaring
their Turbo digest to the lane ledger; the check hash did not cover the record's producers; a
second Vitest run in one script overwrote the test record. The local final proof also caught one
defect no review had: the root gate step repeated a Turbo flag the CI lane already passes.
