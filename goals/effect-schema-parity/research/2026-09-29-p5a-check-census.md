# P5 part a: single-checker check-census gate (2026-09-29)

P5 asks for `quality check-census` extended with instantiations and check
time, a committed baseline measured single-threaded for `@beep/schema`,
`@beep/repo-cli` and `@beep/law-practice-domain`, and one or two upstream
typeperf suites mirrored (SPEC §Phase Contract P5; goal-time rows 2026-09-16
and 2026-09-29). This note records what part a shipped and how it was
measured.

## Design

Schema first, then service, then implementation, all in
`packages/tooling/tool/cli/src/commands/Quality/CheckCensusGate.ts`:

- `CheckCensusSample` holds `instantiations`, `types` and `checkTimeMs`.
  `CheckCensusBaselineRow` adds the program's `name` and `tsconfig`.
- `CheckCensusBaseline` is the committed document at
  `standards/check-census.regression-baseline.jsonc`. It carries
  `schemaVersion: "check-census-baseline/v1"`, `measuredAt`, `commit`,
  `dirtyWorktree`, `compiler` (the `tsc --version` string), `command`,
  `checkTimeBandPercent: 5`, and two row sections: `packages` and
  `typeperfFixtures`.
- The verdicts are LiteralKits. `CheckCensusInstantiationVerdict` is
  `increase | unchanged | decrease` and `CheckCensusCheckTimeVerdict` is
  `within-band | slower | faster`. `CheckCensusComparison` and
  `CheckCensusGateReport` are the report types; the gate report is also
  embedded as `gate` in the census `--output-json` report.
- The tagged errors are `CheckCensusSampleRefused` (the run printed an
  `error TS` line or exited non-zero) and `CheckCensusMetricMissing` (no
  parsable `Instantiations`, `Types` or `Check time` line).
- The `CheckCensusSampler` service (`Context.Service`) exposes
  `compilerVersion` and `sample({ name, tsconfig })`. The live `make`
  spawns `node_modules/.bin/tsc -p <cfg> --noEmit --extendedDiagnostics
  --singleThreaded --tsBuildInfoFile <fresh>` through the census's existing
  `runCaptured` (ChildProcessSpawner) runner. The build-info file lives in
  a scoped temp directory under `.beep/quality/`, which is git-ignored and
  outside `/tmp`, so incremental state is never reused. Tests provide a
  fixed sampler.
- Samples run sequentially (`concurrency: 1`) for both the gate and the
  baseline write, so programs never compete for check time.

Verdict rules:

| Signal | Rule | Effect |
| --- | --- | --- |
| Single-checker instantiations | any increase over the row | FAIL, exit non-zero |
| Compiler string | differs from the baseline's `compiler` | FAIL, re-measure with `--write-baseline` |
| Check time | more than 5% slower than the row | advisory line, never a failure |
| Instantiations | decrease | `tighten` hint naming `--write-baseline` |
| Sample | `error TS` in output or non-zero exit | refused; the gate fails and a write is aborted |

CLI flags on `bun run beep quality check-census`:

- `--baseline <path>` sets the baseline path (default
  `standards/check-census.regression-baseline.jsonc`). The gate header and
  the failure message print this path.
- `--write-baseline` re-measures every committed row (the built-in defaults
  when no baseline exists yet) and rewrites the document. It skips the
  overlay census.
- `--gate-only` skips the overlay census and runs only the gate.
- `--filter <text>` narrows both census packages and gate rows by name
  substring.

The overlay census also records default-mode (four-checker) `instantiations`,
`types` and `checkTimeMs` per program and per delta. Those values are
advisory: under the 2026-09-29 ruling only the single-checker count is
partition-independent.

## Why the typeperf fixtures are compile-only

`standards/architecture/DECISIONS.md` "2026-08-03: Retire The Tstyche
Type-Test Surface" removed `*.tst.ts` outside ecosystem members, and upstream
`effect/typeperf` is compile-only anyway: it measures instantiation deltas
with no assertion library. The mirror is three programs under
`packages/foundation/modeling/schema/test/fixtures/typeperf/`. Each has its
own `tsconfig.<name>.json` and is one gate row:

- `baseline.ts` is the suite warmup (import and touch `LiteralKit`), which
  mirrors `typeperf/suites/schema/baseline.ts`.
- `literal-kit-tagged-union.ts` mirrors `fixtures/tagged-union.ts`: the same
  four cases through `LiteralKit.toTaggedUnion("kind")`. It uses
  `S.FiniteFromString` in place of `S.NumberFromString`, because the Effect
  language service rejects the latter (TS377098). As a result its absolute
  count is not directly comparable to upstream's.
- `literal-kit-keyed-api.ts` covers the keyed value API (`Enum`, `is`,
  `$match`) over six literals.

The marginal cost of each behavior is the fixture row minus the
`baseline` row: +3,197 instantiations for the tagged union and +679 for the
keyed API.

## Measured baseline

Measured with `bun run beep quality check-census --write-baseline` after
`bunx turbo run build --filter='@beep/repo-cli^...'
--filter='@beep/law-practice-domain^...' --filter='@beep/schema^...'`.
Compiler `7.0.2+effect-tsgo.0.45.0`, at base `0015b0e041` plus this change
uncommitted (`dirtyWorktree: true`), load average 6 to 9. Check times in the
table are that loaded run; instantiations and types were identical in every
run of the final tree.

| Row | Instantiations | Types | Check time (ms) |
| --- | ---: | ---: | ---: |
| `@beep/schema` | 706,043 | 201,092 | 1,145 |
| `@beep/repo-cli` | 4,172,933 | 1,072,075 | 11,844 |
| `@beep/law-practice-domain` | 874,541 | 259,729 | 1,379 |
| `@beep/schema#typeperf/baseline` | 62,827 | 27,962 | 108 |
| `@beep/schema#typeperf/literal-kit-tagged-union` | 66,024 | 28,667 | 121 |
| `@beep/schema#typeperf/literal-kit-keyed-api` | 63,506 | 28,110 | 100 |

An earlier session measured `@beep/schema` at 710,979. The gap to 706,043 is
the upstream dists rebuilt at the lane's head. The committed number is the
one from the current tree.

## End-to-end runs

`bun run beep quality check-census --gate-only` on the unchanged tree right
after a write exited 0. Instantiations and types matched on all six rows.
Check time moved −4.1% to +13%, with three advisory lines (`@beep/schema`
+11.5%, `@beep/repo-cli` +10.1%, `@beep/schema#typeperf/literal-kit-keyed-api`
+13%) and no failure.

The negative proof used a scratch baseline copy
(`--baseline .beep/p5a-negative-baseline.jsonc --filter typeperf`). One row
was lowered by 27 and one raised by 94. The gate printed `FAIL
@beep/schema#typeperf/baseline: single-checker instantiations increased by
27.` and a `tighten` line for the other row, then exited 1.

Check time on a loaded shared workstation moves well outside the 5% band on
an unchanged tree (friction ledger, 2026-09-29). That noise is why the band
stays advisory and instantiations remain the hard signal.

## Verification commands

- `bunx turbo run check --filter=@beep/repo-cli --filter=@beep/schema --concurrency=4`
- `bunx --bun vitest run test/check-census-gate.test.ts test/check-census.test.ts`
  (Bun), and `npx vitest run` on the same files (Node 24)
- `bunx --bun vitest run test/knowledge-semantic-delta.test.ts`: registered
  commands stay statically derivable
- `bun run lint:oxlint`, `bun run beep lint schema-first`,
  `bun run beep lint effect-vitest` (introduced 0)
- `bun run beep ci lane fallow --base origin/main`: audit, dead-code and
  health each report introduced 0
- `bun run beep quality knip` (introduced 0),
  `bun run beep ci lane jsdoc-ratchet` (increased 0)
- `bun run beep quality package-verify @beep/repo-cli --quick`,
  `bun run docgen:local`
