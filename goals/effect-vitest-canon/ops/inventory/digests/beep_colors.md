# @beep/colors P1 four-lens digest

Root accepted this package’s source inventory after complete reads, strict row
validation and source/artifact hash checks. Full P1 remains incomplete; P2 is gated.

## Counts


| Lens | Rows | Review items | Coverage | Major | Minor | Info |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| resource | 1 | 0 | 1 | 0 | 0 | 1 |
| flake | 1 | 0 | 1 | 0 | 0 | 1 |
| property | 1 | 1 | 0 | 1 | 0 | 0 |
| observability | 1 | 0 | 1 | 0 | 0 | 1 |


Severity: {"major": 1, "info": 3}. Independent rows: 4. Scanner candidates reviewed separately: 8. No scanner row closes here.

## Files (top ten by row count)

- `packages/foundation/capability/colors/test/index.test.ts`: 4 rows; complete read 1–202, 5476 census bytes, SHA256 `71ed0b5ea7d2fe6f4f453864fbde3fd84610bf90ab0f12c8f4d40e320659184d`.

## Topology and native boundaries

No layers or scoped resources; ProcessLike values are generated or supplied explicitly. Module singleton captures runtime support once, but the test compares the exported same-instance flag rather than imposing a host-dependent value.

No filesystem or native lifecycle subject. Native property generation must retain the full ProcessLike schema including optional env/argv/stdout fields; do not narrow it to simplify trials.

EV001/006/007 cover runner and assertion syntax. L-PROP-03 specifically records absent run/seed options in both generated laws. They are not vacuous: each decoding guard has a preceding assertion; preserve both guards and full equality until canonical helpers establish narrowing.

## Findings and preservation

File-specific coverage-only explanations remain in the four lens JSONL files.
Review items include constraints on safe migration, not only defects.

- `L-PROP-03` `packages/foundation/capability/colors/test/index.test.ts:109-163` (major, property-floor-seed-loss): Both Arbitrary.checkEffect calls omit CheckOptions; no fcRuns import. Alongside EV007 migrate both original laws using ProcessLike and { arbitrary: fcRuns(n) }; preserve override polarity, round-trip equality and CI 400/20260708.

## Timing and hosted limits

Retained Node22.22.3/Bun1.4.2/Vitest4.1.11 cohort: accepted-node-command-baseline; 15 registrations; exit 0; whole-command 4.020791899999949 seconds. Source/config context is retained in [timing context](../timings/context/baseline/beep_colors.json) and hashed public timing inputs. No rerun or comparison speedup. Hosted history: 0 mapped observations in 0 jobs; categories {}. Across the frozen 527 failed-run history, 21 logs are unavailable and one downloaded cause unresolved. Zero mapped observations is not absence of failures. No source-head comparison or reproduction establishes a current flake; no flakyTest proposal.

## Proposed P2 sequence and uncertainty

Scope → assertions → property → flake → observability. Preserve every original test, operand, polarity, timeout and native subject; properties retain explicit repository floor/seed, no weaker test schema. Resolve scanner candidates alongside the independent constraints above, then collect authorized package/runtime proofs and comparable timing. This audit performs no tests and grants no exceptions. Source-only hazards are not claimed observed failures. P2 remains gated.

## P2 implementation checkpoint

Implementation `94f19c393b9333bb411b9e10bf59434322c2b847` fixes all eight detector rows and the one property
judgment. Coverage-only resource, flake and observability rows are retained.
No scoped resource or live clock was introduced. Both laws retain the full
ProcessLike generator, original override operands, and original value equality.
Canonical Some presence checks deliberately remain separate from `toEqual`: the
generator can emit null-prototype environment objects, and strict payload equality
would strengthen the previous law.

All 15 tests pass under Node and Bun, including explicit 400-run / 20260708 seed
checks. Package audit and docgen pass. The selected package has zero remaining
detector findings; the full syntax ratchet introduces zero findings. The four
unrelated resolved rows were left untouched.

The configured Node timing sample records 2939.02 ms reporter time and 3.505 s
whole-command time, with workstation load/pressure and source hashes retained.
The older baseline used another Node/Vitest cohort; no causal speedup is claimed.
Publication, hosted checks, review and prerequisite integration remain separate.
