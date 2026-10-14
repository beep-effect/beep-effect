# Cache baseline review: tsc-rs runs the typecheck and build gates (2026-10-14)

Reviewer: Claude Fable 5.1 (tsc-rs-gates, `feat/tsc-rs-gates`).

## What changed

Every workspace manifest's `beep:build`, `beep:check` and `beep:check:tests`
(and the `beep:check:scripts`, `beep:check:stories`, `beep:check:examples`
variants), the root `check:configs` and infra's `-b` build now invoke `tsc-rs`
instead of `tsgo -p` / `tsc -p` (`goals/tsc-rs-gates`, decision log
2026-10-14). The task graph is unchanged: the same task names run the same
project files with the same inputs and outputs, `cache` flags and `turbo.json`
declarations are untouched, and no dependency edge moved.

## Why the baseline needs a new record

The baseline records every subject's task commands, so swapping the compiler
word in `beep:build`, `beep:check` and `beep:check:tests` changes the recorded
command of every subject (153 subjects, the root `//` included).
Three legacy subjects additionally keep their review basis on their own
manifest bytes: `@beep/ciops` (`apps/labs/ciops/package.json`), `@beep/infra`
(`infra/package.json`) and `@beep/m365-mcp`
(`packages/drivers/m365-mcp/package.json`); the rewrite invalidated those
digests, which is why `beep cache audit` reports "Qualification evidence digest
mismatch." before anything else. This review re-records the legacy posture of
all changed subjects against the rewritten manifests. No qualification is
granted or widened: the same tasks keep the same `cache` flags, inputs, outputs
and dependency edges, and only the compiler binary behind them changed.

## Evidence

- `goals/tsc-rs-gates/research/measurements-2026-10-13.md`: tsc-rs produces
  identical diagnostics to the Effect-patched tsgo on 283 of 284 projects and
  byte-identical emit on 4,973 of 5,005 files (the rest differ in union member
  order, upstream 7.1 behaviour).
- Local `turbo run check --force --continue --concurrency=3` on this branch:
  270 of 270 tasks successful, turbo time 1m01.6s.
