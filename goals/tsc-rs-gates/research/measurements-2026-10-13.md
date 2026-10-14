# tsc-rs vs the Effect-patched tsgo: measurements (2026-10-13)

Measured on the operator workstation (64 cores, 125 GiB) against the repo at
main `6468d0a378`, with `@effect/tsgo` 0.47.2 (the version then pinned) and
tsc-rs 0.6.0 installed under `~/.cache/beep/tsc-rs-probe/`. tsc-rs 0.6.0 is
pinned to `typescript@7.1.0-dev.20261008.1` and compiles in the Effect rules of
`@effect/tsgo` 0.51.1. Raw outputs lived in the session scratchpad
(`tscrs-full/`, `turbo-bench/`, `tsgo052-census/`); the numbers below are the
retained summary.

## Per project, sequential, one process at a time

| Lane | tsgo 0.47.2 | tsc-rs 0.6.0 | tsc-rs `--fast` |
| --- | ---: | ---: | ---: |
| 150 `tsconfig.check.json` projects, wall sum | 95.8 s | 33.2 s (3.68× geomean) | 33.0 s |
| same, CPU sum (user+sys) | 355.9 s | 85.8 s (4.15×) | 89.5 s |
| 134 `tsconfig.test.json` projects, wall sum | 250.6 s | 78.5 s (2.99×) | 69.5 s (3.48×) |
| same, CPU sum | 1096.6 s | 240.0 s (4.57×) | 349.9 s |
| 136 declaration emits (`tsc -p tsconfig.json`), wall sum | 106.1 s | 39.8 s (3.43×) | not measured |
| largest single peak RSS (`@beep/repo-cli`) | 5.2–6.3 GB | 2.6–3.0 GB | 3.5–3.9 GB |

## Full local `turbo run check` (270 tasks: 119 builds with babel + 151 checks), concurrency 3

| | tsgo | tsc-rs | tsc-rs `--fast` |
| --- | ---: | ---: | ---: |
| wall | 191.7 s | 102.2 s | 95.0 s |
| peak system memory above idle | 20.1 GB | 11.1 GB | 15.8 GB |
| p95 memory above idle | 17.4 GB | 9.3 GB | 12.0 GB |

The machine carried other sessions' load during these runs; treat absolute
times as indicative and the ratios as the result.

## Hosted baseline

Cache-cold `Heavy / Check` on a pull request (2026-10-13): 268 tasks, 0 cached,
7m39s turbo time, 9.3 min job wall, on the `beep-ec2-heavy` m7i.2xlarge
(8 vCPU, 32 GiB) at `--concurrency=4`. Median over the previous 15 runs was
2.5 min because main pushes warm the remote cache.

## Hosted on tsc-rs (2026-10-14, PR #1675 head 5fbfa91c3c)

Cache-cold `Heavy / Check` on the same `beep-ec2-heavy` m7i.2xlarge at
`--concurrency=4`: 265 tasks, 0 cached, 2m14.9s turbo time, against 7m39s for
the tsgo baseline the day before (3.4× faster). `Heavy / Build` on the same
head: 151 tasks, 0 cached, 59.6s turbo time (the baseline run cached its
builds, so there is no cache-cold tsgo build time to compare). Local
`turbo run check --force --continue --concurrency=3` on the 64-core
workstation: 270 of 270 tasks, 1m01.6s turbo time.

## Correctness

- Diagnostics identical on 283 of 284 check and test projects, Effect 377xxx
  rules included; a seeded floating-effect fixture fires TS377001 on both.
- The exceptions are upstream TypeScript 7.1-dev behaviour, reproduced with
  the stock pinned `tsc` 7.1.0-dev.20261008.1: 10 TS7031 (destructured
  parameter defaults such as `{ exitCode } = {}` on `dual` implementations in
  four `*.errors.ts` files and `utils/test/Errors.test.ts`) and 1 TS5088
  (`Knowledge.service.ts` `makeKnowledgeArchiveOracle`, inferred cyclic type
  under declaration emit). Fixed in P0.
- Build emit: 4,973 `.js`/`.d.ts` files byte-identical; 32 `.d.ts` files differ
  only in union member order (also upstream 7.1, verified against stock tsc);
  source maps differ only by a `sourceRoot` key.
- Failure exit code is 2, not 1. `--fast` must follow `-b` ("as in Go, `-b`
  must come first"); a wrapper that prepends `--fast` breaks `tsc-rs -b`.

## Rule-set facts used by this packet

- 0.47.2 → 0.51.1 adds `apiStabilityLeak` (off upstream) and the two
  stability rules the repo already sets off; a no-op for the gate (landed in
  #1636 and #1664).
- 0.51.1 → 0.52.0 adds six rules. Measured with the 0.52.0 compiler over all
  check and test projects: `schemaClassMissingBrand` 6,682 sites in 1,293
  files, `flatMapToTap` 2 (fixed), the other four 0. `apiStabilityLeak` at
  `"error"` would report 12,000 sites across 107 projects.
- 0.51.1 reports an unknown `diagnosticSeverity` key as a TS377134 warning,
  which `ignoreEffectWarningsInTscExitCode: false` turns into a gate failure,
  so future-version keys cannot be pre-registered.
