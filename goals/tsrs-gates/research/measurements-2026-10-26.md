# Measurements: Effect-patched tsrs 0.20.0 (@effect/tsgo 0.59.0) vs tsc-rs 0.8.0 (2026-10-26)

Host: this workstation (Linux x64), the `@slop/10-21-26` checkout with built dists.
Binaries: `node_modules/.bin/tsc-rs` 0.8.0 (`Version 7.1.0-dev`, effect-tsgo 0.51.1
rules compiled in) and the `artifacts/tsrs/0.20.0-ts7.1.0-beta/tsrs` binary unpacked
from `@effect/tsgo-linux-x64@0.59.0` (`Version 7.1.0-beta+effect-tsgo.0.59.0`).
Each project ran once per compiler, sequentially, `-p tsconfig.check.json`.

## Check projects

| Measure | tsc-rs 0.8.0 | Effect tsrs 0.59 |
| --- | --- | --- |
| Projects with `tsconfig.check.json` | 181 | 181 |
| Diagnostics (`error TS` lines, total) | 0 | 0 |
| Projects whose diagnostic count differs | 0 | 0 |
| Serial wall, all projects | 26.4 s | 21.3 s |

Per-project rows: [`check-sweep-2026-10-26.tsv`](./check-sweep-2026-10-26.tsv)
(`project`, `tsc-rs diagnostics`, `tsrs diagnostics`, `tsc-rs seconds`, `tsrs seconds`).

## Build mode and memory

| Run | tsc-rs 0.8.0 | Effect tsrs 0.59 |
| --- | --- | --- |
| `infra` `-b tsconfig.json` | 2.18 s, 978 MB peak RSS | 1.55 s, 1086 MB peak RSS |
| `@beep/agents-tables` check | 0.08 s, 257 MB | 0.06 s, 379 MB |
| `@beep/ai-provider-cli` check | 0.13 s, 386 MB | 0.12 s, 466 MB |

Peak RSS per project is higher on tsrs; wall time is lower. The upstream "71% less
time, 48% less memory" benchmark compares tsrs with the Go compiler, not with tsc-rs.

## Effect rules

- A floating `Effect.succeed(1)` canary reports `TS377001 ... effect(floatingEffect)`
  identically under tsc-rs 0.8.0, Effect tsrs 0.59 and `tsgo` 0.55.0.
- A `tsconfig` overlay arming the eleven keys of `standards/effect-diagnostics.profile.json`:
  tsc-rs 0.8.0 prints eleven `TS377134` unknown-rule warnings; Effect tsrs 0.59 and
  `tsgo` 0.55.0 print none. Every rule the standalone lane arms is known to the
  gate compiler once it is the Effect-patched tsrs.

## TypeScript pin

tsrs 0.20.0 ports TypeScript `7.1.0-beta`; tsc-rs 0.8.0 pinned `7.1.0-dev.20261008.1`.
The sweep found no new TypeScript diagnostic from that move.

## Upstream

- Effect-TS/tsgo PR #901 "Additionally support TSRS for the Effect LSP", merged
  2026-10-24: 1:1 Rust port of all 2,332 in-scope Go declarations, 3,833 shared
  baselines matching, parity enforced by `repoctl tsrs port-check`.
- `@effect/tsgo` 0.59.0 (2026-10-26) release notes: proxy commands (`effect-tsgo tsrs`),
  the tsrs incremental-build fix for changed plugin options, tsrs bumped to
  `0.20.0-ts7.1.0-beta`. The packaged tsrs build exists for linux-x64, linux-arm64 and
  darwin-arm64 only; win32 and darwin-x64 packages carry no tsrs artifact.
